import { CATAPULT_METRICS, CatapultImputationMetric } from '#constants/catapult.constants'

export type CatapultMetric = (typeof CATAPULT_METRICS)[number]

export type CatapultMetricValues = {
  [K in CatapultMetric]: number | string | null
}

export type CatapultBaseFields = {
  date_id: string
  date_name: string
  is_injected: boolean
  is_demo_data: boolean
  athlete_id: string
  athlete_name: string
  period_id: string
  period_name: string
  activity_id: string
  start_time: number
  end_time: number
  date: string
  int_day_id: number
  start_time_h: string
  end_time_h: string
  activity_name: string
}

export type CatapultApiResponse = CatapultBaseFields & Partial<CatapultMetricValues>

export type CatapultSensorPoint = {
  ts?: number | null
  hr?: number | null
}

export type CatapultPeriodSensorResponse<TDataPoint> = Array<{ data?: TDataPoint[] }>

export type CatapultTimestampedPoint<TKey extends string = string> = {
  ts: number
} & Record<TKey, number>

export type CatapultSeriesPayload<TKey extends string = string> = {
  points: CatapultTimestampedPoint<TKey>[]
}

// Imputation
type CatapultImputationMetricMap<T> = {
  [K in CatapultImputationMetric]: T
}
type CatapultCommonFields<T> = {
  first_name: T
  last_name: T
  name: T | null
  player_position: T | null
  date_of_day: T | null
  time_of_activity: T | null
  activity_name: T | null
  season: T | null
}

type CatapultImputation<TMetric, TCommon> = CatapultImputationMetricMap<TMetric> &
  CatapultCommonFields<TCommon>

export type CatapultImputationPayload = CatapultImputation<
  Array<string | number | null>,
  Array<string>
>

export type CatapultImputationResponse = {
  request_id: string
  rows: number
  result: Array<CatapultImputation<string | number, string>>
}

export type CatapultServiceConfig = {
  clubId: string
  accessToken: string
  providerTeamId: string
  baseUrl?: string
}

export type CatapultClubSyncResult = {
  clubId: string
  activityCount: number
  queuedJobs: number
  error?: string
}
