import type { IChartSpec } from '#contracts/chatbot'
import type { AppLanguage } from '#utils/localize'

export type HistoryEntry = { role: 'user' | 'assistant'; content: string }

export type AthleteAgentContext = {
  mode: 'athlete'
  athleteId: string
  athleteFirstName: string
  athleteLastName: string
  referenceDate: string
  language?: AppLanguage
}

export type TeamAgentContext = {
  mode: 'team'
  clubId: string
  clubName: string
  athleteIds: string[]
  referenceDate: string
  language?: AppLanguage
}

export type AgentContext = AthleteAgentContext | TeamAgentContext

export type AgentTool = {
  schema: {
    name: string
    description: string
    input_schema: Record<string, unknown>
  }
  execute: (input: Record<string, string>) => Promise<string>
}

export type AgentResult = {
  answer: string
  iterations: number
  duration_ms: number
  charts: IChartSpec[]
}

export type TeamPartitionState = {
  datesQueried: Set<string>
  slices: { dates: string[]; rowCount: number; resultChars: number }[]
}
