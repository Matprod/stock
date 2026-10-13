import Travel from '#models_pg/travel'
import SportActivity from '#models_pg/sport_activity'
import { DateTime } from 'luxon'

export interface CalculateScoreDataPayload {
  athleteId: string
  date: Date

  days: Array<DayScoreData>
}

export interface DayScoreData {
  date: Date
  health: HealthScoreData
  nutrition: NutritionScoreData
  sleep: SleepScoreData
  activity: ActivityData
}

export interface NutrientFields {
  carbohydrateG: number | null
  fatG: number | null
  proteinsG: number | null
  vitaminCMg: number | null
  vitaminEMg: number | null
  vitaminDMicrog: number | null
  magnesiumMg: number | null
  potassiumMg: number | null
  calciumMg: number | null
  chlorideMg: number | null
  sodiumMg: number | null
  zincMg: number | null
  ironMg: number | null
  cholesterolMg: number | null
}

interface NutritionScoreData {
  totalDuration: number | null
  fcMin: number | null
  fcMax: number | null
  hasNutrition: boolean
  hasActivities: boolean
  hasEffortNutri: boolean
  totalMeal: NutrientFields
  totalRecipe: NutrientFields
  totalIntake: NutrientFields
  total: NutrientFields
  effortNutriScore: number | null
  insights: {
    glucides: { max: number; min: number }
    lipides: { max: number; min: number }
    proteines: { max: number; min: number }
    nutri_score: { min_necessary: number; glucides_consommes_total: number }
  }
}

interface HealthScoreData {
  energyRating: number | null
  moodRating: number | null
  stressRating: number | null
  hasHealth: boolean
  hasEnergy: boolean
  hasMood: boolean
  hasStress: boolean
  hasHrv: boolean
  hasRhr: boolean
  hrv: number | null
  lastEwmaHrv: number | null
  rhr: number | null
  lastEwmaRhr: number | null
  maxActivityPain: number | null
  maxHealthPain: number | null
  maxHealthSymptom: number | null
  lastEwmaActiPains: number | null
  lastEwmaOutactiPains: number | null
  lastEwmaSymptoms: number | null
  travels: Array<Travel>
}

interface SleepScoreData {
  qualityRating: number | null
  sleepEfficiency: number | null
  sleepConsistency: number | null
  sleepDebt: number | null
  totalSlowWaveSleepTimeMilli: number | null
  totalRemSleepTimeMilli: number | null
  totalInBedTimeMilli: number | null
  totalAwakeTimeMilli: number | null
  baselineMilli: number | null
  ratioSleepQuantityBaseline: number | null
  sleepRestorative: number | null
  lastEwmaSleepEfficiency: number | null
  lastEwmaSleepConsistency: number | null
  lastEwmaRestorative: number | null
  // lastEwmaRatioSleepQuantityBaseline: number | null
  lastEwmaQuality: number | null
  hasSleep: number
  sleepDurationHours: number | null
  bedtimeDate: DateTime | null
  wakeUpDate: DateTime | null
}

export interface ActivityData {
  activities: SportActivity[]
  recoveryScore: number | null
}

export interface ScoreList {
  score: number
  threshold: number
}

export interface HealthScores {
  ewmaActiPains: number | null
  actiDouleurScore: number | null
  actiDouleurMax: number | null
  ewmaOutactiPains: number | null
  outactiDouleurScore: number | null
  outactiDouleurMax: number | null
  ewmaSymptoms: number | null
  symptomMax: number | null
  symptomsScore: number | null
  energyScore: number | null
  energyToday: number | null
  avgEnergy: number | null
  moodScore: number | null
  moodToday: number | null
  avgMood: number | null
  relaxScore: number | null
  relaxToday: number | null
  avgRelax: number | null
  rhrScore: number | null
  hrvScore: number | null
  travelFatigue: number | null
  travelFatigueScore: number | null
  ewmaRhr: number | null
  rhrFH: number | null
  rhrFB: number | null
  ewmaHrv: number | null
  hrvFH: number | null
  hrvFB: number | null
}

export interface NutritionScores {
  // Macronutrients consumption
  fatsConsumption: number[]
  proteinsConsumption: number[]
  carbsConsumption: number[]
  // microsList: number[]
  below7List: string[]
  good7List: string[]
  above7List: string[]
  goodTodayList: string[]
  belowTodayList: string[]
  cholLevel: 'yes' | 'no'
  effortHours: number

  // Carbohydrates
  carbohydratesToday: number
  fbGlucides: number
  fhGlucides: number
  fbGlucides7: number
  fhGlucides7: number
  carboScore: number
  carboScoreToday: number
  carboPosition: string
  carboPosition7: string
  repartitionScore: number
  repartitionPosition: string
  avgCarbohydrate: number

  // Fats
  fatsToday: number
  fbLipides: number
  fhLipides: number
  fbLipides7: number
  fhLipides7: number
  fatScore: number
  fatScoreToday: number
  fatPosition: string
  fatPosition7: string
  avgFat: number

  // Proteins
  proteinsToday: number
  fbProteins: number
  fhProteins: number
  fbProteins7: number
  fhProteins7: number
  proteinScore: number
  proteinScoreToday: number
  proteinPosition: string
  proteinPosition7: string
  avgProtein: number

  // Vitamins and minerals today
  vitaminCToday: number
  vitaminEToday: number
  vitaminDToday: number
  magnesiumToday: number
  potassiumToday: number
  calciumToday: number
  chlorideToday: number
  sodiumToday: number
  zincToday: number
  ironToday: number

  // Average vitamins and minerals
  avgVitaminC: number
  avgVitaminE: number
  avgVitaminD: number
  avgMagnesium: number
  avgPotassium: number
  avgCalcium: number
  avgChloride: number
  avgSodium: number
  avgZinc: number
  avgIron: number

  // Scores
  microScore: number
  effortnutriScore: number
  avgEffortNutri: number
}

export interface SleepScores {
  ewmaSleepEfficiency: number | null
  ewmaSleepConsistency: number | null
  sleepDebt: number | null
  ewmaRestorative: number | null
  ewmaQuality: number | null
  sleepQualityVariability: number | null
  debtScore: number | null
  restorativeToday: number | null
  efficiencyToday: number | null
  ewmaQuantity: number | null
  consistencyToday: number | null
  restorativeScore: number | null
  consistencyScore: number | null
  bedtimeConsistencyScore: number | null
  efficiencyScore: number | null
  ratioSleepQuantityBaselineToday: number | null
  ratioSleepQuantityBaselineEwma: number | null
  quantityScore: number | null
  quantityToday: number | null
  qualityToday: number | null
  qualityScore: number | null
}

export interface ActivityScores {
  ceMean: number | null
  ceMeanPosition: 'below' | 'above' | 'in' | null
  ceVar: number | null
  frequency: number | null
  frequencyLevel: 'too low' | 'too high' | null
  varCEValue: number | null
  trainingLoads: number[]
  meanCEs: number | null
  numberActi7: number | null
  meanActi3w: number | null
  acwrCEs: number | null
  acwrLevel: 'low' | 'in between' | 'high' | null
  acwrFinalScore: number | null
  recoveryLevel: 'low' | 'medium' | 'high' | null
  recoveryFinalScore: number | null
  recoveryScoreToday: number | null
}
