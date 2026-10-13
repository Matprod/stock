export interface NutritionalDataContributor {
  quantity?: number | null
  portion?: number | null
  fructoseG?: number | null
  glucoseG?: number | null
  lactoseG?: number | null
  maltoseG?: number | null
  sucroseG?: number | null
  energyKcal?: number | null
  waterG?: number | null
  proteinsG?: number | null
  carbohydrateG?: number | null
  fatG?: number | null
  sugarsG?: number | null
  fibresG?: number | null
  faSaturatedG?: number | null
  faMonoG?: number | null
  faPolyG?: number | null
  fa181G?: number | null
  fa182G?: number | null
  cholesterolMg?: number | null
  calciumMg?: number | null
  ironMg?: number | null
  magnesiumMg?: number | null
  potassiumMg?: number | null
  sodiumMg?: number | null
  zincMg?: number | null
  vitaminDMicrog?: number | null
  vitaminEMg?: number | null
  vitaminCMg?: number | null
  vitaminB1Mg?: number | null
  vitaminB2Mg?: number | null
  vitaminB3Mg?: number | null
  vitaminB5Mg?: number | null
  vitaminB6Mg?: number | null
  vitaminB9Microg?: number | null
  vitaminB12Microg?: number | null
}

export interface ContributionInput extends NutritionalDataContributor {
  quantity: number | null
  portion: number | null
}

export interface MealSummary {
  quantity: number
  portion: number
  fructoseG: number
  glucoseG: number
  lactoseG: number
  maltoseG: number
  sucroseG: number
  energyKcal: number
  waterG: number
  proteinsG: number
  carbohydrateG: number
  fatG: number
  sugarsG: number
  fibresG: number
  faSaturatedG: number
  faMonoG: number
  faPolyG: number
  fa181G: number
  fa182G: number
  cholesterolMg: number
  calciumMg: number
  ironMg: number
  magnesiumMg: number
  potassiumMg: number
  sodiumMg: number
  zincMg: number
  vitaminDMicrog: number
  vitaminEMg: number
  vitaminCMg: number
  vitaminB1Mg: number
  vitaminB2Mg: number
  vitaminB3Mg: number
  vitaminB5Mg: number
  vitaminB6Mg: number
  vitaminB9Microg: number
  vitaminB12Microg: number
}

export const MEAL_SUMMARY_NUTRIENT_KEYS: (keyof Omit<MealSummary, 'quantity' | 'portion'>)[] = [
  'fructoseG',
  'glucoseG',
  'lactoseG',
  'maltoseG',
  'sucroseG',
  'energyKcal',
  'waterG',
  'proteinsG',
  'carbohydrateG',
  'fatG',
  'sugarsG',
  'fibresG',
  'faSaturatedG',
  'faMonoG',
  'faPolyG',
  'fa181G',
  'fa182G',
  'cholesterolMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'potassiumMg',
  'sodiumMg',
  'zincMg',
  'vitaminDMicrog',
  'vitaminEMg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminB3Mg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Microg',
  'vitaminB12Microg',
]
