import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { READING_CLUB_ID, READING_STATSPORTS_NAME_ALIASES } from '#constants/reading.constants'
import { STATSSPORTS_PERIOD_METRICS } from '#constants/statsports.constants'
import type { ApiStatssportsRow, StatssportsContextValues } from '#constants/statsports.constants'
import type { StatssportsPersistResult } from '#contracts/statsports'
import Athlete from '#models_pg/athlete'
import AthleteProvider from '#models_pg/athlete_provider'
import Day from '#models_pg/day'
import Period from '#models_pg/period'
import PeriodMetric from '#models_pg/period_metric'
import SportActivity from '#models_pg/sport_activity'
import AthleteService from '#services/athlete_service'
import { EventService } from '#services/event_service'
import {
  PeriodMetricService,
  type PeriodMetricValueEntry,
} from '#services/period_metric_service'
import {
  buildPeriodProviderId,
  compactPeriodMetrics,
  computeSessionDurationSeconds,
  isStatsportsGameSession,
  normalizeActivityTime,
  resolvePeriodTimes,
  splitApiRow,
  toScalarString,
  toSessionDate,
} from '#utils/statsports'
import { getFootballActivityTypeId } from '#utils/football_activity'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

type PersistContext = {
  athleteByProviderId: Map<string, Athlete>
  athleteByName: Map<string, Athlete>
  footballActivityTypeId: string
  dayCache: Map<string, Day>
  sportActivityCache: Map<string, SportActivity>
  periodCache: Map<string, Period>
  calendarSyncedActivityIds: Set<string>
  periodMetricsByName: Map<string, PeriodMetric>
}

type PersistRowResult = {
  sportActivity: boolean
  period: boolean
  eventCreated: boolean
  eventLinked: boolean
  metricEntries: PeriodMetricValueEntry[]
}

const normalizePersonName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const personNameKey = (firstName: string, lastName: string): string =>
  `${normalizePersonName(firstName)}|${normalizePersonName(lastName)}`

const dayCacheKey = (athleteId: string, dateOfDay: string) => `${athleteId}|${dateOfDay}`

const sportActivityCacheKey = (dayId: string, timeOfActivity: string | number | null | undefined) =>
  `${dayId}|${normalizeActivityTime(timeOfActivity) ?? '__missing_time__'}`

const periodCacheKey = (sportActivityId: string, providerId: string) =>
  `${sportActivityId}|${providerId}`

const isPgUniqueViolation = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

export class StatssportsPersistService {
  private readonly athleteService = new AthleteService()
  private readonly eventService = new EventService()
  private readonly periodMetricService = new PeriodMetricService()

  constructor(private readonly clubId: string) {}

  async persistRows(rows: ApiStatssportsRow[]): Promise<StatssportsPersistResult> {
    const context = await this.createContext()
    const result: StatssportsPersistResult = {
      rows: rows.length,
      imported: 0,
      createdActivities: 0,
      createdPeriods: 0,
      createdEvents: 0,
      linkedEvents: 0,
      skippedNoPlayerId: 0,
      skippedNoAthlete: 0,
      failed: 0,
    }

    const startedAt = Date.now()
    logger.info(`STATSports club ${this.clubId} persisting rows=${rows.length}`)

    await this.detachOrphanedCalendarActivities()

    const metricEntries: PeriodMetricValueEntry[] = []
    let processed = 0
    for (const row of rows) {
      processed++
      const playerId = toScalarString(row.player_customPlayerId)
      const athlete = this.resolveAthlete(row, context)
      if (!athlete) {
        if (
          !playerId &&
          !toScalarString(row.session_player_id) &&
          !toScalarString(row.player_firstName)
        ) {
          result.skippedNoPlayerId++
        } else {
          result.skippedNoAthlete++
        }
      } else {
        try {
          const created = await this.persistRow(
            row,
            athlete,
            playerId ?? toScalarString(row.session_player_id) ?? athlete.id,
            context
          )
          result.imported++
          if (created.sportActivity) result.createdActivities++
          if (created.period) result.createdPeriods++
          if (created.eventCreated) result.createdEvents++
          if (created.eventLinked) result.linkedEvents++
          metricEntries.push(...created.metricEntries)
        } catch (error) {
          result.failed++
          const message = error instanceof Error ? error.message : String(error)
          logger.error(
            `STATSports persist failed for club ${this.clubId} player ${playerId}: ${message}`
          )
        }
      }

      if (processed % 50 === 0 || processed === rows.length) {
        logger.info(
          `STATSports club ${this.clubId} persist ${processed}/${rows.length} imported=${result.imported} activities=${result.createdActivities} periods=${result.createdPeriods} eventsCreated=${result.createdEvents} eventsLinked=${result.linkedEvents} skippedNoPlayerId=${result.skippedNoPlayerId} elapsedMs=${Date.now() - startedAt}`
        )
      }
    }

    if (metricEntries.length > 0) {
      const upsertStartedAt = Date.now()
      logger.info(
        `STATSports club ${this.clubId} upserting ${metricEntries.length} period metric values`
      )
      await this.periodMetricService.upsertPeriodMetricValues(metricEntries)
      logger.info(
        `STATSports club ${this.clubId} upserted ${metricEntries.length} period metric values in ${Date.now() - upsertStartedAt}ms`
      )
    }

    logger.info(
      `STATSports club ${this.clubId} persist done imported=${result.imported} activities=${result.createdActivities} periods=${result.createdPeriods} failed=${result.failed} elapsedMs=${Date.now() - startedAt}`
    )

    return result
  }

  private resolveAthlete(row: ApiStatssportsRow, context: PersistContext): Athlete | null {
    const customId = toScalarString(row.player_customPlayerId)
    if (customId) {
      const byCustomId = context.athleteByProviderId.get(customId)
      if (byCustomId) return byCustomId
    }
    const sessionId = toScalarString(row.session_player_id)
    if (sessionId) {
      const bySessionId = context.athleteByProviderId.get(sessionId)
      if (bySessionId) return bySessionId
    }
    const firstName = toScalarString(row.player_firstName) ?? ''
    const lastName = toScalarString(row.player_lastName) ?? ''
    return context.athleteByName.get(personNameKey(firstName, lastName)) ?? null
  }

  private async createContext(): Promise<PersistContext> {
    const providers = await AthleteProvider.query()
      .where('provider', ATHLETE_PROVIDER_TYPES.STATSPORTS)
      .whereNotNull('providerAthleteId')
      .preload('athlete', (query) => query.where('clubId', this.clubId))

    const athleteByProviderId = new Map<string, Athlete>()
    for (const provider of providers) {
      const providerAthleteId = toScalarString(provider.providerAthleteId)
      if (!providerAthleteId || !provider.athlete) continue
      athleteByProviderId.set(providerAthleteId, provider.athlete)
    }

    const athletes = await Athlete.query().where('clubId', this.clubId)
    const athleteByName = new Map<string, Athlete>()
    for (const athlete of athletes) {
      athleteByName.set(personNameKey(athlete.firstName, athlete.lastName), athlete)
    }
    if (this.clubId === READING_CLUB_ID) {
      for (const [from, to] of Object.entries(READING_STATSPORTS_NAME_ALIASES)) {
        const target = athleteByName.get(to)
        if (target) athleteByName.set(from, target)
      }
    }

    const periodMetrics = await PeriodMetric.query().whereIn('name', [...STATSSPORTS_PERIOD_METRICS])
    const periodMetricsByName = new Map(periodMetrics.map((metric) => [metric.name, metric]))
    const footballActivityTypeId = await getFootballActivityTypeId()

    return {
      athleteByProviderId,
      athleteByName,
      footballActivityTypeId,
      dayCache: new Map(),
      sportActivityCache: new Map(),
      periodCache: new Map(),
      calendarSyncedActivityIds: new Set(),
      periodMetricsByName,
    }
  }

  private async persistRow(
    row: ApiStatssportsRow,
    athlete: Athlete,
    playerId: string,
    context: PersistContext
  ): Promise<PersistRowResult> {
    const { context: rowContext, periodMetrics } = splitApiRow(row)
    const sessionDate = toSessionDate(rowContext.session_date)
    if (!sessionDate) {
      throw new Error(`Missing session_date for player ${playerId}`)
    }

    const activityDate = DateTime.fromISO(sessionDate, { zone: 'utc' })
    const sessionStartTime = rowContext.session_start_time ?? rowContext.drill_start_time
    const isGameSession = isStatsportsGameSession(rowContext.session_type)
    const normalizedSessionStart = normalizeActivityTime(sessionStartTime)
    const durationSeconds = computeSessionDurationSeconds(rowContext)
    const { startTime: drillStart, endTime: drillEnd } = resolvePeriodTimes(
      sessionDate,
      rowContext.drill_start_time,
      rowContext.drill_end_time,
      periodMetrics.kpi_totalTime
    )
    const providerId = buildPeriodProviderId(rowContext, periodMetrics)
    const metrics = compactPeriodMetrics(periodMetrics)

    const dayKey = dayCacheKey(athlete.id, sessionDate)
    let resolvedActivityKey = sportActivityCacheKey('', sessionStartTime)
    let periodKey: string | null = null

    const trx = await db.transaction()

    try {
      let day = context.dayCache.get(dayKey)
      if (!day) {
        day = await this.athleteService.getOrCreateDay(athlete.id, activityDate, trx)
        context.dayCache.set(dayKey, day)
      }

      resolvedActivityKey = sportActivityCacheKey(day.id, sessionStartTime)
      let sportActivity: SportActivity | null =
        context.sportActivityCache.get(resolvedActivityKey) ?? null
      let createdSportActivity = false

      if (!sportActivity) {
        const existing = await this.findExistingActivity(
          day.id,
          providerId,
          normalizedSessionStart,
          context.footballActivityTypeId,
          trx
        )
        sportActivity = existing.sportActivity
        if (sportActivity && existing.period) {
          periodKey = periodCacheKey(sportActivity.id, providerId)
          context.periodCache.set(periodKey, existing.period)
        }

        if (sportActivity) {
          let dirty = false
          if (isGameSession && sportActivity.gameActivity !== true) {
            sportActivity.gameActivity = true
            dirty = true
          }
          if (sportActivity.dataSource !== 'statsports') {
            sportActivity.dataSource = 'statsports'
            dirty = true
          }
          if (dirty) await sportActivity.useTransaction(trx).save()
        } else {
          const created = await this.createSportActivity(
            {
              dayId: day.id,
              activityTypeId: context.footballActivityTypeId,
              dataSource: 'statsports',
              activityName: toScalarString(rowContext.session_type),
              timeOfActivity: normalizedSessionStart,
              durationSeconds,
              gameActivity: isGameSession,
            },
            trx
          )
          sportActivity = created.sportActivity
          createdSportActivity = created.created
        }

        context.sportActivityCache.set(resolvedActivityKey, sportActivity)
      }

      periodKey = periodCacheKey(sportActivity.id, providerId)
      let period: Period | null = context.periodCache.get(periodKey) ?? null
      let createdPeriod = false

      if (!period) {
        period = await Period.query({ client: trx })
          .where('sportActivityId', sportActivity.id)
          .where('providerId', providerId)
          .first()

        if (!period) {
          period = await Period.create(
            {
              sportActivityId: sportActivity.id,
              providerId,
              name: toScalarString(rowContext.drill_name),
              startTime: drillStart,
              endTime: drillEnd,
            },
            { client: trx }
          )
          createdPeriod = true
        }

        context.periodCache.set(periodKey, period)
      }

      const metricEntries = this.periodMetricService.buildPeriodMetricValueEntries(
        period.id,
        metrics,
        context.periodMetricsByName
      )

      await trx.commit()

      const calendar = await this.syncActivityToCalendar(
        sportActivity,
        sessionDate,
        rowContext,
        durationSeconds,
        context
      )

      return {
        sportActivity: createdSportActivity,
        period: createdPeriod,
        eventCreated: calendar.eventCreated,
        eventLinked: calendar.eventLinked,
        metricEntries,
      }
    } catch (error) {
      if (!trx.isCompleted) {
        await trx.rollback()
      }
      context.dayCache.delete(dayKey)
      context.sportActivityCache.delete(resolvedActivityKey)
      if (periodKey) context.periodCache.delete(periodKey)
      throw error
    }
  }

  private async syncActivityToCalendar(
    sportActivity: SportActivity,
    sessionDate: string,
    rowContext: StatssportsContextValues,
    durationSeconds: number | null,
    context: PersistContext
  ): Promise<{ eventCreated: boolean; eventLinked: boolean }> {
    if (context.calendarSyncedActivityIds.has(sportActivity.id) || sportActivity.eventId) {
      return { eventCreated: false, eventLinked: false }
    }
    context.calendarSyncedActivityIds.add(sportActivity.id)

    const sessionRange = resolvePeriodTimes(
      sessionDate,
      rowContext.session_start_time ?? rowContext.drill_start_time,
      rowContext.session_end_time ?? rowContext.drill_end_time,
      durationSeconds
    )
    const timeRange =
      sessionRange.startTime && sessionRange.endTime
        ? { startTime: sessionRange.startTime, endTime: sessionRange.endTime }
        : undefined

    try {
      const synced = await this.eventService.syncStatssportsActivityToCalendar(
        sportActivity,
        timeRange
      )
      if (!synced) return { eventCreated: false, eventLinked: false }
      sportActivity.eventId = synced.eventId
      return { eventCreated: synced.created, eventLinked: !synced.created }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(
        `STATSports calendar sync failed for club ${this.clubId} activity ${sportActivity.id}: ${message}`
      )
      return { eventCreated: false, eventLinked: false }
    }
  }

  private async detachOrphanedCalendarActivities(): Promise<void> {
    const orphans = await SportActivity.query()
      .whereNull('dayId')
      .whereNotNull('eventId')
      .whereHas('event', (query) => query.where('clubId', this.clubId))

    if (orphans.length === 0) return

    await SportActivity.query()
      .whereIn(
        'id',
        orphans.map((orphan) => orphan.id)
      )
      .update({ eventId: null })

    logger.warn(
      `STATSports club ${this.clubId} detached ${orphans.length} activities with null day_id from calendar events`
    )
  }

  private async createSportActivity(
    payload: {
      dayId: string
      activityTypeId: string
      dataSource: 'statsports'
      activityName: string | null
      timeOfActivity: string | null
      durationSeconds: number | null
      gameActivity: boolean
    },
    trx: TransactionClientContract
  ): Promise<{ sportActivity: SportActivity; created: boolean }> {
    try {
      const sportActivity = await SportActivity.create(payload, { client: trx })
      return { sportActivity, created: true }
    } catch (error) {
      if (!isPgUniqueViolation(error)) throw error

      const sportActivity = await this.findActivityByUniqueKey(
        payload.dayId,
        payload.activityTypeId,
        payload.timeOfActivity,
        trx
      )
      if (!sportActivity) throw error
      return { sportActivity, created: false }
    }
  }

  private async findActivityByUniqueKey(
    dayId: string,
    activityTypeId: string,
    timeOfActivity: string | null,
    trx: TransactionClientContract
  ): Promise<SportActivity | null> {
    const query = SportActivity.query({ client: trx })
      .where('dayId', dayId)
      .where('activityTypeId', activityTypeId)

    if (timeOfActivity) query.where('timeOfActivity', timeOfActivity)
    else query.whereNull('timeOfActivity')

    return query.first()
  }

  private async findExistingActivity(
    dayId: string,
    providerId: string,
    normalizedSessionStart: string | null,
    footballActivityTypeId: string,
    trx: TransactionClientContract
  ): Promise<{ sportActivity: SportActivity | null; period: Period | null }> {
    if (providerId) {
      const existingPeriod = await Period.query({ client: trx })
        .where('providerId', providerId)
        .whereHas('sportActivity', (query) => {
          query.where('dayId', dayId).where('dataSource', 'statsports')
        })
        .preload('sportActivity')
        .first()

      if (existingPeriod?.sportActivity) {
        return { sportActivity: existingPeriod.sportActivity, period: existingPeriod }
      }
    }

    const byUniqueKey = await this.findActivityByUniqueKey(
      dayId,
      footballActivityTypeId,
      normalizedSessionStart,
      trx
    )
    if (byUniqueKey) {
      return { sportActivity: byUniqueKey, period: null }
    }

    if (!normalizedSessionStart) {
      return { sportActivity: null, period: null }
    }

    const sportActivity = await SportActivity.query({ client: trx })
      .where('dayId', dayId)
      .where('dataSource', 'statsports')
      .where('timeOfActivity', normalizedSessionStart)
      .first()

    return { sportActivity, period: null }
  }
}
