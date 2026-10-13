import HealthMetric from '#models_pg/health_metric'
import HealthMetricValue from '#models_pg/health_metric_value'
import SleepMetric from '#models_pg/sleep_metric'
import SleepMetricValue from '#models_pg/sleep_metric_value'
import PeriodMetric from '#models_pg/period_metric'
import PeriodMetricValue from '#models_pg/period_metric_value'
import DayMetricValue from '#models_pg/day_metric_value'
import SportActivityMetric from '#models_pg/sport_activity_metric'
import SportActivityMetricValue from '#models_pg/sport_activity_metric_value'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import Period from '#models_pg/period'
import Day from '#models_pg/day'
import SportActivity from '#models_pg/sport_activity'
import { MetricDomain } from '#contracts/metric'
import DayMetric from '#models_pg/day_metric'

export const METRIC_DATA_TYPE = {
  FLOAT: 'float',
  INTEGER: 'integer',
  STRING: 'string',
  BOOLEAN: 'boolean',
} as const

export type MetricDataType = (typeof METRIC_DATA_TYPE)[keyof typeof METRIC_DATA_TYPE]

export const DOMAIN_CONFIG = {
  [MetricDomain.HEALTH]: {
    Entity: HealthRating,
    Metric: HealthMetric,
    MetricValue: HealthMetricValue,
    entityForeignKey: 'healthId' as const,
  },
  [MetricDomain.SLEEP]: {
    Entity: Sleep,
    Metric: SleepMetric,
    MetricValue: SleepMetricValue,
    entityForeignKey: 'sleepId' as const,
  },
  [MetricDomain.PERIOD]: {
    Entity: Period,
    Metric: PeriodMetric,
    MetricValue: PeriodMetricValue,
    entityForeignKey: 'periodId' as const,
  },
  [MetricDomain.DAY]: {
    Entity: Day,
    Metric: DayMetric,
    MetricValue: DayMetricValue,
    entityForeignKey: 'dayId' as const,
  },
  [MetricDomain.SPORT_ACTIVITY]: {
    Entity: SportActivity,
    Metric: SportActivityMetric,
    MetricValue: SportActivityMetricValue,
    entityForeignKey: 'sportActivityId' as const,
  },
} as const

export type DomainConfig = (typeof DOMAIN_CONFIG)[MetricDomain]

export const METRIC_AGGREGATION_METHOD = {
  SUM: 'sum',
  AVERAGE: 'average',
  MAX: 'max',
  MIN: 'min',
} as const

export type MetricAggregationMethod =
  (typeof METRIC_AGGREGATION_METHOD)[keyof typeof METRIC_AGGREGATION_METHOD]
