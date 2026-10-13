import { MetricDomain } from '#contracts/metric'
import type { SubjectiveScaleFieldResponse } from '#contracts/subjective_scale'
import { SUBJECTIVE_VARIABLE_DOMAIN, type SubjectiveVariableDomain } from '#contracts/subjective_variable'
import type {
  HealthSubjectivePayload,
  SubjectiveValues,
  SubjectiveValuesPatch,
} from '#contracts/subjective_value'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import SportActivity from '#models_pg/sport_activity'
import { MetricService } from '#services/metric_service'

export class SubjectiveScaleValuesService {
  private readonly healthMetricService = new MetricService(MetricDomain.HEALTH)

  public validatePayload(
    values: SubjectiveValuesPatch | undefined,
    scales: SubjectiveScaleFieldResponse[],
    label: string
  ): string | null {
    if (!values) return null

    const scaleByFieldName = new Map(scales.map((scale) => [scale.fieldName, scale]))

    for (const [fieldName, value] of Object.entries(values)) {
      if (value == null) continue

      const scale = scaleByFieldName.get(fieldName)
      if (!scale) {
        return `Unknown ${label} field: ${fieldName}`
      }

      if (value < scale.min || value > scale.max) {
        return `${fieldName} must be between ${scale.min} and ${scale.max}`
      }
    }

    return null
  }

  public validateHealthPayload(
    payload: HealthSubjectivePayload,
    scales: SubjectiveScaleFieldResponse[]
  ): string | null {
    const ratingError = this.validatePayload(
      payload.ratings,
      scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING),
      'health rating'
    )
    if (ratingError) return ratingError

    return this.validatePayload(
      payload.metrics,
      scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC),
      'health metric'
    )
  }

  public validateSleepPayload(
    ratings: SubjectiveValuesPatch | undefined,
    scales: SubjectiveScaleFieldResponse[]
  ): string | null {
    return this.validatePayload(
      ratings,
      scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.SLEEP),
      'sleep'
    )
  }

  public async applyActivity(
    activity: SportActivity,
    scales: SubjectiveScaleFieldResponse[],
    patch: SubjectiveValuesPatch
  ): Promise<SportActivity> {
    await this.applyColumnValues(
      activity,
      scales,
      SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY,
      patch
    )
    return activity
  }

  public async applySleep(
    sleep: Sleep,
    scales: SubjectiveScaleFieldResponse[],
    patch: SubjectiveValuesPatch
  ): Promise<Sleep> {
    await this.applyColumnValues(sleep, scales, SUBJECTIVE_VARIABLE_DOMAIN.SLEEP, patch)
    return sleep
  }

  public async applyHealth(
    health: HealthRating,
    scales: SubjectiveScaleFieldResponse[],
    payload: HealthSubjectivePayload
  ): Promise<HealthRating> {
    const ratingPatch: Record<string, number | null> = {}
    const metricPatch: Record<string, number> = {}

    for (const scale of scales) {
      if (scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING) {
        const value = payload.ratings?.[scale.fieldName]
        if (value === undefined) continue
        ratingPatch[scale.fieldName] = value
        continue
      }

      if (scale.domain !== SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC) continue

      const value = payload.metrics?.[scale.fieldName]
      if (value === undefined || value == null) continue
      metricPatch[scale.fieldName] = value
    }

    if (Object.keys(ratingPatch).length > 0) {
      health.merge(ratingPatch)
      await health.save()
    }

    if (Object.keys(metricPatch).length > 0) {
      await this.healthMetricService.updateMetrics(health.id, metricPatch)
    }

    await health.load('metricValues', (query) => query.preload('metric'))

    return health
  }

  public readSleep(sleep: Sleep, scales: SubjectiveScaleFieldResponse[]): SubjectiveValues {
    return this.readColumnValues(sleep, scales, SUBJECTIVE_VARIABLE_DOMAIN.SLEEP)
  }

  public readHealthSplit(
    health: HealthRating,
    scales: SubjectiveScaleFieldResponse[]
  ): { ratings: SubjectiveValues; metrics: SubjectiveValues } {
    const ratings: SubjectiveValues = {}
    const metrics: SubjectiveValues = {}

    for (const scale of scales) {
      if (scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING) {
        const value = health[scale.fieldName as keyof HealthRating]
        ratings[scale.fieldName] = typeof value === 'number' ? value : null
        continue
      }

      if (scale.domain !== SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC) continue

      const metricValue = health.metricValues.find(
        (entry) => entry.metric?.name === scale.fieldName
      )
      metrics[scale.fieldName] = metricValue ? Number(metricValue.value) : null
    }

    return { ratings, metrics }
  }

  private async applyColumnValues(
    model: {
      merge: (payload: Record<string, number | null>) => unknown
      save: () => Promise<unknown>
    },
    scales: SubjectiveScaleFieldResponse[],
    domain: SubjectiveVariableDomain,
    patch: SubjectiveValuesPatch
  ): Promise<void> {
    const modelPatch: Record<string, number | null> = {}

    for (const scale of scales) {
      if (scale.domain !== domain) continue

      const value = patch[scale.fieldName]
      if (value === undefined) continue
      modelPatch[scale.fieldName] = value
    }

    if (Object.keys(modelPatch).length === 0) return

    model.merge(modelPatch)
    await model.save()
  }

  private readColumnValues(
    model: object,
    scales: SubjectiveScaleFieldResponse[],
    domain: SubjectiveVariableDomain
  ): SubjectiveValues {
    const result: SubjectiveValues = {}
    const record = model as Record<string, unknown>

    for (const scale of scales) {
      if (scale.domain !== domain) continue

      const value = record[scale.fieldName]
      result[scale.fieldName] = typeof value === 'number' ? value : null
    }

    return result
  }
}
