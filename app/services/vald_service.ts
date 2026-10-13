import ValdTrial from '#models_pg/vald_trial'
import ValdTest from '#models_pg/vald_test'
import Day from '#models_pg/day'
import AthleteProvider from '#models_pg/athlete_provider'
import ClubProvider from '#models_pg/club_provider'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import {
  VALD_AUDIENCE,
  VALD_FULL_SYNC_FROM,
  VALD_MAX_RETRIES,
  VALD_REQUEST_DELAY_MS,
} from '#constants/vald.constants'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import axios, { type AxiosResponse } from 'axios'
import { DateTime } from 'luxon'
import type {
  ValdClubSyncResult,
  ValdResult,
  ValdServiceConfig,
  ValdSyncOptions,
  ValdTest as ValdApiTest,
  ValdTrial as ValdApiTrial,
} from '#contracts/vald'
import BodymetricsHistory from '#models_pg/bodymetrics_history'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const DEFAULT_TRIAL_RESULTS = {
  trialJumpHeight: 'jump_height',
  trialRsiModified: 'rsi_modified',
  trialPeakTakeoffPower: 'peak_takeoff_power',
  trialConcentricRfd: 'concentric_rfd',
  trialPeakLandingForce: 'peak_landing_force',
  trialTimeToStabilisation: 'time_to_stabilisation',
  trialRsi: 'rsi',
  trialEccentricBrakingRfd: 'eccentric_braking_rfd',
} as const

const CMRJ_TRIAL_RESULTS = {
  trialJumpHeight: 'cmrj_rebound_jump_height',
  trialRsiModified: 'cmrj_takeoff_rsi_modified',
  trialPeakTakeoffPower: 'cmrj_rebound_peak_power',
  trialConcentricRfd: 'concentric_rfd',
  trialPeakLandingForce: 'cmrj_rebound_peak_drop_landing_force',
  trialTimeToStabilisation: 'time_to_stabilisation',
  trialRsi: 'cmrj_rebound_rsi',
  trialEccentricBrakingRfd: 'cmrj_rebound_drop_landing_rfd',
} as const

const getResultValue = (results: ValdResult[], name: string) => {
  const found = results.find((result) => result.definition?.result?.toLowerCase() === name.toLowerCase())
  return found ? found.value : null
}

const persistTrial = async (
  valdTestId: string,
  results: ValdResult[],
  names: Record<keyof typeof DEFAULT_TRIAL_RESULTS, string>
) => {
  await ValdTrial.create({
    valdTestId,
    trialJumpHeight: getResultValue(results, names.trialJumpHeight),
    trialRsiModified: getResultValue(results, names.trialRsiModified),
    trialPeakTakeoffPower: getResultValue(results, names.trialPeakTakeoffPower),
    trialConcentricRfd: getResultValue(results, names.trialConcentricRfd),
    trialPeakLandingForce: getResultValue(results, names.trialPeakLandingForce),
    trialTimeToStabilisation: getResultValue(results, names.trialTimeToStabilisation),
    trialRsi: getResultValue(results, names.trialRsi),
    trialEccentricBrakingRfd: getResultValue(results, names.trialEccentricBrakingRfd),
  })
}

export default class ValdService {
  private baseUrl = env.get('VALD_API_BASE_URL')
  private clientId = env.get('VALD_CLIENT_ID')
  private clientSecret = env.get('VALD_CLIENT_SECRET')
  private tokenUrl = env.get('VALD_TOKEN_URL')
  private readonly clubId: string
  private readonly tenantId: string

  private static tokenCache: { accessToken: string | null; expiresAt: number | null } = {
    accessToken: null,
    expiresAt: null,
  }

  constructor(config: ValdServiceConfig) {
    this.clubId = config.clubId
    this.tenantId = config.tenantId
  }

  static fromClubProvider(provider: ClubProvider): ValdService {
    if (!provider.providerTeamId) {
      throw new Error(
        `Vald provider misconfigured for club ${provider.clubId}: providerTeamId (tenantId) is required`
      )
    }

    return new ValdService({
      clubId: provider.clubId,
      tenantId: provider.providerTeamId,
    })
  }

  static async fromClubId(clubId: string): Promise<ValdService> {
    const provider = await ClubProvider.query()
      .where('clubId', clubId)
      .where('provider', CLUB_PROVIDER_TYPES.VALD)
      .firstOrFail()

    return ValdService.fromClubProvider(provider)
  }

  static async syncAllClubs(): Promise<ValdClubSyncResult[]> {
    const providers = await ClubProvider.query()
      .where('provider', CLUB_PROVIDER_TYPES.VALD)
      .whereNotNull('providerTeamId')
    const results: ValdClubSyncResult[] = []

    for (const provider of providers) {
      try {
        const service = ValdService.fromClubProvider(provider)
        const result = await service.syncClubAthletes()
        provider.lastSyncedAt = DateTime.now()
        await provider.save()
        results.push(result)
      } catch (error) {
        results.push({
          clubId: provider.clubId,
          tenantId: provider.providerTeamId ?? '',
          athleteCount: 0,
          synced: 0,
          failed: 0,
          testsImported: 0,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  public async syncClubAthletes(options: ValdSyncOptions = {}): Promise<ValdClubSyncResult> {
    const delayMs = options.delayMs ?? VALD_REQUEST_DELAY_MS
    const athleteProviders = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.VALD)
      .whereNotNull('providerAthleteId')
      .whereHas('athlete', (query) => {
        query.where('clubId', this.clubId)
      })
      .preload('athlete')

    let synced = 0
    let failed = 0
    let testsImported = 0
    const total = athleteProviders.length
    logger.info(`Vald sync club=${this.clubId} athletes=${total}`)

    for (const [index, provider] of athleteProviders.entries()) {
      if (!provider.athlete) continue
      const name = `${provider.athlete.firstName} ${provider.athlete.lastName}`.trim()
      try {
        const imported = await this.syncAthlete(provider, options)
        testsImported += imported
        synced++
        logger.info(`Vald ${index + 1}/${total} ${name} tests=${imported}`)
      } catch (error) {
        failed++
        logger.error(
          `Vald ${index + 1}/${total} ${name} failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
      await sleep(delayMs)
    }

    return {
      clubId: this.clubId,
      tenantId: this.tenantId,
      athleteCount: athleteProviders.length,
      synced,
      failed,
      testsImported,
    }
  }

  private async syncAthlete(
    athleteProvider: AthleteProvider,
    options: ValdSyncOptions
  ): Promise<number> {
    const athlete = athleteProvider.athlete
    const valdProfileId = athleteProvider.providerAthleteId
    if (!athlete || athlete.clubId !== this.clubId || !valdProfileId) {
      return 0
    }

    const modifiedFromUtc =
      options.modifiedFromUtc ??
      athleteProvider.updatedAt?.toUTC().toISO() ??
      `${VALD_FULL_SYNC_FROM}T00:00:00.000Z`

    let imported = 0
    let maxRecordedUTC: DateTime | null = null
    const tests = await this.fetchTestsForAthlete(valdProfileId, modifiedFromUtc)
    const providerTestIds = tests.map((test) => test.testId).filter((id): id is string => Boolean(id))
    const existingTests =
      providerTestIds.length > 0
        ? await ValdTest.query().whereIn('providerTestId', providerTestIds)
        : []
    const existingTestIds = new Set(
      existingTests.map((row) => row.providerTestId).filter((id): id is string => Boolean(id))
    )

    for (const test of tests) {
      const modifiedAt = test.modifiedDateUtc ? DateTime.fromISO(test.modifiedDateUtc) : null
      if (modifiedAt?.isValid && (!maxRecordedUTC || modifiedAt > maxRecordedUTC)) {
        maxRecordedUTC = modifiedAt
      }

      if (!test.testId || existingTestIds.has(test.testId)) continue

      const testDate = DateTime.fromISO(test.modifiedDateUtc).toISODate()
      if (!testDate) continue
      let day = await Day.query()
        .where('athleteId', athlete.id)
        .andWhere('dateOfDay', testDate)
        .first()
      if (!day) {
        if (options.dryRun) {
          imported++
          continue
        }
        day = await Day.create({
          athleteId: athlete.id,
          dateOfDay: DateTime.fromISO(testDate),
        })
      }

      if (options.dryRun) {
        imported++
        continue
      }

      const valdTest = await ValdTest.create({
        dayId: day.id,
        testType: test.testType || 'unknown',
        providerTestId: test.testId,
        value: test.parameters?.value || null,
      })
      existingTestIds.add(test.testId)
      imported++

      if (test.weight) {
        let bodymetrics = await BodymetricsHistory.query()
          .where('athleteId', athlete.id)
          .where('dayId', day.id)
          .first()
        if (!bodymetrics) {
          bodymetrics = new BodymetricsHistory()
          bodymetrics.athleteId = athlete.id
          bodymetrics.dayId = day.id
        }
        bodymetrics.weight = test.weight
        athlete.weightKg = test.weight
        await bodymetrics.save()
        await athlete.save()
      }

      const trials = await this.fetchTrialsForTest(test.testId)
      await sleep(VALD_REQUEST_DELAY_MS)
      const resultNames = test.testType === 'CMRJ' ? CMRJ_TRIAL_RESULTS : DEFAULT_TRIAL_RESULTS
      for (const trial of trials) {
        if (!trial.recordedUTC) continue
        const trialRecordedUTC = DateTime.fromISO(trial.recordedUTC)
        if (!maxRecordedUTC || trialRecordedUTC > maxRecordedUTC) {
          maxRecordedUTC = trialRecordedUTC
        }
        await persistTrial(valdTest.id, trial.results, resultNames)
      }
    }

    if (
      !options.dryRun &&
      maxRecordedUTC &&
      (!athleteProvider.updatedAt || maxRecordedUTC > athleteProvider.updatedAt)
    ) {
      athleteProvider.updatedAt = maxRecordedUTC
      await athleteProvider.save()
    }

    return imported
  }

  private async fetchTestsForAthlete(
    valdProfileId: string,
    modifiedFromUtc: string
  ): Promise<ValdApiTest[]> {
    const tests: ValdApiTest[] = []
    const seen = new Set<string>()
    let cursor = modifiedFromUtc

    while (true) {
      const url = `${this.baseUrl}/tests?tenantId=${this.tenantId}&profileId=${valdProfileId}&modifiedFromUtc=${encodeURIComponent(cursor)}`
      const response = await this.getWithRetry<{ tests?: ValdApiTest[] }>(url)
      if (response.status === 204) break
      const page = response.data?.tests ?? []
      if (page.length === 0) break

      let added = 0
      for (const test of page) {
        if (!test.testId || seen.has(test.testId)) continue
        seen.add(test.testId)
        tests.push(test)
        added++
      }

      const lastModified = page[page.length - 1]?.modifiedDateUtc
      if (!lastModified || added === 0) break
      cursor = lastModified
      await sleep(VALD_REQUEST_DELAY_MS)
    }

    return tests
  }

  private async fetchTrialsForTest(testId: string): Promise<ValdApiTrial[]> {
    const url = `${this.baseUrl}/v2019q3/teams/${this.tenantId}/tests/${testId}/trials`
    const response = await this.getWithRetry<ValdApiTrial[]>(url)
    if (response.status === 204) return []
    return Array.isArray(response.data) ? response.data : []
  }

  private async getWithRetry<T>(url: string): Promise<AxiosResponse<T>> {
    let lastError: unknown

    for (let attempt = 0; attempt < VALD_MAX_RETRIES; attempt++) {
      try {
        const token = await this.getToken()
        const response = await axios.get<T>(url, {
          headers: { Authorization: token },
          validateStatus: (status) =>
            status === 204 || (status >= 200 && status < 300) || status === 429,
        })
        if (response.status !== 429) return response

        const retryAfter = Number(response.headers['retry-after'])
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : VALD_REQUEST_DELAY_MS * 2 ** attempt
        await sleep(waitMs)
        lastError = new Error(`Vald API 429 on ${url}`)
      } catch (error) {
        lastError = error
        const retryable =
          axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            (error.response?.status !== undefined && error.response.status >= 500))
        if (!retryable || attempt === VALD_MAX_RETRIES - 1) throw error
        await sleep(VALD_REQUEST_DELAY_MS * 2 ** attempt)
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Vald API request failed: ${url}`)
  }

  private async getToken(): Promise<string> {
    const cache = ValdService.tokenCache
    if (cache.accessToken && cache.expiresAt && cache.expiresAt > Date.now()) {
      return cache.accessToken
    }
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')
    params.append('client_id', this.clientId)
    params.append('client_secret', this.clientSecret)
    params.append('audience', VALD_AUDIENCE)
    const response = await axios.post(this.tokenUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    const data = response.data
    const expiresIn = data.expires_in || 7200
    cache.accessToken = `Bearer ${data.access_token}`
    cache.expiresAt = Date.now() + expiresIn * 1000
    return cache.accessToken
  }
}
