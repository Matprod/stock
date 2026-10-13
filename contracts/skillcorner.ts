export type SkillcornerServiceConfig = {
  maunaClubId: string
  teamId: number
  username: string
  password: string
}

export type SkillcornerClubSyncResult = {
  clubId: string
  matches: number
  imported: number
  activitiesUpdated: number
  skipped: number
  failed: number
  errors: string[]
  error?: string
}

export type SkillcornerRecord = Record<string, unknown>

export type SkillcornerPhysicalRow = SkillcornerRecord & {
  player_id?: string | number | null
  player_name?: string | null
  match_id?: string | number | null
  match_date?: string | null
  match_name?: string | null
  minutes_full_all?: string | number | null
  total_distance_full_all?: string | number | null
  sprint_distance_full_all?: string | number | null
  hi_distance_full_all?: string | number | null
  psv99?: string | number | null
}
