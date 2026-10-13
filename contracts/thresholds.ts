export interface ThresholdLevel {
  high: number
  medium: number
}

export interface ThresholdsPayload {
  performance: ThresholdLevel
  injury: ThresholdLevel
  availability: ThresholdLevel
}

export interface ThresholdsResponse {
  clubId: string | null
  thresholds: ThresholdsPayload
}
