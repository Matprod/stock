import {
  HAMBURG_ML_DATE_FORMAT,
  HAMBURG_ML_PERSIST_CHUNK_SIZE,
} from '#constants/hamburg_ml.constants'
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants'
import { HAMBOURG_CLUB_ID } from '#constants/hambourg.constants'
import { INSIGHT_TRESHOLD_TYPE, type PredictionType } from '#constants/insight.constants'
import type { EntityType } from '#contracts/summary'
import type {
  HamburgMlPerformanceFeatureImportance,
  HamburgMlPerformanceOptimalFeature,
  HamburgMlPerformancePredictionRow,
} from '#contracts/hamburg'
import Athlete from '#models_pg/athlete'
import AthleteProvider from '#models_pg/athlete_provider'
import ClubInsight from '#models_pg/club_insight'
import Day from '#models_pg/day'
import FeatureImportance from '#models_pg/feature_importance'
import Insight from '#models_pg/insight'
import {
  athleteDayKey,
  loadInjuredAthleteDayKeys,
} from '#services/machine_learning/hamburg/hamburg_injured_athlete_days'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFORMANCE_CATEGORY: PredictionType = 'performance'
const ENTITY_TYPES = new Set<EntityType>(['activity', 'health', 'sleep', 'nutrition'])

type PersistRow = {
  athleteId: string | null
  personId: string | null
  dateOfDay: string
  dayId: string | null
  performanceScore: number
  featureImportances: HamburgMlPerformanceFeatureImportance[]
  optimalFeatures: HamburgMlPerformanceOptimalFeature[]
}

export class HamburgPerformancePersistService {
  async persist(rows: HamburgMlPerformancePredictionRow[]): Promise<void> {
    const parsed = this.collectRows(rows)
    if (parsed.length === 0) return

    const trx = await db.transaction()
    try {
      await this.resolveAthletes(parsed, trx)
      const withAthlete = parsed.filter((row) => row.athleteId)
      if (withAthlete.length === 0) {
        await trx.commit()
        return
      }

      const injuredKeys = await loadInjuredAthleteDayKeys(
        withAthlete.map((row) => ({
          athleteId: row.athleteId!,
          dateOfDay: row.dateOfDay,
        })),
        trx
      )
      const ready = withAthlete.filter(
        (row) => !injuredKeys.has(athleteDayKey(row.athleteId!, row.dateOfDay))
      )
      const injuredRows = withAthlete.filter((row) =>
        injuredKeys.has(athleteDayKey(row.athleteId!, row.dateOfDay))
      )

      await this.clearInjuredScores(injuredRows, trx)

      if (ready.length === 0) {
        await trx.commit()
        logger.info(
          `Hamburg ML predict/performance-v1: skipped ${injuredRows.length} injured athlete-day(s), persisted 0`
        )
        return
      }

      await this.attachDays(ready, trx)
      await this.updateScores(ready, trx)
      const featureCount = await this.replaceFeatureImportances(ready, trx)

      await trx.commit()
      logger.info(
        `Hamburg ML predict/performance-v1: persisted ${ready.length} day score(s), ${featureCount} feature importance(s), skippedInjured=${injuredRows.length}`
      )
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  private collectRows(rows: HamburgMlPerformancePredictionRow[]): PersistRow[] {
    const collected: PersistRow[] = []

    for (const row of rows) {
      const dateOfDay = this.parseDate(row.date)
      const performanceScore = this.toRoundedScore(row.score_overall)
      if (!dateOfDay || performanceScore === null) continue

      collected.push({
        athleteId: this.asUuid(row.id),
        personId: this.asPersonId(row.PersonId),
        dateOfDay,
        dayId: null,
        performanceScore,
        featureImportances: row.feature_importances ?? [],
        optimalFeatures: row.optimal_features ?? [],
      })
    }

    return collected
  }

  private async resolveAthletes(
    rows: PersistRow[],
    trx: TransactionClientContract
  ): Promise<void> {
    const uuids = [...new Set(rows.map((row) => row.athleteId).filter((id): id is string => Boolean(id)))]
    const known = new Set<string>()

    if (uuids.length > 0) {
      const athletes = await Athlete.query({ client: trx }).whereIn('id', uuids).select('id')
      for (const athlete of athletes) known.add(athlete.id)
    }

    for (const row of rows) {
      if (row.athleteId && !known.has(row.athleteId)) row.athleteId = null
    }

    const personIds = [
      ...new Set(
        rows
          .filter((row) => !row.athleteId && row.personId)
          .map((row) => row.personId as string)
      ),
    ]
    if (personIds.length === 0) {
      this.warnUnresolved(rows)
      return
    }

    const providers = await AthleteProvider.query({ client: trx })
      .where('provider', ATHLETE_PROVIDER_TYPES.SAP)
      .whereIn('providerAthleteId', personIds)

    const athleteByPersonId = new Map<string, string>()
    for (const provider of providers) {
      if (!provider.providerAthleteId) continue
      athleteByPersonId.set(provider.providerAthleteId.toUpperCase(), provider.athleteId)
    }

    for (const row of rows) {
      if (row.athleteId || !row.personId) continue
      row.athleteId = athleteByPersonId.get(row.personId.toUpperCase()) ?? null
    }

    this.warnUnresolved(rows)
  }

  private warnUnresolved(rows: PersistRow[]): void {
    const missing = rows.filter((row) => !row.athleteId)
    if (missing.length === 0) return
    logger.warn(
      `Hamburg ML predict/performance-v1: skipped ${missing.length} row(s) without athlete id (${missing
        .slice(0, 5)
        .map((row) => row.personId ?? row.dateOfDay)
        .join(', ')})`
    )
  }

  private async attachDays(rows: PersistRow[], trx: TransactionClientContract): Promise<void> {
    const athleteIds = [...new Set(rows.map((row) => row.athleteId).filter((id): id is string => Boolean(id)))]
    const dates = [...new Set(rows.map((row) => row.dateOfDay))]
    const daysByAthleteDate = new Map<string, Day>()

    const existing = await Day.query({ client: trx })
      .whereIn('athleteId', athleteIds)
      .whereIn('dateOfDay', dates)
    for (const day of existing) {
      daysByAthleteDate.set(
        `${day.athleteId}|${day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT)}`,
        day
      )
    }

    const missing = [
      ...new Map(
        rows
          .filter(
            (row) =>
              row.athleteId && !daysByAthleteDate.has(`${row.athleteId}|${row.dateOfDay}`)
          )
          .map((row) => [
            `${row.athleteId}|${row.dateOfDay}`,
            {
              athleteId: row.athleteId!,
              dateOfDay: DateTime.fromISO(row.dateOfDay, { zone: 'utc' }),
            },
          ])
      ).values(),
    ]

    if (missing.length > 0) {
      await Day.updateOrCreateMany(['athleteId', 'dateOfDay'], missing, { client: trx })
      const refreshed = await Day.query({ client: trx })
        .whereIn(
          'athleteId',
          missing.map((day) => day.athleteId)
        )
        .whereIn(
          'dateOfDay',
          missing.map((day) => day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT))
        )
      for (const day of refreshed) {
        daysByAthleteDate.set(
          `${day.athleteId}|${day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT)}`,
          day
        )
      }
    }

    for (const row of rows) {
      row.dayId = daysByAthleteDate.get(`${row.athleteId}|${row.dateOfDay}`)?.id ?? null
    }
  }

  private async updateScores(rows: PersistRow[], trx: TransactionClientContract): Promise<void> {
    const latestByDay = new Map<string, number>()
    for (const row of rows) {
      if (!row.dayId) continue
      latestByDay.set(row.dayId, row.performanceScore)
    }

    for (const [dayId, performanceScore] of latestByDay) {
      await Day.query({ client: trx }).where('id', dayId).update({ performanceScore })
    }
  }

  private async clearInjuredScores(
    rows: PersistRow[],
    trx: TransactionClientContract
  ): Promise<void> {
    if (rows.length === 0) return

    const athleteIds = [
      ...new Set(rows.map((row) => row.athleteId).filter((id): id is string => Boolean(id))),
    ]
    const dates = [...new Set(rows.map((row) => row.dateOfDay))]
    const injuredKeys = new Set(
      rows.map((row) => athleteDayKey(row.athleteId!, row.dateOfDay))
    )

    const days = await Day.query({ client: trx })
      .whereIn('athleteId', athleteIds)
      .whereIn('dateOfDay', dates)
      .select(['id', 'athleteId', 'dateOfDay'])

    const dayIds = days
      .filter((day) =>
        injuredKeys.has(
          athleteDayKey(day.athleteId, day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT))
        )
      )
      .map((day) => day.id)

    if (dayIds.length === 0) return

    await Day.query({ client: trx }).whereIn('id', dayIds).update({ performanceScore: null })
    await FeatureImportance.query({ client: trx })
      .whereIn('dayId', dayIds)
      .where('category', PERFORMANCE_CATEGORY)
      .delete()
  }

  private async replaceFeatureImportances(
    rows: PersistRow[],
    trx: TransactionClientContract
  ): Promise<number> {
    const dayIds = [...new Set(rows.map((row) => row.dayId).filter((id): id is string => Boolean(id)))]
    if (dayIds.length === 0) return 0

    const names = [
      ...new Set(
        rows.flatMap((row) => [
          ...row.featureImportances.map((feature) => feature.name),
          ...row.optimalFeatures.map((feature) => feature.feature),
        ])
      ),
    ]
    const insightByName = await this.ensureInsights(names, trx)

    const entries = this.collectFeatureEntries(rows, insightByName)
    await FeatureImportance.query({ client: trx })
      .whereIn('dayId', dayIds)
      .where('category', PERFORMANCE_CATEGORY)
      .delete()

    for (let i = 0; i < entries.length; i += HAMBURG_ML_PERSIST_CHUNK_SIZE) {
      await FeatureImportance.createMany(entries.slice(i, i + HAMBURG_ML_PERSIST_CHUNK_SIZE), {
        client: trx,
      })
    }

    return entries.length
  }

  private async ensureInsights(
    names: string[],
    trx: TransactionClientContract
  ): Promise<Map<string, string>> {
    if (names.length === 0) return new Map()

    const existing = await Insight.query({ client: trx }).whereIn('variableName', names)
    const insightByName = new Map(existing.map((insight) => [insight.variableName, insight.id]))

    const missing = names.filter((name) => !insightByName.has(name))
    if (missing.length > 0) {
      await Insight.createMany(
        missing.map((variableName) => ({
          variableName,
          name: variableName,
          description: variableName,
          canTooHigh: false,
          canTooLow: false,
          tresholdType: INSIGHT_TRESHOLD_TYPE.ABSOLUTE,
        })),
        { client: trx }
      )
      const created = await Insight.query({ client: trx }).whereIn('variableName', missing)
      for (const insight of created) {
        insightByName.set(insight.variableName, insight.id)
      }
      logger.info(
        `Hamburg ML predict/performance-v1: created ${missing.length} insight(s) (${missing.join(', ')})`
      )
    }

    const insightIds = [...new Set(insightByName.values())]
    const linked = await ClubInsight.query({ client: trx })
      .where('clubId', HAMBOURG_CLUB_ID)
      .whereIn('insightId', insightIds)
    const linkedIds = new Set(linked.map((row) => row.insightId))
    const toLink = insightIds.filter((id) => !linkedIds.has(id))

    if (toLink.length > 0) {
      await ClubInsight.createMany(
        toLink.map((insightId) => ({
          clubId: HAMBOURG_CLUB_ID,
          insightId,
        })),
        { client: trx }
      )
    }

    return insightByName
  }

  private collectFeatureEntries(
    rows: PersistRow[],
    insightByName: Map<string, string>
  ): Array<{
    dayId: string
    type: EntityType
    category: PredictionType
    contribPct: number | null
    value: number
    optimal: number | null
    shapValue: number | null
    insightId: string
  }> {
    const entries: Array<{
      dayId: string
      type: EntityType
      category: PredictionType
      contribPct: number | null
      value: number
      optimal: number | null
      shapValue: number | null
      insightId: string
    }> = []

    for (const row of rows) {
      if (!row.dayId) continue

      for (const feature of row.featureImportances) {
        const insightId = insightByName.get(feature.name)
        if (!insightId || !ENTITY_TYPES.has(feature.type)) continue
        entries.push({
          dayId: row.dayId,
          type: feature.type,
          category: PERFORMANCE_CATEGORY,
          contribPct: feature.contrib_pct ?? null,
          value: feature.value ?? 0,
          optimal: feature.optimal ?? null,
          shapValue: feature.shap_value ?? null,
          insightId,
        })
      }

      for (const feature of row.optimalFeatures) {
        const insightId = insightByName.get(feature.feature)
        if (!insightId || !ENTITY_TYPES.has(feature.type)) continue
        const stored = feature.value ?? 0
        entries.push({
          dayId: row.dayId,
          type: feature.type,
          category: PERFORMANCE_CATEGORY,
          contribPct: null,
          value: stored,
          optimal: stored,
          shapValue: feature.shap_value ?? 0,
          insightId,
        })
      }
    }

    return entries
  }

  private asUuid(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return UUID_RE.test(trimmed) ? trimmed : null
  }

  private asPersonId(value: string | null | undefined): string | null {
    if (!value) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private parseDate(value: string | null | undefined): string | null {
    if (!value) return null
    const date = DateTime.fromISO(value, { zone: 'utc' })
    return date.isValid ? date.toFormat(HAMBURG_ML_DATE_FORMAT) : null
  }

  private toRoundedScore(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric)) return null
    return Math.round(numeric)
  }
}
