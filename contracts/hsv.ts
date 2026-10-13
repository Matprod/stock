export type HsvWellnessRow = {
  response_id: number
  response_date: string
  first_name: string | null
  last_name: string | null
  player_name: string | null
  sleep_quality: number | null
  mental_state: number | null
  body_feeling: number | null
  rpe: number | null
  second_session: number | null
  injury_status: number | null
  uploaded_at: string | null
}

export type HsvImportOptions = {
  from?: string
  to?: string
  dryRun?: boolean
}

export type HsvImportResult = {
  dryRun: boolean
  from: string
  to: string
  rows: number
  upserted: number
  skippedEmpty: number
  missing: string[]
  ambiguous: string[]
  ignored: string[]
  withoutSap: string[]
}

export type HsvQueueResult = {
  from: string
  to: string
  clubId: string
}
