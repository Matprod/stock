export type SleepEvolutionGraphPoint = {
  date: string
  sleepQuality: number | null
  sleepTime: number | null
}

export type SleepEvolutionResponse = {
  avgQualityOfSleep: number | null
  avgSleepTime: string | null
  totalSleepTime: string | null
  avgBedtime: string | null
  avgWakeupTime: string | null
  avgTimeInBed: string | null
  avgEfficiency?: number | null
  avgConsistency?: number | null
  graphData: SleepEvolutionGraphPoint[]
}

export type HealthDayInsight = {
  date: string
  mood: number | null
  energy: number | null
  stress: number | null
}

export type PainInsightPoint = {
  date: string
  rating: number | null
  type: 'health' | 'sport'
  id: string | null
}

export type PainZoneInfo = {
  zoneName: string
  zoneSide: string | null
  name: string
}

export type HealthEvolutionResponse = {
  avgEnergy: number | null
  avgMood: number | null
  avgStress: number | null
  daysInsights: HealthDayInsight[]
  painInsights: Record<string, PainInsightPoint[]>
  painHealth: PainZoneInfo[]
  painSport: PainZoneInfo[]
}

export type ActivityEvolutionGraphActivity = {
  activityType: string
  activityId: string
  trainingLoad: number
  distance: number
}

export type ActivityEvolutionGraphPoint = {
  dateOfDay: string
  data: ActivityEvolutionGraphActivity[]
}

export type ActivityEvolutionActivityStats = {
  numActivities: number
  totalDistance: number
  totalDuration: string | null
  totalElevation: number
  avgSpeed: number | null
  totalTrainingLoad: number
  averageTrainingLoad: number
  proportion: number
}

export type ActivityEvolutionTotal = {
  numActivities: number
  totalDuration: string | null
  totalTrainingLoad: number
  averageTrainingLoad: number
  graph: ActivityEvolutionGraphPoint[]
}

export type ActivityEvolutionResponse = {
  total: ActivityEvolutionTotal
  activities: Record<string, ActivityEvolutionActivityStats>
  pieChart: Record<string, number>
}

export type NutritionEvolutionGraphPoint = {
  date: string
  carbohydrates: number
  proteins: number
  fats: number
}

export type NutritionEvolutionTotalMacrosPercentage = {
  proteinsG: number
  carbohydrateG: number
  fatG: number
}

export type NutritionEvolutionTotalResume = {
  energyKcal: number
  proteinsG: number
  carbohydrateG: number
  fatG: number
  sugarsG: number
  fibresG: number
  fructoseG: number
  cholesterolMg: number
  sodiumMg: number
  calciumMg: number
  glucoseG: number
  lactoseG: number
  maltoseG: number
  sucroseG: number
  magnesiumMg: number
  potassiumMg: number
  zincMg: number
  ironMg: number
  vitaminDMicrog: number
  vitaminCMg: number
  vitaminEMg: number
  vitaminB1Mg: number
  vitaminB2Mg: number
  vitaminB3Mg: number
  vitaminB5Mg: number
  vitaminB6Mg: number
  vitaminB9Microg: number
  vitaminB12Microg: number
  chlorideMg: number
  totalVitaminBMg: number
}

export type NutritionEvolutionResponse = {
  graphData: NutritionEvolutionGraphPoint[]
  totalMacrosPercentage: NutritionEvolutionTotalMacrosPercentage
  totalResume: NutritionEvolutionTotalResume
}
