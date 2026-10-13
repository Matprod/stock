import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import {
  DFL_API_CONFIG,
  DFL_COMPETITION_IDS,
  DFL_IMPORT_MIN_DATE,
  DFL_METRIC_NAMES,
  DFL_SERVICES,
  mapDflPlayerMetrics,
} from '#constants/dfl.constants'
import { SPORT_ACTIVITY_METRIC_SOURCE } from '#constants/sport_activity_metrics.constants'
import { MetricDomain } from '#contracts/metric'
import type {
  DflClubSyncResult,
  DflFixture,
  DflPlayerMatchMetrics,
  DflSeason,
  DflServiceConfig,
} from '#contracts/dfl'
import AthleteProvider from '#models_pg/athlete_provider'
import ClubProvider from '#models_pg/club_provider'
import Day from '#models_pg/day'
import SportActivity from '#models_pg/sport_activity'
import SportActivityMetric from '#models_pg/sport_activity_metric'
import { EventService } from '#services/event_service'
import { MetricService } from '#services/metric_service'
import { findAll, findFirst, parseXml } from '#utils/dfl_xml'
import { getFootballActivityTypeId } from '#utils/football_activity'
import axios, { type AxiosInstance } from 'axios'
import { DateTime } from 'luxon'

export type DflImportResult = {
  matches: number
  imported: number
  activitiesUpdated: number
  activitiesCreated: number
  skipped: number
  failed: number
  errors: string[]
}

export class DflService {
  readonly maunaClubId: string
  readonly dflClubId: string
  private readonly client: AxiosInstance
  private readonly clientId: string
  private readonly metrics = new MetricService(MetricDomain.SPORT_ACTIVITY)
  private readonly eventService = new EventService()

  constructor(config: DflServiceConfig) {
    this.maunaClubId = config.maunaClubId
    this.dflClubId = config.dflClubId
    this.clientId = config.clientId
    this.client = axios.create({
      baseURL: (config.baseUrl || DFL_API_CONFIG.baseUrl).replace(/\/$/, ''),
      timeout: DFL_API_CONFIG.timeoutMs,
      headers: { Accept: 'application/xml, text/xml, */*' },
      responseType: 'text',
      transformResponse: [(data) => data],
    })
  }

  static fromClubProvider(provider: ClubProvider): DflService {
    if (!provider.accessToken || !provider.providerTeamId) {
      throw new Error(
        `DFL provider misconfigured for club ${provider.clubId}: accessToken (client id) and providerTeamId (DFL club id) are required`
      )
    }

    return new DflService({
      maunaClubId: provider.clubId,
      dflClubId: provider.providerTeamId,
      clientId: provider.accessToken,
    })
  }

  static async fromClubId(clubId: string): Promise<DflService> {
    const query = ClubProvider.query().where('provider', CLUB_PROVIDER_TYPES.DFL)
    if (clubId.startsWith('DFL-')) {
      query.where('providerTeamId', clubId)
    } else {
      query.where('clubId', clubId)
    }

    return DflService.fromClubProvider(await query.firstOrFail())
  }

  static async getConfiguredProviders(): Promise<ClubProvider[]> {
    return ClubProvider.query()
      .where('provider', CLUB_PROVIDER_TYPES.DFL)
      .whereNotNull('accessToken')
      .whereNotNull('providerTeamId')
  }

  static async syncAllClubs(fromDate: string): Promise<DflClubSyncResult[]> {
    const providers = await DflService.getConfiguredProviders()
    const results: DflClubSyncResult[] = []

    for (const provider of providers) {
      try {
        const service = DflService.fromClubProvider(provider)
        const result = await service.importClub(0, undefined, fromDate)
        provider.lastSyncedAt = DateTime.now()
        await provider.save()
        results.push({ clubId: provider.clubId, ...result })
      } catch (error) {
        results.push({
          clubId: provider.clubId,
          matches: 0,
          imported: 0,
          activitiesUpdated: 0,
          activitiesCreated: 0,
          skipped: 0,
          failed: 0,
          errors: [],
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return results
  }

  async pullFeed(serviceId: string, parameterId?: string): Promise<string> {
    return this.pull(serviceId, parameterId)
  }

  async listPlayedFixtures(
    matchLimit = 10,
    seasonName?: string,
    fromDate?: string
  ): Promise<DflFixture[]> {
    const seasons = await this.fetchSeasons()
    const minDate = DateTime.fromISO(fromDate || DFL_IMPORT_MIN_DATE, { zone: 'utc' }).startOf(
      'day'
    )
    const allSeasons = seasonName?.toLowerCase() === 'all'
    const candidates = (
      allSeasons
        ? preferredSeasons(seasons)
        : seasonName
          ? [resolveSeason(seasons, seasonName)]
          : preferredSeasons(seasons)
    ).filter((season) => seasonOverlapsMinDate(season, minDate))

    const pastFixtures: DflFixture[] = []
    const seenMatchIds = new Set<string>()

    for (const season of candidates) {
      console.log(`  season ${season.name} (${season.seasonId})`)
      const fixtures = await this.fetchClubFixtures(this.dflClubId, season.seasonId)
      if (fixtures.length === 0) {
        console.log(`  → club not in season, skip`)
        if (!allSeasons && seasonName) {
          throw new Error(`Club ${this.dflClubId} not found in season ${season.name}`)
        }
        continue
      }

      const past = fixtures
        .filter((fixture) => DateTime.fromISO(fixture.kickoff).isValid)
        .filter((fixture) => {
          const kickoff = DateTime.fromISO(fixture.kickoff)
          return kickoff >= minDate && kickoff <= DateTime.utc()
        })
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff))

      console.log(`  → fixtures=${fixtures.length} in_range=${past.length}`)

      for (const fixture of past) {
        if (seenMatchIds.has(fixture.matchId)) continue
        seenMatchIds.add(fixture.matchId)
        pastFixtures.push(fixture)
      }

      if (!allSeasons && !seasonName && past.length > 0) break
      if (!allSeasons && seasonName) break
    }

    pastFixtures.sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    const selected = matchLimit > 0 ? pastFixtures.slice(0, matchLimit) : pastFixtures

    if (selected.length === 0) {
      console.log(`  no played DFL matches found for club ${this.dflClubId}`)
      return []
    }

    return selected
  }

  async importClub(
    matchLimit = 10,
    seasonName?: string,
    fromDate?: string
  ): Promise<DflImportResult> {
    const importFrom = fromDate || DFL_IMPORT_MIN_DATE
    console.log(`  import from ${importFrom} onwards`)
    const selected = await this.listPlayedFixtures(matchLimit, seasonName, fromDate)
    const allSeasons = seasonName?.toLowerCase() === 'all'

    if (selected.length === 0) {
      return {
        matches: 0,
        imported: 0,
        activitiesUpdated: 0,
        activitiesCreated: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      }
    }

    console.log(
      `  importing ${selected.length} match(es)${allSeasons ? ' across all seasons' : ''}${matchLimit > 0 ? ` (limit=${matchLimit})` : ''}`
    )

    const playerRows: DflPlayerMatchMetrics[] = []
    for (const fixture of selected) {
      const rows = await this.fetchMatchPlayerMetrics(fixture, this.dflClubId)
      playerRows.push(...rows)
      await sleep(DFL_API_CONFIG.interCallDelayMs)
    }

    return this.persistPlayerMetrics(playerRows)
  }

  private async fetchSeasons(): Promise<DflSeason[]> {
    const xml = await this.pull(DFL_SERVICES.seasons)
    const root = parseXml(xml)
    return findAll(root, 'Season')
      .map((node) => ({
        seasonId: node.attrs.SeasonId ?? '',
        name: node.attrs.Season ?? '',
      }))
      .filter((season) => season.seasonId && season.name)
  }

  private async fetchClubFixtures(clubId: string, seasonId: string): Promise<DflFixture[]> {
    const competitions: string[] = []
    for (const competitionId of DFL_COMPETITION_IDS) {
      const xml = await this.pull(DFL_SERVICES.clubs, `${seasonId}_${competitionId}`)
      const clubIds = findAll(parseXml(xml), 'Club').map((node) => node.attrs.ClubId)
      if (clubIds.includes(clubId)) competitions.push(competitionId)
      await sleep(DFL_API_CONFIG.interCallDelayMs)
    }

    if (competitions.length === 0) return []

    const scheduleXml = await this.pull(DFL_SERVICES.schedule, seasonId)
    return findAll(parseXml(scheduleXml), 'Fixture')
      .map((node) => ({
        matchId: node.attrs.MatchId ?? node.attrs.MatchID ?? '',
        kickoff: node.attrs.PlannedKickoffTime ?? '',
        homeTeamId: node.attrs.HomeTeamId ?? '',
        awayTeamId: node.attrs.GuestTeamId ?? '',
        homeTeamName: node.attrs.HomeTeamName ?? '',
        awayTeamName: node.attrs.GuestTeamName ?? '',
      }))
      .filter((fixture) => fixture.matchId)
      .filter((fixture) => fixture.homeTeamId === clubId || fixture.awayTeamId === clubId)
  }

  private async fetchMatchPlayerMetrics(
    fixture: DflFixture,
    clubId: string
  ): Promise<DflPlayerMatchMetrics[]> {
    const infoXml = await this.pull(DFL_SERVICES.matchInfo, fixture.matchId)
    await sleep(DFL_API_CONFIG.interCallDelayMs)
    const distanceXml = await this.pull(DFL_SERVICES.distance, fixture.matchId)
    await sleep(DFL_API_CONFIG.interCallDelayMs)
    const eventXml = await this.pull(DFL_SERVICES.eventStats, fixture.matchId)
    await sleep(DFL_API_CONFIG.interCallDelayMs)
    const positionalXml = await this.pull(DFL_SERVICES.positionalStats, fixture.matchId)

    const general = findFirst(parseXml(infoXml), 'General')
    const kickoff =
      general?.attrs.KickoffTime || general?.attrs.PlannedKickoffTime || fixture.kickoff
    const matchDate = DateTime.fromISO(kickoff).toUTC().toISODate()
    if (!matchDate) return []

    const matchName =
      general?.attrs.MatchTitle?.replace(':', ' vs ') ||
      `${fixture.homeTeamName} vs ${fixture.awayTeamName}`
    const kickoffTime = DateTime.fromISO(kickoff).isValid
      ? DateTime.fromISO(kickoff).toFormat('HH:mm:ss')
      : null

    const byPerson = new Map<string, DflPlayerMatchMetrics>()

    const ensure = (personId: string, teamId: string | null): DflPlayerMatchMetrics => {
      const existing = byPerson.get(personId)
      if (existing) {
        if (!existing.teamId && teamId) existing.teamId = teamId
        return existing
      }
      const row: DflPlayerMatchMetrics = {
        personId,
        teamId,
        matchId: fixture.matchId,
        matchDate,
        matchName,
        kickoffTime,
        minutesPlayed: null,
        totalDistance: null,
        sprintDistance: null,
        intensiveRunDistance: null,
        maxSpeed: null,
        tacklesContested: null,
        tacklesWon: null,
      }
      byPerson.set(personId, row)
      return row
    }

    for (const team of findAll(parseXml(distanceXml), 'Team')) {
      const teamId = team.attrs.TeamId ?? null
      if (teamId && teamId !== clubId) continue
      for (const person of team.children.filter((child) => child.name === 'Person')) {
        const personId = person.attrs.PersonId
        if (!personId) continue
        const row = ensure(personId, teamId)
        row.totalDistance = toNumber(person.attrs.DistanceCovered)
        row.maxSpeed = toNumber(person.attrs.MaximalSpeed)
      }
    }

    for (const matchStat of findAll(parseXml(eventXml), 'MatchStatistic')) {
      if ((matchStat.attrs.Scope || 'match') !== 'match') continue
      for (const teamStat of matchStat.children.filter((child) => child.name === 'TeamStatistic')) {
        const teamId = teamStat.attrs.TeamId ?? null
        if (teamId && teamId !== clubId) continue
        for (const player of teamStat.children.filter(
          (child) => child.name === 'PlayerStatistic'
        )) {
          const personId = player.attrs.PlayerId
          if (!personId) continue
          const row = ensure(personId, teamId)
          row.tacklesContested = toNumber(player.attrs.TacklingGamesSum)
          row.tacklesWon = toNumber(player.attrs.TacklingGamesWon)
          if (row.minutesPlayed === null) {
            row.minutesPlayed = parseMinutesPlayed(player.attrs.PlayingTime)
          }
          if (row.totalDistance === null) {
            row.totalDistance = toNumber(player.attrs.DistanceCovered)
          }
          if (row.maxSpeed === null) {
            row.maxSpeed = toNumber(player.attrs.MaximumSpeed ?? player.attrs.MaximalSpeed)
          }
        }
      }
    }

    // sprint / intensive / real minutes from positional stats (04.07)
    for (const matchStat of findAll(parseXml(positionalXml), 'MatchStatistic')) {
      if ((matchStat.attrs.Scope || 'match') !== 'match') continue
      for (const teamStat of matchStat.children.filter((child) => child.name === 'TeamStatistic')) {
        const teamId = teamStat.attrs.TeamId ?? null
        if (teamId && teamId !== clubId) continue
        for (const player of teamStat.children.filter(
          (child) => child.name === 'PlayerStatistic'
        )) {
          const personId = player.attrs.PlayerId
          if (!personId) continue
          const row = ensure(personId, teamId)
          row.sprintDistance = toNumber(player.attrs.DistanceCoveredSprints)
          row.intensiveRunDistance = toNumber(player.attrs.DistanceCoveredIntensiveRuns)
          row.minutesPlayed =
            parseMinutesPlayed(player.attrs.MinutesPlayed) ??
            parseMinutesPlayed(player.attrs.PlayingTime) ??
            row.minutesPlayed ??
            parseMinutesPlayed(player.attrs.PlayingTimeGross)
        }
      }
    }

    return [...byPerson.values()].filter((row) => {
      if (row.teamId && row.teamId !== clubId) return false
      return (row.minutesPlayed ?? 0) > 0 || (row.totalDistance ?? 0) > 0 || (row.maxSpeed ?? 0) > 0
    })
  }

  private async persistPlayerMetrics(rows: DflPlayerMatchMetrics[]): Promise<DflImportResult> {
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.DFL)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (query) => query.where('clubId', this.maunaClubId))
    const athletes = new Map(
      providers
        .filter((provider) => provider.providerAthleteId && provider.athlete)
        .map((provider) => [String(provider.providerAthleteId), provider.athlete])
    )

    const athleteIds = new Set<string>()
    const dates = new Set<string>()
    const pending: Array<{
      athleteId: string
      date: string
      matchName: string | null
      kickoffTime: string | null
      label: string
      payload: Record<string, number>
    }> = []

    let skipped = 0
    for (const row of rows) {
      const athlete = athletes.get(row.personId)
      if (!athlete) {
        skipped++
        continue
      }

      athleteIds.add(athlete.id)
      dates.add(row.matchDate)

      const mapped = mapDflPlayerMetrics(row)
      pending.push({
        athleteId: athlete.id,
        date: row.matchDate,
        matchName: row.matchName,
        kickoffTime: row.kickoffTime,
        label: `${row.personId} | ${row.matchName || row.matchId}`,
        payload: Object.fromEntries(
          Object.entries(mapped).filter(([, value]) => value !== null)
        ) as Record<string, number>,
      })
    }

    const days =
      athleteIds.size > 0 && dates.size > 0
        ? await Day.query()
            .whereIn('athleteId', [...athleteIds])
            .whereIn('dateOfDay', [...dates])
        : []
    const dayByKey = new Map(
      days.map((day) => [`${day.athleteId}|${day.dateOfDay.toISODate()}`, day])
    )

    const missingDays = pending
      .map((item) => `${item.athleteId}|${item.date}`)
      .filter((key, index, arr) => arr.indexOf(key) === index && !dayByKey.has(key))
      .map((key) => {
        const [athleteId, date] = key.split('|')
        return {
          athleteId,
          dateOfDay: DateTime.fromISO(date, { zone: 'utc' }),
        }
      })

    if (missingDays.length > 0) {
      await Day.updateOrCreateMany(['athleteId', 'dateOfDay'], missingDays)
      const refreshedDays = await Day.query()
        .whereIn('athleteId', [...athleteIds])
        .whereIn('dateOfDay', [...dates])
      for (const day of refreshedDays) {
        dayByKey.set(`${day.athleteId}|${day.dateOfDay.toISODate()}`, day)
      }
    }

    const dayIds = [...dayByKey.values()].map((day) => day.id)
    const allActivities =
      dayIds.length > 0
        ? await SportActivity.query().whereIn('dayId', dayIds).orderBy('createdAt', 'asc')
        : []
    const activitiesByDay = new Map<string, SportActivity[]>()
    for (const activity of allActivities) {
      const list = activitiesByDay.get(activity.dayId)
      if (list) list.push(activity)
      else activitiesByDay.set(activity.dayId, [activity])
    }
    const activityByDayId = new Map<string, SportActivity>()
    for (const [dayId, dayActivities] of activitiesByDay) {
      activityByDayId.set(
        dayId,
        dayActivities.find((activity) => activity.gameActivity === true) ??
          dayActivities.find((activity) => activity.dataSource === 'statsports') ??
          dayActivities.find((activity) => activity.dataSource === 'dfl') ??
          dayActivities[0]
      )
    }

    const metricRows = await SportActivityMetric.query().whereIn('name', [...DFL_METRIC_NAMES])
    const metricsCatalog = new Map(
      metricRows.map((metric) => [metric.name, { id: metric.id, dataType: metric.dataType }])
    )

    let imported = 0
    let activitiesUpdated = 0
    let activitiesCreated = 0
    let failed = 0
    const errors: string[] = []
    const touchedActivities = new Set<string>()
    const calendarSynced = new Set<string>()
    const matchIds = new Set(rows.map((row) => row.matchId))

    const footballActivityTypeId = await getFootballActivityTypeId()

    for (const item of pending) {
      const day = dayByKey.get(`${item.athleteId}|${item.date}`)
      if (!day) {
        skipped++
        continue
      }

      let activity = activityByDayId.get(day.id)
      try {
        if (!activity) {
          const durationSeconds =
            item.payload.minutes_played != null
              ? Math.round(item.payload.minutes_played * 60)
              : null

          activity = await SportActivity.create({
            dayId: day.id,
            activityTypeId: footballActivityTypeId,
            dataSource: 'dfl',
            activityName: item.matchName,
            timeOfActivity: item.kickoffTime,
            durationSeconds,
            gameActivity: true,
            needsReview: false,
          })
          activityByDayId.set(day.id, activity)
          activitiesCreated++
        }

        let dirty = false
        if (item.matchName && activity.activityName !== item.matchName) {
          activity.activityName = item.matchName
          dirty = true
        }
        if (activity.gameActivity !== true) {
          activity.gameActivity = true
          dirty = true
        }
        if (item.kickoffTime && activity.timeOfActivity !== item.kickoffTime) {
          activity.timeOfActivity = item.kickoffTime
          dirty = true
        }
        if (
          activity.dataSource === 'dfl' &&
          item.payload.minutes_played != null &&
          activity.durationSeconds == null
        ) {
          activity.durationSeconds = Math.round(item.payload.minutes_played * 60)
          dirty = true
        }
        if (dirty) {
          await activity.save()
          if (!touchedActivities.has(activity.id)) {
            touchedActivities.add(activity.id)
            activitiesUpdated++
          }
        }

        if (Object.keys(item.payload).length > 0) {
          await this.metrics.storeEntityMetrics(activity.id, item.payload, undefined, {
            source: SPORT_ACTIVITY_METRIC_SOURCE.DFL,
            metricsCatalog,
          })
        }

        if (!calendarSynced.has(activity.id)) {
          calendarSynced.add(activity.id)
          await this.syncMatchCalendar(activity)
        }

        imported++
      } catch (error) {
        failed++
        errors.push(`${item.label} | ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return {
      matches: matchIds.size,
      imported,
      activitiesUpdated,
      activitiesCreated,
      skipped,
      failed,
      errors,
    }
  }

  private async syncMatchCalendar(activity: SportActivity): Promise<void> {
    try {
      await this.eventService.syncMatchActivityToCalendar(activity)
    } catch (error) {
      console.log(
        `  calendar sync failed for activity ${activity.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  private async pull(serviceId: string, parameterId?: string): Promise<string> {
    const path = parameterId
      ? `/DeliveryPlatform/REST/PullOnce/${this.clientId}/${serviceId}/${parameterId}`
      : `/DeliveryPlatform/REST/PullOnce/${this.clientId}/${serviceId}`

    let attempt = 0
    while (true) {
      try {
        const response = await this.client.get<string>(path)
        if (response.status !== 200) {
          throw new Error(`DFL ${serviceId} HTTP ${response.status}`)
        }
        return typeof response.data === 'string' ? response.data : String(response.data)
      } catch (error) {
        attempt++
        const retryable =
          axios.isAxiosError(error) &&
          (error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            error.message.includes('socket hang up') ||
            (error.response?.status !== undefined &&
              (error.response.status === 429 || error.response.status >= 500)))

        if (!retryable || attempt >= DFL_API_CONFIG.maxRetries) throw error

        const waitMs = 2_000 * 2 ** (attempt - 1)
        console.log(`  WARN ${serviceId}: retry ${attempt}/${DFL_API_CONFIG.maxRetries}`)
        await sleep(waitMs)
      }
    }
  }
}

function resolveSeason(seasons: DflSeason[], seasonName?: string): DflSeason {
  if (seasonName) {
    const byName = seasons.find((season) => season.name === seasonName)
    if (byName) return byName
    const byId = seasons.find((season) => season.seasonId === seasonName)
    if (byId) return byId
    throw new Error(`Unknown DFL season ${seasonName}`)
  }

  return preferredSeasons(seasons)[0]
}

function preferredSeasons(seasons: DflSeason[]): DflSeason[] {
  const now = DateTime.utc()
  const year = now.month >= 7 ? now.year : now.year - 1
  const preferredNames = [`${year}/${year + 1}`, `${year - 1}/${year}`]
  const ordered: DflSeason[] = []
  const seen = new Set<string>()

  for (const name of preferredNames) {
    const season = seasons.find((item) => item.name === name)
    if (!season || seen.has(season.seasonId)) continue
    ordered.push(season)
    seen.add(season.seasonId)
  }

  for (const season of [...seasons].sort((a, b) => b.seasonId.localeCompare(a.seasonId))) {
    if (seen.has(season.seasonId)) continue
    ordered.push(season)
    seen.add(season.seasonId)
  }

  if (ordered.length === 0) throw new Error('No DFL seasons returned by API')
  return ordered
}

/** Season "2021/2022" ends before mid-2022 StatSports coverage → skip. */
function seasonOverlapsMinDate(season: DflSeason, minDate: DateTime): boolean {
  const match = /^(\d{4})\/(\d{4})$/.exec(season.name)
  if (!match) return true
  const seasonEnd = DateTime.fromObject(
    { year: Number(match[2]), month: 6, day: 30 },
    { zone: 'utc' }
  ).endOf('day')
  return seasonEnd >= minDate
}

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

/**
 * Real on-pitch duration in minutes (not NormalizedPlayerMinutes).
 * Accepts HH:MM:SS, decimal minutes, or seconds (e.g. PlayingTimeGross).
 */
function parseMinutesPlayed(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(trimmed)
  if (match) {
    const hours = Number(match[1])
    const minutes = Number(match[2])
    const seconds = Number(match[3])
    if (![hours, minutes, seconds].every(Number.isFinite)) return null
    return Math.round((hours * 60 + minutes + seconds / 60) * 100) / 100
  }

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  // DFL PlayingTimeGross / PlayingTimeNet are in seconds when large
  if (numeric > 300) {
    return Math.round((numeric / 60) * 100) / 100
  }
  return Math.round(numeric * 100) / 100
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
