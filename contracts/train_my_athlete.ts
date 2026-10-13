// Enums
export type TrainMyAthleteInjuryOccurredIn = 'other' | 'competition' | 'training'
export type TrainMyAthleteInjurySide = 'left' | 'right' | 'unsided'
export type TrainMyAthleteInjuryAngle = 'front' | 'back'
export type TrainMyAthleteInjuryMechanism = 'Acute' | 'Other' | 'Gradual' | 'Insidious' | 'Chronic'
export type TrainMyAthleteInjuryTissue =
  | 'Muscle/tendon'
  | 'Bone'
  | 'Cartilage/synovium/bursa'
  | 'Internal organs'
  | 'Ligament/joint capsule'
  | 'Non-specific'
  | 'Vessels'
  | 'Superficial tissues/skin'
  | 'Nervous system'

export interface TrainMyAthletePosition {
  id: string
  name: string
}

export interface TrainMyAthleteAthlete {
  id: string
  name: string
  archived: boolean
  teams: Array<{
    id: string
    name: string
  }>
}
// Injuries
export interface TrainMyAthleteUnavailability {
  id: string | null
  start_date: string | null
  end_date: string | null
}

export interface TrainMyAthleteDiagnosis {
  id: string
  osiics_code: string
  name: string
  side: TrainMyAthleteInjurySide
  angle: TrainMyAthleteInjuryAngle
  mechanism: TrainMyAthleteInjuryMechanism
  tissue: TrainMyAthleteInjuryTissue
  pathology: string
  body_area: string
}

export interface TrainMyAthleteInjury {
  id: string
  date: string
  resolved_at: string | null
  occurred_in: TrainMyAthleteInjuryOccurredIn
  is_collision: boolean
  athlete: TrainMyAthleteAthlete
  position: TrainMyAthletePosition
  unavailabilities: Array<TrainMyAthleteUnavailability>
  diagnoses: Array<TrainMyAthleteDiagnosis>
}

// Screening entries
export interface TrainMyAthleteScreening {
  id: string
  name: string
}

export interface TrainMyAthleteScreeningEntry {
  id: string
  date: string
  updated_at: string
  value: number
  screening: TrainMyAthleteScreening
  athlete: TrainMyAthleteAthlete
}

// Body compositions
export interface TrainMyAthleteBodyComposition {
  id: string
  athlete: TrainMyAthleteAthlete
  date: string
  height: number
  weight: number
  sf_right_tricep: number
  sf_right_bicep: number
  sf_subscap: number
  sf_suprailiac: number
  sf_supraspinale: number
  sf_abdominals: number
  sf_right_thigh: number
  sf_left_thigh: number
  sf_right_calf: number
  sf_left_calf: number
}

export interface TrainMyAthleteResponse {
  data: {
    reports: {
      injuries: TrainMyAthleteInjury[]
      resolvedInjuries: TrainMyAthleteInjury[]
      screeningEntries: TrainMyAthleteScreeningEntry[]
      bodyCompositions: TrainMyAthleteBodyComposition[]
    }
  }
}
