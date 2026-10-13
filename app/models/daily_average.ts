import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm'
import Day from '#models/day'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class DailyAverage extends BaseModel {
  public static table = 'base_athletedayavg'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare carboScore: number | null

  @column()
  declare carboScoreToday: number | null

  @column()
  declare carboPosition: string | null

  @column()
  declare fatScore: number | null

  @column()
  declare fatScoreToday: number | null

  @column()
  declare fatPosition: string | null

  @column()
  declare proteinScore: number | null

  @column()
  declare proteinScoreToday: number | null

  @column()
  declare proteinPosition: string | null

  @column()
  declare ewmaCarbohydrate: number | null

  @column()
  declare avgFat: number | null

  @column()
  declare avgProtein: number | null

  @column()
  declare avgCarbohydrate: number | null

  // Vitamins and minerals today
  @column({ columnName: 'vitaminc_today' })
  declare vitaminCToday: number | null

  @column({ columnName: 'vitaminE_today' })
  declare vitaminEToday: number | null

  @column({ columnName: 'vitaminD_today' })
  declare vitaminDToday: number | null

  @column()
  declare magnesiumToday: number | null

  @column()
  declare potassiumToday: number | null

  @column()
  declare calciumToday: number | null

  @column()
  declare chlorideToday: number | null

  @column()
  declare sodiumToday: number | null

  @column()
  declare zincToday: number | null

  @column()
  declare ironToday: number | null

  // Average vitamins and minerals
  @column({ columnName: 'avg_vitaminc' })
  declare avgVitaminC: number | null

  @column({ columnName: 'avg_vitaminE' })
  declare avgVitaminE: number | null

  @column({ columnName: 'avg_vitaminD' })
  declare avgVitaminD: number | null

  @column()
  declare avgMagnesium: number | null

  @column()
  declare avgPotassium: number | null

  @column()
  declare avgCalcium: number | null

  @column()
  declare avgChloride: number | null

  @column()
  declare avgSodium: number | null

  @column()
  declare avgZinc: number | null

  @column()
  declare avgIron: number | null

  @column()
  declare microScore: number | null

  @column()
  declare effortnutriScore: number | null

  @column({ columnName: 'avg_effortnutri' })
  declare avgEffortNutri: number | null

  @column()
  declare quantityScore: number | null

  @column()
  declare ewmaQuantity: number | null

  @column()
  declare qualityScore: number | null

  @column()
  declare ewmaQuality: number | null

  @column()
  declare sleepQualityVariability: number | null

  @column()
  declare variabilityQuantityScore: number | null

  @column()
  declare variabilityBedtimeScore: number | null

  @column()
  declare variabilityQuantityToday: number | null

  @column()
  declare quantitySleptLast10days: number | null

  @column()
  declare ewmaSymptoms: number | null

  @column()
  declare symptomsScore: number | null

  @column()
  declare ewmaOutactiPains: number | null

  @column()
  declare outactiDouleurScore: number | null

  @column()
  declare ewmaActiPains: number | null

  @column()
  declare actiDouleurScore: number | null

  @column()
  declare avgRelax: number | null

  @column()
  declare avgMood: number | null

  @column()
  declare avgEnergy: number | null

  @column()
  declare relaxScore: number | null

  @column()
  declare moodScore: number | null

  @column()
  declare energyScore: number | null

  @column()
  declare repartitionScore: number | null

  @column()
  declare repartitionPosition: string | null

  @column()
  declare good7List: string | null

  @column()
  declare below7List: string | null

  @column()
  declare above7List: string | null

  @column()
  declare goodTodayList: string | null

  @column()
  declare belowTodayList: string | null

  @column()
  declare cholLevel: 'yes' | 'no' | null

  @column()
  declare base1: number | null

  @column()
  declare base2: number | null

  @column({ columnName: 'CE_mean' })
  declare ceMean: number | null

  @column()
  declare ceMeanPosition: string | null

  @column({ columnName: 'CE_var' })
  declare ceVar: number | null

  @column()
  declare frequency: number | null

  @column()
  declare affutage: number | null

  @column()
  declare forme: number | null

  @column()
  declare charge: number | null

  @column()
  declare effortHours: number | null

  @column()
  declare formeToday: number | null

  // Carbohydrates related fields
  @column()
  declare carbohydratesToday: number | null

  @column()
  declare fbGlucides: number | null

  @column()
  declare fhGlucides: number | null

  @column()
  declare fbGlucides7: number | null

  @column()
  declare fhGlucides7: number | null

  // Fats related fields
  @column()
  declare fatsToday: number | null

  @column()
  declare fbLipides: number | null

  @column()
  declare fhLipides: number | null

  @column()
  declare fbLipides7: number | null

  @column()
  declare fhLipides7: number | null

  // Proteins related fields
  @column()
  declare proteinsToday: number | null

  @column()
  declare fbProteins: number | null

  @column()
  declare fhProteins: number | null

  @column()
  declare fbProteins7: number | null

  @column()
  declare fhProteins7: number | null

  @column()
  declare energyToday: number | null

  @column()
  declare moodToday: number | null

  @column()
  declare relaxToday: number | null

  @column()
  declare qualityToday: number | null

  @column()
  declare quantityToday: number | null

  @column()
  declare activitiesSummary: string | null

  @column()
  declare varCEValue: number | null

  @column()
  declare proteinsConsumption: string | null

  @column()
  declare fatsConsumption: string | null

  @column()
  declare carbsConsumption: string | null

  @column()
  declare avgTrainingLoadsList: string | null

  @column()
  declare numActivitiesWithTrainingLoad: string | null

  @column()
  declare trainingLoads: string | null

  @column({ columnName: 'mean_CEs' })
  declare meanCEs: string | null

  @column()
  declare higher60Proportion: string | null

  @column()
  declare lower40Proportion: string | null

  @column()
  declare frequencyLevel: string | null

  @column()
  declare actiDouleurMax: string | null

  @column()
  declare outactiDouleurMax: string | null

  @column()
  declare symptomMax: string | null

  @column({ columnName: 'number_acti7' })
  declare numberActi7: number | null

  @column({ columnName: 'mean_acti_3w' })
  declare meanActi3w: number | null

  @column()
  declare carboPosition7: string | null

  @column()
  declare fatPosition7: string | null

  @column()
  declare proteinPosition7: string | null

  @column()
  declare numPast10Sleeps: number | null

  // Sleep metrics
  @column()
  declare ewmaSleepEfficiency: number | null

  @column()
  declare ewmaSleepConsistency: number | null

  @column()
  declare ewmaRestorative: number | null

  @column()
  declare ewmaRepartition: number | null

  @column()
  declare ratioSleepQuantityBaselineEwma: number | null

  @column()
  declare ratioSleepQuantityBaselineToday: number | null

  @column({ columnName: 'acwr_CEs' })
  declare acwrCEs: number | null

  @column()
  declare acwrLevel: string | null

  @column()
  declare acwrFinalScore: number | null

  @column()
  declare recoveryScore: number | null

  @column()
  declare recoveryLevel: string | null

  @column()
  declare recoveryFinalScore: number | null

  @column()
  declare recoveryScoreToday: number | null

  @column()
  declare efficiencyScore: number | null

  @column()
  declare efficiencyToday: number | null

  @column()
  declare consistencyScore: number | null

  @column()
  declare bedtimeConsistencyScore: number | null

  @column()
  declare consistencyToday: number | null

  @column()
  declare restorativeScore: number | null

  @column()
  declare restorativeToday: number | null

  @column()
  declare debtScore: number | null

  @column()
  declare sleepDebt: number | null

  @column()
  declare travelFatigue: number | null

  @column()
  declare travelFatigueScore: number | null

  @column()
  declare hrvScore: number | null

  @column()
  declare ewmaHrv: number | null

  @column()
  declare hrvFH: number | null

  @column()
  declare hrvFB: number | null

  @column()
  declare rhrScore: number | null

  @column()
  declare ewmaRhr: number | null

  @column()
  declare rhrFH: number | null

  @column()
  declare rhrFB: number | null

  @column()
  declare sleepQuantityScore: number | null

  @column({ consume: (value) => (value ? parseFloat(value) : null) })
  declare trainingLoad: number | null

  @column({ consume: (value) => (value ? parseFloat(value) : null) })
  declare trainingLoadHighIntensity: number | null

  // RELATIONS

  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, {
    foreignKey: 'athleteDayId',
  })
  declare day: BelongsTo<typeof Day>

  // GETTERS

  @computed()
  get nutriScore(): number | null {
    const weights = {
      carboToday: 0.35 * 0.65,
      carbo7: 0.35 * 0.35,
      fatToday: 0.15 * 0.65,
      fat7: 0.15 * 0.35,
      proteinToday: 0.35 * 0.65,
      protein7: 0.35 * 0.35,
      microScore: 0.15,
    }

    const scores = {
      carboToday: this.carboScoreToday,
      carbo7: this.carboScore,
      fatToday: this.fatScoreToday,
      fat7: this.fatScore,
      proteinToday: this.proteinScoreToday,
      protein7: this.proteinScore,
      microScore: this.microScore,
    }

    // Filter out null values and their weights
    const validScores: Record<string, number> = {}
    for (const [key, value] of Object.entries(scores)) {
      if (value !== null && value !== undefined) {
        validScores[key] = value
      }
    }

    if (Object.keys(validScores).length === 0) {
      return null
    }

    // Get corresponding weights and normalize them
    const validWeights: Record<string, number> = {}
    let weightSum = 0
    for (const key of Object.keys(validScores)) {
      validWeights[key] = weights[key as keyof typeof weights]
      weightSum += validWeights[key]
    }

    // Calculate weighted sum with normalized weights
    return Object.entries(validScores).reduce(
      (sum, [key, value]) => sum + value * (validWeights[key] / weightSum),
      0
    )
  }

}
