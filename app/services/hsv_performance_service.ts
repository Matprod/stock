import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import {
  HSV_API_URL,
  HSV_ATHLETE_ALIASES,
  HSV_DATA_SOURCE,
  HSV_HEALTH_METRIC_INJURY_STATUS,
  HSV_HEALTH_METRIC_TRAINING_RPE,
  HSV_IMPORT_CHUNK,
  HSV_LIKERT_FACTOR,
  HSV_PAGE_CAP,
  HSV_SKIP_NAMES,
  HSV_SYNC_LOOKBACK_DAYS,
  HSV_WELLNESS_ENDPOINT,
  HSV_WELLNESS_START,
  HSV_WINDOW_DAYS,
} from '#constants/hsv.constants'
import type {
  HsvImportOptions,
  HsvImportResult,
  HsvQueueResult,
  HsvWellnessRow,
} from '#contracts/hsv'
import Athlete from '#models_pg/athlete'
import AthleteProvider from '#models_pg/athlete_provider'
import Day from '#models_pg/day'
import HealthMetric from '#models_pg/health_metric'
import HealthMetricValue from '#models_pg/health_metric_value'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import axios from 'axios'
import { DateTime } from 'luxon'

type HsvQuery = {
  from?: string
  to?: string
}

type AthleteHit =
  | { status: 'matched'; athlete: Athlete; name: string }
  | { status: 'missing' | 'ambiguous' | 'ignored'; name: string }

type PreparedWellness = {
  athleteId: string
  date: string
  responseId: number
  sleep: number | null
  mood: number | null
  body: number | null
  rpe: number | null
  injury: number | null
}

const HSV_SKIP = new Set<string>(HSV_SKIP_NAMES)

const foldName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ł/gi, 'l')
    .replace(/đ/gi, 'd')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const likertToStored = (value: unknown): number | null => {
  const score = finiteNumber(value)
  if (score === null || !Number.isInteger(score) || score < 1 || score > 6) return null
  return score * HSV_LIKERT_FACTOR
}

const isoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const date = value.slice(0, 10)
  const parsed = DateTime.fromISO(date, { zone: 'utc' })
  if (!parsed.isValid) return null
  return parsed.toISODate()
}

const displayName = (
  first: string | null | undefined,
  last: string | null | undefined,
  fallback: string | null | undefined
): string => {
  const full = [first, last]
    .filter((part) => part && part.trim())
    .join(' ')
    .trim()
  return full || fallback?.trim() || 'unknown'
}

const uniqueAthlete = (athletes: Athlete[]): Athlete | 'ambiguous' | null => {
  if (athletes.length === 1) return athletes[0]
  if (athletes.length > 1) return 'ambiguous'
  return null
}

const windowsBetween = (from: string, to: string): Array<{ from: string; to: string }> => {
  const windows: Array<{ from: string; to: string }> = []
  let cursor = DateTime.fromISO(from, { zone: 'utc' })
  const end = DateTime.fromISO(to, { zone: 'utc' })
  while (cursor <= end) {
    const windowEnd = DateTime.min(cursor.plus({ days: HSV_WINDOW_DAYS - 1 }), end)
    const fromIso = cursor.toISODate()
    const toIso = windowEnd.toISODate()
    if (!fromIso || !toIso) break
    windows.push({ from: fromIso, to: toIso })
    cursor = windowEnd.plus({ days: 1 })
  }
  return windows
}

const buildAthleteIndex = (athletes: Athlete[]) => {
  const byFull = new Map<string, Athlete[]>()
  const byLast = new Map<string, Athlete[]>()

  const add = (map: Map<string, Athlete[]>, key: string, athlete: Athlete) => {
    if (!key) return
    const list = map.get(key) ?? []
    list.push(athlete)
    map.set(key, list)
  }

  for (const athlete of athletes) {
    add(byFull, foldName(`${athlete.firstName} ${athlete.lastName}`), athlete)
    add(byLast, foldName(athlete.lastName), athlete)
  }

  return (row: HsvWellnessRow): AthleteHit => {
    const name = displayName(row.first_name, row.last_name, row.player_name)
    const folded = foldName(name)
    if (HSV_SKIP.has(folded)) {
      return { status: 'ignored', name }
    }

    const aliased = HSV_ATHLETE_ALIASES[folded] ?? folded
    const full = uniqueAthlete(byFull.get(aliased) ?? [])
    if (full === 'ambiguous') return { status: 'ambiguous', name }
    if (full) return { status: 'matched', athlete: full, name }

    const lastName = foldName(row.last_name ?? '')
    const last = uniqueAthlete(byLast.get(lastName) ?? [])
    if (last === 'ambiguous') return { status: 'ambiguous', name }
    if (last) return { status: 'matched', athlete: last, name }

    return { status: 'missing', name }
  }
}

export default class HsvPerformanceService {
  constructor(
    private readonly anonKey: string,
    private readonly partnerKey: string,
    private readonly clubId: string
  ) {}

  static fromEnv(clubId = HAMBOURG_CLUB_ID): HsvPerformanceService {
    const anonKey = env.get('HSV_SUPABASE_ANON_KEY')
    const partnerKey = env.get('HSV_PARTNER_API_KEY')
    if (!anonKey || !partnerKey) {
      throw new Error('HSV_SUPABASE_ANON_KEY and HSV_PARTNER_API_KEY are required')
    }
    return new HsvPerformanceService(anonKey, partnerKey, clubId)
  }

  static lookbackRange(lookbackDays = HSV_SYNC_LOOKBACK_DAYS): { from: string; to: string } {
    const to = DateTime.utc().toISODate()
    if (!to) throw new Error('Could not compute HSV to date')
    const lookback = DateTime.utc().minus({ days: lookbackDays }).startOf('day')
    const min = DateTime.fromISO(HSV_WELLNESS_START, { zone: 'utc' })
    const from = DateTime.max(lookback, min).toISODate()
    if (!from) throw new Error('Could not compute HSV from date')
    return { from, to }
  }

  static async queueDailyImport(clubId = HAMBOURG_CLUB_ID): Promise<HsvQueueResult> {
    const range = HsvPerformanceService.lookbackRange()
    const { default: ProcessHsvWellnessJob } = await import('#jobs/process_hsv_wellness_job')
    await ProcessHsvWellnessJob.dispatch({
      ...range,
      clubId,
    })
    return { ...range, clubId }
  }

  async fetchWellness(query: HsvQuery = {}): Promise<HsvWellnessRow[]> {
    const from = query.from ?? HSV_WELLNESS_START
    const to = query.to ?? this.today()
    const rows: HsvWellnessRow[] = []

    for (const window of windowsBetween(from, to)) {
      const batch = await this.post({
        p_from: window.from,
        p_to: window.to,
      })
      if (batch.length >= HSV_PAGE_CAP) {
        throw new Error(
          `HSV wellness hit the ${HSV_PAGE_CAP} row cap for ${window.from} → ${window.to}`
        )
      }
      rows.push(...batch)
    }

    return rows
  }

  async importAll(options: HsvImportOptions = {}): Promise<HsvImportResult> {
    const from = options.from ?? HSV_WELLNESS_START
    const to = options.to ?? this.today()
    const start = DateTime.fromISO(from, { zone: 'utc' })
    const end = DateTime.fromISO(to, { zone: 'utc' })
    if (!start.isValid || !end.isValid || start > end) {
      throw new Error(`Invalid HSV range ${from} → ${to}`)
    }

    const [rows, athletes] = await Promise.all([
      this.fetchWellness({ from, to }),
      Athlete.query().where('clubId', this.clubId),
    ])

    const sapAthleteIds = await this.sapAthleteIds(athletes.map((athlete) => athlete.id))
    const prepared = this.prepare(rows, buildAthleteIndex(athletes), sapAthleteIds)
    const dryRun = options.dryRun === true

    if (!dryRun) await this.persist(prepared.rows)

    logger.info(
      `HSV wellness dryRun=${dryRun} upserted=${prepared.rows.length} missing=${prepared.missing.length} withoutSap=${prepared.withoutSap.length}`
    )

    return {
      dryRun,
      from,
      to,
      rows: rows.length,
      upserted: prepared.rows.length,
      skippedEmpty: prepared.skippedEmpty,
      missing: prepared.missing,
      ambiguous: prepared.ambiguous,
      ignored: prepared.ignored,
      withoutSap: prepared.withoutSap,
    }
  }

  private today(): string {
    const date = DateTime.utc().toISODate()
    if (!date) throw new Error('Could not compute HSV today')
    return date
  }

  private async post(extra: { p_from?: string; p_to?: string }) {
    const body: Record<string, string> = { p_key: this.partnerKey }
    if (extra.p_from) body.p_from = extra.p_from
    if (extra.p_to) body.p_to = extra.p_to

    let response
    try {
      response = await axios.post<unknown>(`${HSV_API_URL}/${HSV_WELLNESS_ENDPOINT}`, body, {
        headers: {
          'apikey': this.anonKey,
          'Authorization': `Bearer ${this.anonKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      })
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      throw new Error(`HSV wellness failed${status ? ` (${status})` : ''}`, { cause: error })
    }

    if (!Array.isArray(response.data)) return []
    return response.data as HsvWellnessRow[]
  }

  private async sapAthleteIds(athleteIds: string[]): Promise<Set<string>> {
    if (athleteIds.length === 0) return new Set()
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereIn('athleteId', athleteIds)
      .whereNotNull('providerAthleteId')
    return new Set(providers.map((provider) => provider.athleteId))
  }

  private prepare(
    rows: HsvWellnessRow[],
    match: (row: HsvWellnessRow) => AthleteHit,
    sapAthleteIds: Set<string>
  ): {
    rows: PreparedWellness[]
    skippedEmpty: number
    missing: string[]
    ambiguous: string[]
    ignored: string[]
    withoutSap: string[]
  } {
    const byKey = new Map<string, PreparedWellness>()
    const missing = new Set<string>()
    const ambiguous = new Set<string>()
    const ignored = new Set<string>()
    const withoutSap = new Set<string>()
    let skippedEmpty = 0

    for (const row of rows) {
      const hit = match(row)
      if (hit.status === 'missing') missing.add(hit.name)
      if (hit.status === 'ambiguous') ambiguous.add(hit.name)
      if (hit.status === 'ignored') ignored.add(hit.name)
      if (hit.status !== 'matched') continue

      if (!sapAthleteIds.has(hit.athlete.id)) {
        withoutSap.add(hit.name)
        continue
      }

      const date = isoDate(row.response_date)
      const responseId = finiteNumber(row.response_id)
      if (!date || responseId === null) continue

      const prepared: PreparedWellness = {
        athleteId: hit.athlete.id,
        date,
        responseId,
        sleep: likertToStored(row.sleep_quality),
        mood: likertToStored(row.mental_state),
        body: likertToStored(row.body_feeling),
        rpe: likertToStored(row.rpe),
        injury: likertToStored(row.injury_status),
      }
      if (
        prepared.sleep === null &&
        prepared.mood === null &&
        prepared.body === null &&
        prepared.rpe === null &&
        prepared.injury === null
      ) {
        skippedEmpty++
        continue
      }

      const key = `${prepared.athleteId}|${prepared.date}`
      const current = byKey.get(key)
      if (!current || prepared.responseId >= current.responseId) byKey.set(key, prepared)
    }

    return {
      rows: [...byKey.values()],
      skippedEmpty,
      missing: [...missing].sort(),
      ambiguous: [...ambiguous].sort(),
      ignored: [...ignored].sort(),
      withoutSap: [...withoutSap].sort(),
    }
  }

  private async persist(rows: PreparedWellness[]): Promise<void> {
    if (rows.length === 0) return
    const catalog = await this.healthMetricCatalog()

    for (let offset = 0; offset < rows.length; offset += HSV_IMPORT_CHUNK) {
      const chunk = rows.slice(offset, offset + HSV_IMPORT_CHUNK)
      const trx = await db.transaction()
      try {
        const dayByKey = await this.ensureDays(chunk, trx)
        const dayIds = [...dayByKey.values()].map((day) => day.id)
        const [sleeps, healths] = await Promise.all([
          Sleep.query({ client: trx }).whereIn('dayId', dayIds),
          HealthRating.query({ client: trx }).whereIn('dayId', dayIds),
        ])

        const sleepsByDay = new Map<string, Sleep[]>()
        for (const sleep of sleeps) {
          const list = sleepsByDay.get(sleep.dayId) ?? []
          list.push(sleep)
          sleepsByDay.set(sleep.dayId, list)
        }
        const healthByDay = new Map(healths.map((health) => [health.dayId, health]))

        const sleepCreates: Array<{ dayId: string; dataSource: typeof HSV_DATA_SOURCE; qualityRating: number }> =
          []
        const sleepUpdates: Sleep[] = []
        const healthCreates: Array<{
          dayId: string
          moodRating: number | null
          bodySorenessRating: number | null
        }> = []
        const healthUpdates: HealthRating[] = []
        const metricEntries: Array<{ healthId: string; metricId: string; value: string }> = []
        const pendingMetrics: Array<{ dayId: string; rpe: number | null; injury: number | null }> = []

        for (const row of chunk) {
          const day = dayByKey.get(`${row.athleteId}|${row.date}`)
          if (!day) continue

          if (row.sleep !== null) {
            const existing = sleepsByDay.get(day.id) ?? []
            const sleep =
              existing.find((entry) => entry.dataSource === HSV_DATA_SOURCE) ??
              existing.find((entry) => entry.dataSource === 'sap') ??
              existing.find((entry) => entry.dataSource === null)
            if (!sleep) {
              sleepCreates.push({
                dayId: day.id,
                dataSource: HSV_DATA_SOURCE,
                qualityRating: row.sleep,
              })
            } else {
              sleep.qualityRating = row.sleep
              sleep.dataSource = HSV_DATA_SOURCE
              sleepUpdates.push(sleep)
            }
          }

          if (row.mood !== null || row.body !== null || row.rpe !== null || row.injury !== null) {
            const health = healthByDay.get(day.id)
            if (!health) {
              healthCreates.push({
                dayId: day.id,
                moodRating: row.mood,
                bodySorenessRating: row.body,
              })
              pendingMetrics.push({ dayId: day.id, rpe: row.rpe, injury: row.injury })
            } else {
              if (row.mood !== null) health.moodRating = row.mood
              if (row.body !== null) health.bodySorenessRating = row.body
              healthUpdates.push(health)
              if (row.rpe !== null) {
                metricEntries.push({
                  healthId: health.id,
                  metricId: catalog.trainingRpeId,
                  value: String(row.rpe),
                })
              }
              if (row.injury !== null) {
                metricEntries.push({
                  healthId: health.id,
                  metricId: catalog.injuryStatusId,
                  value: String(row.injury),
                })
              }
            }
          }
        }

        if (sleepCreates.length > 0) {
          await Sleep.createMany(sleepCreates, { client: trx })
        }
        if (healthCreates.length > 0) {
          const created = await HealthRating.createMany(healthCreates, { client: trx })
          const createdByDay = new Map(created.map((health) => [health.dayId, health]))
          for (const pending of pendingMetrics) {
            const health = createdByDay.get(pending.dayId)
            if (!health) continue
            if (pending.rpe !== null) {
              metricEntries.push({
                healthId: health.id,
                metricId: catalog.trainingRpeId,
                value: String(pending.rpe),
              })
            }
            if (pending.injury !== null) {
              metricEntries.push({
                healthId: health.id,
                metricId: catalog.injuryStatusId,
                value: String(pending.injury),
              })
            }
          }
        }

        if (sleepUpdates.length > 0) {
          await Promise.all(sleepUpdates.map((sleep) => sleep.useTransaction(trx).save()))
        }
        if (healthUpdates.length > 0) {
          await Promise.all(healthUpdates.map((health) => health.useTransaction(trx).save()))
        }
        if (metricEntries.length > 0) {
          await HealthMetricValue.updateOrCreateMany(['healthId', 'metricId'], metricEntries, {
            client: trx,
          })
        }

        await trx.commit()
      } catch (error) {
        if (!trx.isCompleted) await trx.rollback()
        throw error
      }
    }
  }

  private async healthMetricCatalog(): Promise<{ trainingRpeId: string; injuryStatusId: string }> {
    const metrics = await HealthMetric.query().whereRaw('btrim(name) in (?, ?)', [
      HSV_HEALTH_METRIC_TRAINING_RPE,
      HSV_HEALTH_METRIC_INJURY_STATUS,
    ])
    const training = metrics.find((metric) => metric.name.trim() === HSV_HEALTH_METRIC_TRAINING_RPE)
    const injury = metrics.find((metric) => metric.name.trim() === HSV_HEALTH_METRIC_INJURY_STATUS)
    if (!training || !injury) {
      throw new Error(
        `Missing health metrics ${HSV_HEALTH_METRIC_TRAINING_RPE} or ${HSV_HEALTH_METRIC_INJURY_STATUS}`
      )
    }
    return { trainingRpeId: training.id, injuryStatusId: injury.id }
  }

  private async ensureDays(
    rows: Array<{ athleteId: string; date: string }>,
    trx: Awaited<ReturnType<typeof db.transaction>>
  ): Promise<Map<string, Day>> {
    const athleteIds = [...new Set(rows.map((row) => row.athleteId))]
    const dates = [...new Set(rows.map((row) => row.date))]
    const existing = await Day.query({ client: trx })
      .whereIn('athleteId', athleteIds)
      .whereIn('dateOfDay', dates)
    const dayByKey = new Map(
      existing.map((day) => [`${day.athleteId}|${day.dateOfDay.toFormat('yyyy-MM-dd')}`, day])
    )

    const missingKeys = new Set<string>()
    for (const row of rows) {
      const key = `${row.athleteId}|${row.date}`
      if (!dayByKey.has(key)) missingKeys.add(key)
    }

    if (missingKeys.size > 0) {
      await Day.updateOrCreateMany(
        ['athleteId', 'dateOfDay'],
        [...missingKeys].map((key) => {
          const [athleteId, date] = key.split('|')
          return { athleteId, dateOfDay: DateTime.fromISO(date, { zone: 'utc' }) }
        }),
        { client: trx }
      )
      const refreshed = await Day.query({ client: trx })
        .whereIn('athleteId', athleteIds)
        .whereIn('dateOfDay', dates)
      for (const day of refreshed) {
        dayByKey.set(`${day.athleteId}|${day.dateOfDay.toFormat('yyyy-MM-dd')}`, day)
      }
    }

    return dayByKey
  }
}
