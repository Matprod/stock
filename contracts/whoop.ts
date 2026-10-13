export type WhoopTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

export type WhoopUserBasicProfile = {
  user_id: number
  email: string
  first_name: string
  last_name: string
}

export type WhoopWebhookPayload = {
  type: string
  user_id: number
  id: string
  trace_id?: string
}

export type WhoopWorkout = {
  id: string
  start: string
  end: string
  timezone_offset: string
  sport_name: string
  score: {
    average_heart_rate?: number
    max_heart_rate?: number
    kilojoule?: number
    distance_meter?: number
    altitude_gain_meter?: number
  } | null
}

export type WhoopSleep = {
  id: string
  start: string
  end: string
  timezone_offset: string
  nap: boolean
  score_state: string
  score: {
    stage_summary: {
      total_in_bed_time_milli: number
      total_awake_time_milli: number
      total_slow_wave_sleep_time_milli: number
      total_rem_sleep_time_milli: number
    }
    sleep_needed: {
      baseline_milli: number
      need_from_sleep_debt_milli: number
    }
    sleep_consistency_percentage?: number | null
    sleep_efficiency_percentage?: number | null
  } | null
}
