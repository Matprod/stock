import type { Gender } from '#constants/athlete.constants'

export interface ExternalAthlete {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  startDate: string
  endDate: string | null
  jerseyNumber: number | null
  heightCm: number | null
  weightKg: number | null
  gender: Gender
  position: string
}

export interface ExternalDayScore {
  athleteId: string
  date: string
  performanceScore: number | null
  injuryRiskScore: number | null
}

export interface ExternalScoreThresholds {
  performance: {
    high: number
    medium: number
  }
  injury: {
    high: number
    medium: number
  }
}

export interface ExternalScoresResponse {
  data: ExternalDayScore[]
  thresholds: ExternalScoreThresholds
}
