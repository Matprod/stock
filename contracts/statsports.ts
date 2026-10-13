import type { ApiStatssportsRow } from '#constants/statsports.constants'

export type StatssportsServiceConfig = {
  clubId: string
  thirdPartyApiId: string
}

export type StatssportsDateRange = {
  sessionStart: string
  sessionEnd: string
  chunkDays?: number
}

export type StatssportsFetchOptions = StatssportsDateRange & {
  maxRows?: number
}

export type StatssportsSessionDetails = {
  sessionDate?: string | null
  startTime?: string | null
  endTime?: string | null
  sessionType?: string | null
  squadId?: string | null
}

export type StatssportsPlayerDetails = {
  primaryPosition?: string | null
  secondaryPosition?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  shortName?: string | null
  height?: number | string | null
  weight?: number | string | null
  maxSpeed?: number | string | null
  maxHeartRate?: number | string | null
  restingHeartRate?: number | string | null
  activeSquadName?: string | null
  customPlayerId?: string | null
  maxAccel?: number | string | null
  maxDecel?: number | string | null
  runningSymmetry?: number | string | null
}

export type StatssportsDrillKpi = Record<string, unknown>

export type StatssportsDrill = {
  id?: string | null
  drillName?: string | null
  startTime?: string | null
  endTime?: string | null
  sessionType?: string | null
  sessionPlayerDataId?: string | null
  primaryLabel?: string | null
  secondaryLabel?: string | null
  tertiaryLabel?: string | null
  freeText?: string | null
  drillKpi?: StatssportsDrillKpi | null
}

export type StatssportsSessionPlayer = {
  id?: string | null
  rawDataId?: string | null
  playerDetails?: StatssportsPlayerDetails | null
  drills?: StatssportsDrill[] | null
}

export type StatssportsSessionBundle = {
  id?: string | null
  sessionName?: string | null
  shareDate?: string | null
  sessionDetails?: StatssportsSessionDetails | null
  sessionPlayers?: StatssportsSessionPlayer[] | null
}

export type StatssportsChunkResult = {
  start: string
  end: string
  bundles: number
  rows: ApiStatssportsRow[]
}

export type StatssportsFetchResult = {
  clubId: string
  sessionStart: string
  sessionEnd: string
  chunks: number
  bundles: number
  rows: ApiStatssportsRow[]
}

export type StatssportsPersistResult = {
  rows: number
  imported: number
  createdActivities: number
  createdPeriods: number
  createdEvents: number
  linkedEvents: number
  skippedNoPlayerId: number
  skippedNoAthlete: number
  failed: number
}

export type StatssportsSyncResult = StatssportsPersistResult & {
  clubId: string
  chunks: number
  bundles: number
}

export type StatssportsClubQueueResult = {
  clubId: string
  queued: boolean
  error?: string
}
