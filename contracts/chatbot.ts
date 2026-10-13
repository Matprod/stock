import type { AppLanguage } from '#utils/localize'
import Athlete from '#models_pg/athlete'
import type { PredictionType } from '#constants/insight.constants'
import AthleteService from '#services/athlete_service'
import type { ChatbotQuestionCategory } from '#constants/chatbot_questions.constants'

export type ChatCategory = 'general' | 'sleep' | 'nutrition' | 'activity' | 'health'
export type ChatbotMessageAuthor = 'athlete' | 'staff' | 'bot'

export type ClassificationResult =
  | { kind: 'general'; response: string }
  | { kind: 'categories'; categories: Exclude<ChatCategory, 'general'>[] }

export const CHAT_CATEGORIES: Exclude<ChatCategory, 'general'>[] = [
  'sleep',
  'nutrition',
  'activity',
  'health',
]

export interface GetFinalDataPromptRequest {
  athlete: Athlete
  date: string
  category: PredictionType
  nutrition?: Awaited<ReturnType<AthleteService['getLastSevenDaysMacros']>>
  language?: AppLanguage
  dayId?: string
}

export interface FormattedQuestion {
  id: string
  question: string
  title: string
  category: ChatbotQuestionCategory | null
}

export type ChartKind = 'line' | 'bar' | 'radar' | 'doughnut'

export interface IChartAxis {
  id: string
  label?: string
  min?: number
  max?: number
  position?: 'left' | 'right'
}

export interface IChartDataset {
  label: string
  data: (number | null)[]
  borderColor?: string
  backgroundColor?: string
  fill?: boolean
  yAxisID?: string
  borderDash?: number[]
}

export interface IChartSpec {
  id: string
  kind: ChartKind
  title: string
  labels: string[]
  datasets: IChartDataset[]
  yAxes?: IChartAxis[]
  serieType?: string
  sessionDate?: string
}
