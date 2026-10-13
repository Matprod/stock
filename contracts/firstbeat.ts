import Athlete from '#models_pg/athlete'
import { DateTime } from 'luxon'

export interface FirstbeatMeasurement {
  athleteId: string
  endTime: string
  exerciseType: string
  measurementId: number
  measurementType: string
  sessionId: string
  startTime: string
  notes?: string
}

export interface FirstbeatVariable {
  name: string
  value: number | string
  unit?: string
  bits?: number
  samplingRate?: string
  type?: string
}

export interface FirstbeatMeasurementResult {
  athleteId: string
  endTime: string
  exerciseType: string
  measurementId: number
  measurementType: string
  sessionId: string
  startTime: string
  notes?: string
  variables: FirstbeatVariable[]
}

export interface FirstbeatMeasurementsResponse {
  measurements: FirstbeatMeasurement[]
}

export interface FirstbeatApiResponse<T> {
  data: T
  status: number
  statusText: string
}

export interface SyncAthleteParams {
  athlete: Athlete
  startDate?: DateTime
  endDate?: DateTime
  token?: string
}
