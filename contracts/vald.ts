export interface ValdTest {
  id: string
  testId: string
  modifiedDateUtc: string
  testType?: string
  weight: number
  parameters?: {
    value?: string
    [key: string]: unknown
  }
}

export interface ValdResult {
  resultId: string
  value: number
  time: number
  limb: string
  repeat: number
  definition: {
    id: string
    result: string
    description: string
    name: string
    unit: string
    repeatable: boolean
    asymmetry: boolean
  }
}

export interface ValdTrial {
  id: string
  athleteId: string
  hubAthleteId: string
  recordedUTC: string
  recordedOffset: number
  recordedTimezone: string
  startTime: number
  endTime: number
  results: ValdResult[]
  lastModifiedUTC: string
  limb: string
}

export interface ValdServiceConfig {
  clubId: string
  tenantId: string
}

export type ValdSyncOptions = {
  modifiedFromUtc?: string
  delayMs?: number
  dryRun?: boolean
}

export type ValdClubSyncResult = {
  clubId: string
  tenantId: string
  athleteCount: number
  synced: number
  failed: number
  testsImported: number
  error?: string
}
