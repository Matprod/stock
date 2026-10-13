import type { NutritionDayType } from '#constants/nutrition_energy.constants'

export type MacroGramRange = {
  min: number
  max: number
}

export type MacroGramTargets = {
  carbs: MacroGramRange
  fat: MacroGramRange
  protein: MacroGramRange
}

export type DailyEnergyBreakdown = {
  bmr: number
  nep: number
  eee: number
  tdee: number
  kcalTarget: number
  ffmKg: number
  ffmEstimated: boolean
}

export type BuildMacroTargetsInput = {
  weightKg: number
  tdee: number
  dayType: NutritionDayType
  competitionTomorrow: boolean
  hasStrengthSession: boolean
  isCompetitionDay: boolean
}

export type HeartRateZones = {
  zone1: number
  zone2: number
  zone3: number
  zone4: number
  zone5: number
}

export type DailyEnergyBreakdownResponse = {
  bmr: number
  nep: number
  eee: number
  tdee: number
  kcalFloor: number
}
