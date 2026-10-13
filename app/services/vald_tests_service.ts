import Athlete from '#models_pg/athlete'
import ValdTest from '#models_pg/vald_test'
import ValdTrial from '#models_pg/vald_trial'
import type {
  ValdTestListFilters,
  ValdTestListItem,
  ValdTestListResponse,
  ValdTrendResponse,
  ValdTrendSeries,
} from '#contracts/vald_test_list'
import {
  defaultValdMetricForTestType,
  VALD_TRIAL_METRIC_KEYS,
  VALD_TRIAL_METRIC_UNITS,
  type ValdTrialMetricKey,
} from '#constants/vald_metrics.constants'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

const VALD_TESTS_CURSOR_PAGE_SIZE = 20

const TRIAL_METRIC_READERS: Record<ValdTrialMetricKey, (trial: ValdTrial) => number | null> = {
  trial_jump_height: (trial) => trial.trialJumpHeight,
  trial_rsi_modified: (trial) => trial.trialRsiModified,
  trial_peak_takeoff_power: (trial) => trial.trialPeakTakeoffPower,
  trial_concentric_rfd: (trial) => trial.trialConcentricRfd,
  trial_peak_landing_force: (trial) => trial.trialPeakLandingForce,
  trial_time_to_stabilisation: (trial) => trial.trialTimeToStabilisation,
  trial_rsi: (trial) => trial.trialRsi,
  trial_eccentric_braking_rfd: (trial) => trial.trialEccentricBrakingRfd,
}

type DayBounds = {
  from?: string
  to?: string
  seasonStartDate?: DateTime | null
  seasonEndDate?: DateTime | null
}

export type ValdDailyMaxRow = {
  athleteId: string
  dateOfDay: string
  testType: string
} & Partial<Record<ValdTrialMetricKey, number | string | null>>

export const fetchValdDailyMaxRows = async (input: {
  clubId: string
  testTypes: string[]
  metricKeys: ValdTrialMetricKey[]
  athleteIds?: string[]
  from?: string | null
  to?: string | null
}): Promise<ValdDailyMaxRow[]> => {
  if (input.testTypes.length === 0 || input.metricKeys.length === 0) return []

  const query = ValdTest.query()
    .join('days', 'days.id', 'vald_tests.day_id')
    .join('athletes', 'athletes.id', 'days.athlete_id')
    .join('vald_trials', 'vald_trials.vald_test_id', 'vald_tests.id')
    .where('athletes.club_id', input.clubId)
    .whereIn('vald_tests.test_type', input.testTypes)
    .groupBy('days.athlete_id', 'days.date_of_day', 'vald_tests.test_type')
    .orderBy('days.date_of_day', 'asc')
    .select(
      db.raw('days.athlete_id as "athleteId"'),
      db.raw(`to_char(days.date_of_day, 'YYYY-MM-DD') as "dateOfDay"`),
      db.raw('vald_tests.test_type as "testType"'),
      ...input.metricKeys.map((key) => db.raw(`MAX(vald_trials.${key}) as "${key}"`))
    )

  if (input.athleteIds?.length) query.whereIn('days.athlete_id', input.athleteIds)
  if (input.from) query.where('days.date_of_day', '>=', input.from)
  if (input.to) query.where('days.date_of_day', '<=', input.to)

  return query.pojo<ValdDailyMaxRow>()
}

const finiteMetric = (value: number | string | null | undefined): number | null => {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export default class ValdTestsService {
  async getValdTestsByClub(
    clubId: string,
    filters?: ValdTestListFilters,
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<ValdTestListResponse> {
    const currentOffset = filters?.cursor ?? 0
    const bounds = {
      from: filters?.from,
      to: filters?.to,
      seasonStartDate,
      seasonEndDate,
    }

    const testsQuery = this.scopeClubDays(ValdTest.query(), clubId, bounds, filters?.athleteIds)
      .select('vald_tests.*')
      .orderBy('days.date_of_day', 'desc')
      .orderBy('vald_tests.id', 'desc')
      .limit(VALD_TESTS_CURSOR_PAGE_SIZE)
      .offset(currentOffset)
      .preload('day', (dayQuery) => {
        dayQuery.preload('athlete', (athleteQuery) => {
          athleteQuery.select('id', 'firstName', 'lastName', 'clubId').preload('profilePicture')
        })
      })
      .preload('trials')

    if (filters?.testType) testsQuery.where('vald_tests.test_type', filters.testType)

    const tests = await testsQuery

    return {
      data: tests.flatMap((test) => {
        const item = this.mapTestToListItem(test)
        return item ? [item] : []
      }),
      meta: {
        nextCursor:
          tests.length === VALD_TESTS_CURSOR_PAGE_SIZE
            ? currentOffset + VALD_TESTS_CURSOR_PAGE_SIZE
            : null,
      },
    }
  }

  async getAvailableTestTypes(
    clubId: string,
    filters: { athleteIds?: string[]; from?: string; to?: string },
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<string[]> {
    const rows = await this.scopeClubDays(
      ValdTest.query(),
      clubId,
      {
        from: filters.from,
        to: filters.to,
        seasonStartDate,
        seasonEndDate,
      },
      filters.athleteIds
    )
      .distinct('vald_tests.test_type')
      .orderBy('vald_tests.test_type', 'asc')
      .select('vald_tests.test_type')
      .pojo<{ test_type: string }>()

    return rows.map((row) => row.test_type).filter(Boolean)
  }

  async getTrend(
    clubId: string,
    athleteIds: string[],
    testType: string,
    seasonStartDate?: DateTime | null,
    seasonEndDate?: DateTime | null
  ): Promise<ValdTrendResponse | null> {
    const uniqueAthleteIds = [...new Set(athleteIds)]
    const athletes = await Athlete.query().where('clubId', clubId).whereIn('id', uniqueAthleteIds)
    if (athletes.length !== uniqueAthleteIds.length) return null

    const rows = await fetchValdDailyMaxRows({
      clubId,
      testTypes: [testType],
      metricKeys: VALD_TRIAL_METRIC_KEYS,
      athleteIds: uniqueAthleteIds,
      from: seasonStartDate?.toISODate(),
      to: seasonEndDate?.toISODate(),
    })

    const seriesByAthlete = new Map<string, Record<string, ValdTrendSeries>>()
    for (const row of rows) {
      const seriesByMetric = seriesByAthlete.get(row.athleteId) ?? {}
      seriesByAthlete.set(row.athleteId, seriesByMetric)

      for (const key of VALD_TRIAL_METRIC_KEYS) {
        const value = finiteMetric(row[key])
        if (value == null) continue
        const series = seriesByMetric[key] ?? { unit: VALD_TRIAL_METRIC_UNITS[key], points: [] }
        series.points.push({ date: row.dateOfDay, value })
        seriesByMetric[key] = series
      }
    }

    return {
      data: {
        testType,
        athletes: uniqueAthleteIds.map((athleteId) => ({
          athleteId,
          seriesByMetric: seriesByAthlete.get(athleteId) ?? {},
        })),
      },
    }
  }

  private scopeClubDays(
    query: ModelQueryBuilderContract<typeof ValdTest>,
    clubId: string,
    bounds: DayBounds,
    athleteIds?: string[]
  ) {
    query
      .join('days', 'days.id', 'vald_tests.day_id')
      .join('athletes', 'athletes.id', 'days.athlete_id')
      .where('athletes.club_id', clubId)

    if (athleteIds?.length) query.whereIn('days.athlete_id', athleteIds)
    this.applyDayBounds(query, bounds)
    return query
  }

  private applyDayBounds(query: ModelQueryBuilderContract<typeof ValdTest>, bounds: DayBounds) {
    const seasonFrom = bounds.seasonStartDate?.toISODate()
    const seasonTo = bounds.seasonEndDate?.toISODate()
    if (seasonFrom) query.where('days.date_of_day', '>=', seasonFrom)
    if (seasonTo) query.where('days.date_of_day', '<=', seasonTo)
    if (bounds.from) query.where('days.date_of_day', '>=', bounds.from)
    if (bounds.to) query.where('days.date_of_day', '<=', bounds.to)
  }

  private mapTestToListItem(test: ValdTest): ValdTestListItem | null {
    const day = test.day
    const athlete = day?.athlete
    const measuredAt = day?.dateOfDay?.toISODate()
    if (!day || !athlete || !measuredAt) return null

    const primaryMetricKey = defaultValdMetricForTestType(test.testType)
    let bestValue: number | null = null
    const trials = [...(test.trials ?? [])]
      .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
      .map((trial, index) => ({
        id: trial.id,
        trialNumber: index + 1,
        metrics: VALD_TRIAL_METRIC_KEYS.flatMap((key) => {
          const value = finiteMetric(TRIAL_METRIC_READERS[key](trial))
          if (value == null) return []
          if (key === primaryMetricKey && (bestValue == null || value > bestValue)) {
            bestValue = value
          }
          return [{ key, value, unit: VALD_TRIAL_METRIC_UNITS[key] }]
        }),
      }))

    return {
      id: test.id,
      testType: test.testType,
      primaryMetricKey,
      value: bestValue == null ? null : String(bestValue),
      unit: bestValue == null ? null : VALD_TRIAL_METRIC_UNITS[primaryMetricKey] || null,
      measuredAt,
      athleteId: athlete.id,
      athlete: {
        id: athlete.id,
        name: athlete.name,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        profilePicture: athlete.profilePicture ?? null,
      },
      trials,
    }
  }
}
