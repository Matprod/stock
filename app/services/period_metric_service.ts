import { CLUB_METRICS_CACHE_TTL_MS } from '#constants/agent.constants'
import { METRIC_DATA_TYPE, type MetricDataType } from '#constants/metrics.constants'
import { getChatbotMetricWhitelist } from '#constants/chatbot.constants'
import PeriodMetric from '#models_pg/period_metric'
import Period from '#models_pg/period'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type SportActivity from '#models_pg/sport_activity'
import {
  queryClubPeriodMetricsByWhitelist,
  queryClubPeriodMetricsInWindow,
  queryPeriodMetricUnitsByNames,
  type ClubPeriodMetricRow,
} from '#utils/agent/agent_sql'

export type PeriodMetricValueEntry = {
  periodId: string
  metricId: string
  value: string
}

const PERIOD_METRIC_VALUE_UPSERT_CHUNK = 500

const clubMetricsCache = new Map<string, { at: number; rows: ClubPeriodMetricRow[] }>()

const pruneClubMetricsCache = (): void => {
  const now = Date.now()
  for (const [key, entry] of clubMetricsCache) {
    if (now - entry.at >= CLUB_METRICS_CACHE_TTL_MS) clubMetricsCache.delete(key)
  }
}

export interface PeriodValidationOptions {
  dataSource?: string | string[]
}

export interface MetricValidationOptions {
  allowedMetricNames?: Set<string> | string[]
}

export interface TrainingLoadRecalculator {
  computeBasketballExternalLoad(
    activityId: string,
    options?: {
      useHistorical?: boolean
      positionName?: string
      historicalActivities?: SportActivity[]
      updateTrainingLoad?: boolean
    }
  ): Promise<number | null>
}

export class PeriodMetricService {
  private convertValueToString(value: string | number, dataType: MetricDataType): string {
    switch (dataType) {
      case METRIC_DATA_TYPE.INTEGER:
        return String(Math.round(Number(value)))
      case METRIC_DATA_TYPE.BOOLEAN:
        return value === '1' || value === 'true' || Number(value) !== 0 ? 'true' : 'false'
      case METRIC_DATA_TYPE.FLOAT:
        return String(Number(value))
      case METRIC_DATA_TYPE.STRING:
      default:
        return String(value)
    }
  }

  public async storePeriodMetrics(
    period: Period,
    metricValues: Record<string, string | number | null>,
    options?: {
      metricNames?: string[]
      transaction?: TransactionClientContract
      metricsMap?: Map<string, PeriodMetric>
    }
  ): Promise<void> {
    const providedTrx = options?.transaction
    const trx = providedTrx || (await db.transaction())
    const shouldCommit = !providedTrx

    try {
      const metricsMap =
        options?.metricsMap ??
        new Map(
          (
            await PeriodMetric.query({ client: trx }).whereIn(
              'name',
              options?.metricNames || Object.keys(metricValues)
            )
          ).map((m) => [m.name, m])
        )

      const entries = this.buildPeriodMetricValueEntries(period.id, metricValues, metricsMap)
      await this.upsertPeriodMetricValues(entries, { transaction: trx })

      if (shouldCommit) await trx.commit()
    } catch (error) {
      if (shouldCommit && !trx.isCompleted) {
        await trx.rollback()
      }
      throw error
    }
  }

  public async updatePeriodMetrics(
    periodId: string,
    metrics: Record<string, string | number>,
    options?: {
      periodValidation?: PeriodValidationOptions
      metricValidation?: MetricValidationOptions
      trainingLoadRecalculator?: TrainingLoadRecalculator
      transaction?: TransactionClientContract
    }
  ): Promise<Period> {
    const providedTrx = options?.transaction
    const trx = providedTrx || (await db.transaction())
    const shouldCommit = !providedTrx

    try {
      const period = await Period.query({ client: trx })
        .where('id', periodId)
        .preload('sportActivity')
        .first()

      if (!period) {
        if (shouldCommit) await trx.rollback()
        throw new Error('Period not found')
      }

      if (options?.periodValidation) {
        const isValid = this.validatePeriod(period, options.periodValidation)
        if (!isValid) {
          if (shouldCommit) await trx.rollback()
          throw new Error('Period validation failed')
        }
      }

      if (options?.metricValidation) {
        const isValid = this.validateMetrics(Object.keys(metrics), options.metricValidation)
        if (!isValid) {
          if (shouldCommit) await trx.rollback()
          throw new Error('Invalid metrics provided')
        }
      }

      await this.storePeriodMetrics(period, metrics, {
        metricNames: Object.keys(metrics),
        transaction: trx,
      })

      if (shouldCommit) {
        await trx.commit()
      }

      if (options?.trainingLoadRecalculator) {
        try {
          const period = await Period.query().where('id', periodId).preload('sportActivity').first()
          if (period?.sportActivityId) {
            await options.trainingLoadRecalculator.computeBasketballExternalLoad(
              period.sportActivityId,
              {
                useHistorical: true,
                updateTrainingLoad: true,
              }
            )
          }
        } catch (error) {
          logger.error({ error, periodId }, 'Failed to recalculate training load')
        }
      }

      const updatedPeriod = await Period.query()
        .where('id', periodId)
        .preload('metricValues', (q) => q.preload('metric'))
        .first()

      if (!updatedPeriod) throw new Error('Failed to reload updated period')
      return updatedPeriod
    } catch (error) {
      if (shouldCommit) {
        await trx.rollback()
      }
      throw error
    }
  }

  public buildPeriodMetricValueEntries(
    periodId: string,
    metricValues: Record<string, string | number | null>,
    metricsMap: Map<string, PeriodMetric>
  ): PeriodMetricValueEntry[] {
    const entries: PeriodMetricValueEntry[] = []
    for (const [name, raw] of Object.entries(metricValues)) {
      if (raw === null) continue
      const metric = metricsMap.get(name)
      if (!metric) continue
      entries.push({
        periodId,
        metricId: metric.id,
        value: this.convertValueToString(raw, metric.dataType),
      })
    }
    return entries
  }

  public async upsertPeriodMetricValues(
    entries: PeriodMetricValueEntry[],
    options?: { transaction?: TransactionClientContract }
  ): Promise<void> {
    if (entries.length === 0) return

    const unique = new Map<string, PeriodMetricValueEntry>()
    for (const entry of entries) {
      unique.set(`${entry.periodId}|${entry.metricId}`, entry)
    }
    const deduped = [...unique.values()]

    const providedTrx = options?.transaction
    const trx = providedTrx || (await db.transaction())
    const shouldCommit = !providedTrx

    try {
      for (let i = 0; i < deduped.length; i += PERIOD_METRIC_VALUE_UPSERT_CHUNK) {
        const chunk = deduped.slice(i, i + PERIOD_METRIC_VALUE_UPSERT_CHUNK)
        await trx
          .knexQuery()
          .table('period_metric_values')
          .insert(
            chunk.map((entry) => ({
              period_id: entry.periodId,
              metric_id: entry.metricId,
              value: entry.value,
            }))
          )
          .onConflict(['period_id', 'metric_id'])
          .merge(['value'])
      }

      if (shouldCommit) await trx.commit()
    } catch (error) {
      if (shouldCommit && !trx.isCompleted) {
        await trx.rollback()
      }
      throw error
    }
  }

  public async getClubMetrics(
    clubId: string,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const rows = await this.getClubMetricsWithUnits(clubId, startDate, endDate)
    return rows.map((r) => r.name)
  }

  public async getClubMetricsWithUnits(
    clubId: string,
    startDate: string,
    endDate: string,
    options?: { vendorWhitelist?: boolean }
  ): Promise<Array<{ name: string; unit: string | null }>> {
    const useVendorWhitelist = options?.vendorWhitelist !== false
    const cacheKey = `${clubId}|${startDate}|${endDate}|${useVendorWhitelist ? 'wl' : 'all'}`
    const cached = clubMetricsCache.get(cacheKey)
    if (cached && Date.now() - cached.at < CLUB_METRICS_CACHE_TTL_MS) {
      return cached.rows
    }

    const whitelist = useVendorWhitelist ? getChatbotMetricWhitelist(clubId) : null
    try {
      const rows = whitelist?.length
        ? await queryClubPeriodMetricsByWhitelist(clubId, startDate, endDate, whitelist)
        : await queryClubPeriodMetricsInWindow(clubId, startDate, endDate)

      clubMetricsCache.set(cacheKey, { at: Date.now(), rows })
      pruneClubMetricsCache()
      return rows
    } catch {
      if (cached) return cached.rows
      if (whitelist?.length) {
        const fallback = await queryPeriodMetricUnitsByNames(clubId, whitelist)
        clubMetricsCache.set(cacheKey, { at: Date.now(), rows: fallback })
        pruneClubMetricsCache()
        return fallback
      }
      return []
    }
  }

  public async getClubMetricsCatalog(
    clubId: string
  ): Promise<Array<{ name: string; unit: string | null; aggregationMethod: string | null }>> {
    return this.queryClubMetricRows(clubId)
  }

  public async getClubMetricsForReport(
    clubId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ name: string; unit: string | null; aggregationMethod: string | null }>> {
    return this.queryClubMetricRows(clubId, { startDate, endDate })
  }

  private async queryClubMetricRows(
    clubId: string,
    window?: { startDate: string; endDate: string }
  ): Promise<Array<{ name: string; unit: string | null; aggregationMethod: string | null }>> {
    const query = db
      .from('period_metrics as pm')
      .join('period_metric_values as pmv', 'pmv.metric_id', 'pm.id')
      .join('periods as p', 'p.id', 'pmv.period_id')
      .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
      .join('days as d', 'd.id', 'sa.day_id')
      .join('athletes as a', 'a.id', 'd.athlete_id')
      .leftJoin('period_metric_club_units as pmcu', function () {
        this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId)
      })
      .where('a.club_id', clubId)
      .groupBy('pm.name', 'pmcu.unit', 'pm.unit', 'pm.aggregation_method')
      .orderBy('pm.name')
      .select('pm.name')
      .select('pm.aggregation_method')
      .select(db.raw('COALESCE(pmcu.unit, pm.unit) AS unit'))

    if (window) {
      query.whereBetween('d.date_of_day', [window.startDate, window.endDate])
    }

    const rows = await query
    return rows.map((r) => ({
      name: String(r.name),
      unit: r.unit != null ? String(r.unit) : null,
      aggregationMethod: r.aggregation_method != null ? String(r.aggregation_method) : null,
    }))
  }

  private validatePeriod(period: Period, validation: PeriodValidationOptions): boolean {
    if (!validation.dataSource) {
      return true
    }

    if (!period.sportActivity) {
      return false
    }

    const dataSources = Array.isArray(validation.dataSource)
      ? validation.dataSource
      : [validation.dataSource]
    return dataSources.includes(period.sportActivity.dataSource)
  }

  private validateMetrics(metricNames: string[], validation: MetricValidationOptions): boolean {
    if (!validation.allowedMetricNames) {
      return true
    }

    const allowedSet =
      validation.allowedMetricNames instanceof Set
        ? validation.allowedMetricNames
        : new Set(validation.allowedMetricNames)

    for (const name of metricNames) {
      if (!allowedSet.has(name)) {
        throw new Error(
          `Invalid metric: ${name}. Allowed metrics: ${Array.from(allowedSet).join(', ')}`
        )
      }
    }

    return true
  }
}
