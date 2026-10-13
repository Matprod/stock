import type Biomarker from '#models_pg/biomarker'

export const BIOMARKER_TREND_MAX_ATHLETES = 8

export interface FilterBiomarkersPayload {
  cursor?: number
  athleteIds?: string[]
  biomarkerTypeId?: string
  from?: string
  to?: string
}

export interface CursorPaginatedBiomarkers {
  data: Biomarker[]
  meta: {
    nextCursor: number | null
  }
}

export interface BiomarkerTrendPoint {
  date: string
  value: number
}

export interface BiomarkerTrendAthleteSeries {
  athleteId: string
  points: BiomarkerTrendPoint[]
}

export interface BiomarkerTrendResponse {
  data: {
    biomarkerTypeId: string
    biomarkerTypeName: string
    unit: string
    athletes: BiomarkerTrendAthleteSeries[]
  }
}
