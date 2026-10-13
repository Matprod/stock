import { DateTime } from 'luxon'

export interface Macronutrients {
  proteins: number
  carbohydrates: number
  fats: number
}

export interface MacronutrientRanges {
  proteins: { min: number; max: number }
  carbohydrates: { min: number; max: number }
  fats: { min: number; max: number }
}

export interface Micronutrients {
  vitaminC: number
  vitaminE: number
  vitaminD: number
  magnesium: number
  potassium: number
  calcium: number
  chloride: number
  sodium: number
  zinc: number
  iron: number
}

export interface Location {
  name: string | null
}

export interface NutritionMacroData extends Macronutrients {
  date: string
  consumption: {
    carbohydrates: number
  }
  ranges: MacronutrientRanges
  micronutrients: Micronutrients
}

export interface LastSevenDaysMacros {
  dailyMacros: NutritionMacroData[]
  averages: Macronutrients
  averagesRanges: MacronutrientRanges
  totals: Macronutrients
  weeklyMicronutrients: Micronutrients
}

export interface ProcessedSleepData {
  date: string | null | undefined
  qualityRating: number | null
  bedtimeDate: DateTime | null
  wakeUpDate: DateTime | null
  durationHours: number | null
  sleepEfficiencyPercentage: number | null
  totalInBedTimeMilli: number | null
  totalAwakeTimeMilli: number | null
  baselineMili: number | null
  totalRemSleepTimeMilli?: number | null
  totalSlowWaveSleepTimeMilli?: number | null
  napAm?: number | null
  napPm?: number | null
}

export interface Pain {
  rating: number
  location: Location | null
}

export interface ProcessedHealthData {
  moodRating: number | null
  energyRating: number | null
  stressRating: number | null
  weight?: string | null
  period?: boolean | null
  numberOfCigarettes?: number | null
  averagedHeartRate?: number | null
  restingHeartRate?: number | null
  heartRateVariability?: number | null
  recoveryScore?: number | null
  travel?: boolean | null
  pains?: Pain[] | null
}

export type EntityType = 'activity' | 'nutrition' | 'health' | 'sleep'

export interface BaseSummaryParams {
  date: string
  athleteId: string
}

export interface ActivitySummaryParams extends BaseSummaryParams {
  entityId?: string
  is_delete?: boolean
}

export interface HealthSummaryParams extends BaseSummaryParams {
  is_delete?: boolean
}

export type GenerateNutritionSummaryParams = BaseSummaryParams
export type GenerateHealthSummaryParams = HealthSummaryParams
export type GenerateSleepSummaryParams = BaseSummaryParams
export type GetNutritionSummaryParams = BaseSummaryParams

export interface NutritionSummaryMeta {
  filledMealsCount: number
  generationCount: number
  maxGenerations: number
  canGenerate: boolean
  canRegenerate: boolean
  hasSummary: boolean
}
export type GetHealthSummaryParams = BaseSummaryParams
export type GetSleepSummaryParams = BaseSummaryParams

export type GenerateActivitySummaryParams = ActivitySummaryParams
export type GetActivitySummaryParams = ActivitySummaryParams
