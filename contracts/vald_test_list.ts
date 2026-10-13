export const VALD_TREND_MAX_ATHLETES = 8

export interface ValdTestListAthlete {
  id: string
  name: string
  firstName: string
  lastName: string
  profilePicture: unknown | null
}

export interface ValdTrialMetric {
  key: string
  value: number
  unit: string
}

export interface ValdTrialNode {
  id: string
  trialNumber: number
  metrics: ValdTrialMetric[]
}

export interface ValdTestListItem {
  id: string
  testType: string
  primaryMetricKey: string
  value: string | null
  unit: string | null
  measuredAt: string
  athleteId: string
  athlete: ValdTestListAthlete
  trials: ValdTrialNode[]
}

export interface ValdTestListFilters {
  cursor?: number
  athleteIds?: string[]
  from?: string
  to?: string
  testType?: string
}

export interface ValdTestListResponse {
  data: ValdTestListItem[]
  meta: {
    nextCursor: number | null
  }
}

export interface ValdTrendPoint {
  date: string
  value: number
}

export interface ValdTrendSeries {
  unit: string
  points: ValdTrendPoint[]
}

export interface ValdTrendAthleteSeries {
  athleteId: string
  seriesByMetric: Record<string, ValdTrendSeries>
}

export interface ValdTrendResponse {
  data: {
    testType: string
    athletes: ValdTrendAthleteSeries[]
  }
}
