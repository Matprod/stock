import { MetricDataType } from '#constants/metrics.constants'
import HealthMetric from '#models_pg/health_metric'
import PeriodMetric from '#models_pg/period_metric'
import SleepMetric from '#models_pg/sleep_metric'
import DayMetric from '#models_pg/day_metric'
import SportActivityMetric from '#models_pg/sport_activity_metric'
import HealthRating from '#models_pg/health_rating'
import Sleep from '#models_pg/sleep'
import Period from '#models_pg/period'
import Day from '#models_pg/day'
import SportActivity from '#models_pg/sport_activity'

export interface MetricDefinition {
  id: string
  name: string
  unit: string
  description?: string | null
  dataType: MetricDataType
}

export type MetricValueRow = {
  id: string
  metricId: string
  value: string
}

export enum MetricDomain {
  HEALTH = 'health',
  SLEEP = 'sleep',
  PERIOD = 'period',
  DAY = 'day',
  SPORT_ACTIVITY = 'sport_activity',
}

export type Metric = HealthMetric | SleepMetric | PeriodMetric | DayMetric | SportActivityMetric
export type MetricEntity = HealthRating | Sleep | Period | Day | SportActivity
