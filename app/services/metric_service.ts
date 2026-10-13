import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import {
  DOMAIN_CONFIG,
  DomainConfig,
  METRIC_DATA_TYPE,
  type MetricDataType,
} from '#constants/metrics.constants'
import { MetricEntity, MetricDomain } from '#contracts/metric'

export class MetricService {
  constructor(private domain: MetricDomain) {}

  private get config(): DomainConfig {
    return DOMAIN_CONFIG[this.domain]
  }

  public normalizeValue(raw: string | number, type: MetricDataType): string {
    switch (type) {
      case METRIC_DATA_TYPE.INTEGER:
        return String(Math.round(Number(raw)))

      case METRIC_DATA_TYPE.FLOAT:
        return String(Math.round(Number(raw) * 100) / 100)

      case METRIC_DATA_TYPE.BOOLEAN:
        return raw === '1' || raw === 'true' || Number(raw) !== 0 ? 'true' : 'false'

      case METRIC_DATA_TYPE.STRING:
      default:
        return String(raw)
    }
  }

  public getTypedValue(raw: string, dataType: MetricDataType): string | number | boolean | null {
    switch (dataType) {
      case METRIC_DATA_TYPE.INTEGER:
        return Math.round(Number(raw))
      case METRIC_DATA_TYPE.FLOAT:
        return Number(raw)
      case METRIC_DATA_TYPE.BOOLEAN:
        return raw === '1' || raw === 'true' || Number(raw) !== 0 ? true : false
      case METRIC_DATA_TYPE.STRING:
      default:
        return raw
    }
  }

  public extractNumericMetrics(
    entity: {
      metricValues?: Array<{
        metric: { name: string; dataType: MetricDataType } | null
        value: string
      }> | null
    },
    metricNames?: readonly string[]
  ): Map<string, number> {
    const metricMap = new Map<string, number>()
    const filterSet = metricNames ? new Set(metricNames) : null

    for (const metricValue of entity.metricValues || []) {
      if (!metricValue.metric) continue

      const metricName = metricValue.metric.name

      if (filterSet && !filterSet.has(metricName)) continue

      const typedValue = this.getTypedValue(metricValue.value, metricValue.metric.dataType)
      if (typeof typedValue === 'number') {
        metricMap.set(metricName, typedValue)
      }
    }

    return metricMap
  }

  public extractNumericMetricsAsObject<const T extends readonly string[]>(
    entity: {
      metricValues?: Array<{
        metric: { name: string; dataType: MetricDataType } | null
        value: string
      }> | null
    },
    metricNames: T
  ): { [K in T[number]]: number | null } {
    const metricMap = this.extractNumericMetrics(entity, metricNames)

    const result = {} as { [K in T[number]]: number | null }
    for (const metricName of metricNames) {
      result[metricName as T[number]] = metricMap.get(metricName) ?? null
    }

    return result
  }

  private async storeMetrics(
    entityId: string,
    metricValues: Record<string, string | number | null | undefined>,
    transaction?: TransactionClientContract,
    options?: {
      metricsCatalog?: Map<string, { id: string; dataType: MetricDataType }>
      source?: string
    }
  ): Promise<void> {
    const trx = transaction ?? (await db.transaction())
    const shouldCommit = !transaction

    const { Metric, MetricValue, entityForeignKey } = this.config

    try {
      const metricNames = Object.keys(metricValues).sort()

      const metricsMap =
        options?.metricsCatalog ??
        new Map(
          (
            (await Metric.query({ client: trx }).whereIn('name', metricNames)) as Array<{
              id: string
              name: string
              dataType: MetricDataType
            }>
          ).map((metric) => [metric.name, metric])
        )

      const entries = Object.entries(metricValues)
        .filter(([, value]) => value !== null && value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => {
          const metric = metricsMap.get(name)
          if (!metric || value === null || value === undefined) return null

          return {
            [entityForeignKey]: entityId,
            metricId: metric.id,
            value: this.normalizeValue(value, metric.dataType),
          }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)

      if (entries.length === 0) {
        if (shouldCommit) await trx.commit()
        return
      }

      switch (entityForeignKey) {
        case 'periodId':
          await trx
            .knexQuery()
            .table('period_metric_values')
            .insert(
              entries.map((entry) => ({
                period_id: entry.periodId,
                metric_id: entry.metricId,
                value: entry.value,
              }))
            )
            .onConflict(['period_id', 'metric_id'])
            .merge(['value'])
          break
        case 'sportActivityId': {
          const source = options?.source
          if (!source) {
            throw new Error('source is required when storing sport_activity metrics')
          }
          await trx
            .knexQuery()
            .table('sport_activity_metric_values')
            .insert(
              entries.map((entry) => ({
                sport_activity_id: entry.sportActivityId,
                metric_id: entry.metricId,
                source,
                value: entry.value,
              }))
            )
            .onConflict(['sport_activity_id', 'metric_id', 'source'])
            .merge(['value'])
          break
        }
        case 'healthId':
          await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
            client: trx,
          })
          break
        case 'sleepId':
          await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
            client: trx,
          })
          break
        case 'dayId':
          await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
            client: trx,
          })
          break
      }

      if (shouldCommit) {
        await trx.commit()
      }
    } catch (error) {
      if (shouldCommit && !trx.isCompleted) {
        await trx.rollback()
      }
      throw error
    }
  }

  public async storeEntityMetrics(
    entityId: string,
    metricValues: Record<string, string | number | null | undefined>,
    transaction?: TransactionClientContract,
    options?: {
      metricsCatalog?: Map<string, { id: string; dataType: MetricDataType }>
      source?: string
    }
  ): Promise<void> {
    return this.storeMetrics(entityId, metricValues, transaction, options)
  }

  public async updateMetrics(
    entityId: string,
    metrics: Record<string, string | number | null | undefined>,
    transaction?: TransactionClientContract,
    options?: {
      source?: string
    }
  ): Promise<MetricEntity> {
    const trx = transaction ?? (await db.transaction())
    const shouldCommit = !transaction

    const { MetricValue, Entity } = this.config

    try {
      const entity = await Entity.query({ client: trx }).where('id', entityId).first()

      if (!entity) {
        throw new Error('Entity not found')
      }

      await this.storeMetrics(entityId, metrics, trx, options)

      if (shouldCommit) {
        await trx.commit()
      }

      const updatedEntity = await Entity.query(shouldCommit ? undefined : { client: trx })
        .where('id', entityId)
        .preload('metricValues', (q: ModelQueryBuilderContract<typeof MetricValue>) =>
          q.preload('metric')
        )
        .first()

      if (!updatedEntity) {
        throw new Error('Failed to reload entity')
      }

      return updatedEntity
    } catch (error) {
      if (shouldCommit && !trx.isCompleted) {
        await trx.rollback()
      }
      throw error
    }
  }
}
