export type WahooTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export type WahooUser = {
  id: number
  height: string | null
  weight: string | null
  first: string | null
  last: string | null
  email: string | null
  birth: string | null
  gender: number | null
  created_at: string
  updated_at: string
}

export type WahooWorkoutSummary = {
  id: number
  name?: string | null
  started_at?: string | null
  ascent_accum: string | null
  cadence_avg: string | null
  calories_accum: string | null
  distance_accum: string | null
  duration_active_accum: string | null
  duration_paused_accum: string | null
  duration_total_accum: string | null
  heart_rate_avg: string | null
  power_bike_np_last: string | null
  power_bike_tss_last: string | null
  power_avg: string | null
  speed_avg: string | null
  work_accum: string | null
  time_zone?: string | null
  manual?: boolean
  edited?: boolean
  fitness_app_id?: number | null
  created_at: string
  updated_at: string
  file?: { url: string | null } | null
  workout?: {
    id: number
    starts: string
    minutes: number
    name: string
    workout_token: string
    workout_type_id: number
    plan_id: number | null
    created_at: string
    updated_at: string
  } | null
}

export type WahooWorkout = {
  id: number
  starts: string
  minutes: number
  name: string
  plan_id: number | null
  plan_ids?: number[]
  route_id: number | null
  workout_token: string
  workout_type_id: number
  workout_summary: WahooWorkoutSummary | null
  created_at: string
  updated_at: string
}

export type WahooWorkoutsResponse = {
  workouts: WahooWorkout[]
  total: number
  page: number
  per_page: number
  order: string
  sort: string
}

export type WahooWorkoutSummaryWebhook = {
  event_type: 'workout_summary'
  webhook_token: string
  user: {
    id: number
  }
  workout_summary: WahooWorkoutSummary
}
