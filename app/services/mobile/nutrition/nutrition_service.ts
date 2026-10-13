import type { ContributionInput, MealSummary } from '#contracts/nutrition'
import { MEAL_SUMMARY_NUTRIENT_KEYS } from '#contracts/nutrition'
import {
  NUTRITION_MEAL_TYPES,
  SNACK_DB_MEAL_TYPES,
  NutritionMealType,
} from '#constants/nutrition.constants'
import Aliment from '#models_pg/aliment'
import LlmAliment from '#models_pg/llm_aliment'
import Nutrition from '#models_pg/nutrition'
import {
  addNutritionQuerySchema,
  addNutritionSchema,
  addAlimentSchema,
  getNutritionQuerySchema,
  getNutritionSummaryQuerySchema,
  updateNutritionSchema,
} from '#schemas/nutrition'
import AthleteService from '#services/athlete_service'
import { TranslationService } from '#services/translation_service'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import type { AppLanguage } from '#utils/localize'
import { Infer } from '@vinejs/vine/types'
import { DateTime } from 'luxon'
import axios from 'axios'

function toContributionInput(
  meal: Aliment | LlmAliment,
  quantity: number | null,
  portion: number | null
): ContributionInput {
  return {
    quantity,
    portion,
    fructoseG: meal.fructoseG,
    glucoseG: meal.glucoseG,
    lactoseG: meal.lactoseG,
    maltoseG: meal.maltoseG,
    sucroseG: meal.sucroseG,
    energyKcal: meal.energyKcal,
    waterG: meal.waterG,
    proteinsG: meal.proteinsG,
    carbohydrateG: meal.carbohydrateG,
    fatG: meal.fatG,
    sugarsG: meal.sugarsG,
    fibresG: meal.fibresG,
    faSaturatedG: meal.faSaturatedG,
    faMonoG: meal.faMonoG,
    faPolyG: meal.faPolyG,
    fa181G: meal.fa181G,
    fa182G: meal.fa182G,
    cholesterolMg: meal.cholesterolMg,
    calciumMg: meal.calciumMg,
    ironMg: meal.ironMg,
    magnesiumMg: meal.magnesiumMg,
    potassiumMg: meal.potassiumMg,
    sodiumMg: meal.sodiumMg,
    zincMg: meal.zincMg,
    vitaminDMicrog: meal.vitaminDMicrog,
    vitaminEMg: meal.vitaminEMg,
    vitaminCMg: meal.vitaminCMg,
    vitaminB1Mg: meal.vitaminB1Mg,
    vitaminB2Mg: meal.vitaminB2Mg,
    vitaminB3Mg: meal.vitaminB3Mg,
    vitaminB5Mg: meal.vitaminB5Mg,
    vitaminB6Mg: meal.vitaminB6Mg,
    vitaminB9Microg: meal.vitaminB9Microg,
    vitaminB12Microg: meal.vitaminB12Microg,
  }
}

type OpenFoodFactsNutriments = Record<string, number | string | null | undefined>

function getNutrimentValue(
  nutriments: OpenFoodFactsNutriments,
  key: string,
  multiplier = 1
): number {
  const raw = nutriments[key]
  if (raw === null || raw === undefined) return 0
  const num = Number(raw)
  if (!Number.isFinite(num)) return 0
  return num * multiplier
}

export default class NutritionService {
  private athleteService: AthleteService
  private translationService: TranslationService

  constructor() {
    this.athleteService = new AthleteService()
    this.translationService = new TranslationService()
  }

  public async translateAliments(
    aliments: Array<{ id: string; name: string | null } | null | undefined>,
    language: AppLanguage
  ) {
    await this.translationService.applyTranslatedNames(
      aliments.filter(
        (aliment): aliment is { id: string; name: string } =>
          aliment != null && aliment.name != null
      ),
      TRANSLATABLE_TYPES.ALIMENT,
      TRANSLATION_KEYS.ALIMENT_NAME,
      language
    )
  }

  public async translateNutritionEntries(entries: Nutrition[], language: AppLanguage) {
    const aliments: Array<{ id: string; name: string | null }> = []

    for (const entry of entries) {
      if (entry.aliment) aliments.push(entry.aliment)
      for (const recipeAliment of entry.recipe?.recipeAliments ?? []) {
        if (recipeAliment.meal) aliments.push(recipeAliment.meal)
      }
    }

    await this.translateAliments(aliments, language)
  }

  async addAliment(athleteId: string, payload: Infer<typeof addAlimentSchema>) {
    const athlete = await this.athleteService.getAthleteById(athleteId)

    if (!athlete) {
      throw new Error('Athlete not found')
    }

    const { name, ...rest } = payload

    await Aliment.create({
      ...rest,
      name,
      barcode: rest.barcode?.toString() ?? null,
      addedById: athlete.id,
    })
  }

  async getOrCreateAlimentFromOpenFoodFacts(barcode: string, addedById: string) {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`

    const response = await axios.get(url)
    if (response.status !== 200) {
      throw new Error('Failed to fetch product data')
    }

    const productData = response.data as {
      product?: {
        product_name?: string
        product_name_fr?: string
        nutrition_score_beverage?: number
        product_quantity?: string | number
        serving_quantity?: string | number
        serving_size?: string | number
        nutriments?: OpenFoodFactsNutriments
      }
    }

    const product = productData.product
    if (!product || !product.nutriments) {
      throw new Error('Product not found')
    }

    const nutriments = product.nutriments

    const name = product.product_name ?? null

    const isBeverage = product.nutrition_score_beverage === 1
    const unit = isBeverage ? 'ml' : 'g'

    const servingSizeRaw =
      product.product_quantity ?? product.serving_quantity ?? product.serving_size
    const portion =
      servingSizeRaw !== undefined && servingSizeRaw !== null
        ? Number(String(servingSizeRaw).replace(/[^\d.]/g, ''))
        : 0
    const safePortion = Number.isFinite(portion) && portion > 0 ? portion : 100

    const alimentPayload = {
      name,
      energyKcal: getNutrimentValue(nutriments, 'energy-kcal_100g'),
      carbohydrateG: getNutrimentValue(nutriments, 'carbohydrates_100g'),
      proteinsG: getNutrimentValue(nutriments, 'proteins_100g'),
      alcoholG: getNutrimentValue(nutriments, 'alcohol_100g'),
      fatG: getNutrimentValue(nutriments, 'fat_100g'),
      fibresG: getNutrimentValue(nutriments, 'fiber_100g'),
      faSaturatedG: getNutrimentValue(nutriments, 'saturated-fat_100g'),
      saltG: getNutrimentValue(nutriments, 'salt_100g'),
      sodiumMg: getNutrimentValue(nutriments, 'sodium_100g', 1000),
      sugarsG: getNutrimentValue(nutriments, 'sugars_100g'),
      fructoseG: getNutrimentValue(nutriments, 'fructose_100g'),
      glucoseG: getNutrimentValue(nutriments, 'glucose_100g'),
      lactoseG: getNutrimentValue(nutriments, 'lactose_100g'),
      maltoseG: getNutrimentValue(nutriments, 'maltose_100g'),
      sucroseG: getNutrimentValue(nutriments, 'sucrose_100g'),
      starchG: getNutrimentValue(nutriments, 'starch_100g'),
      faMonoG: getNutrimentValue(nutriments, 'monounsaturated-fat_100g'),
      faPolyG: getNutrimentValue(nutriments, 'polyunsaturated-fat_100g'),
      cholesterolMg: getNutrimentValue(nutriments, 'cholesterol_100g', 1000),
      calciumMg: getNutrimentValue(nutriments, 'calcium_100g', 1000),
      chlorideMg: getNutrimentValue(nutriments, 'chloride_100g', 1000),
      copperMg: getNutrimentValue(nutriments, 'copper_100g', 1000),
      ironMg: getNutrimentValue(nutriments, 'iron_100g', 1000),
      iodineMicrog: getNutrimentValue(nutriments, 'iodine_100g', 1_000_000),
      magnesiumMg: getNutrimentValue(nutriments, 'magnesium_100g', 1000),
      manganeseMg: getNutrimentValue(nutriments, 'manganese_100g', 1000),
      phosphorusMg: getNutrimentValue(nutriments, 'phosphorus_100g', 1000),
      potassiumMg: getNutrimentValue(nutriments, 'potassium_100g', 1000),
      seleniumMicrog: getNutrimentValue(nutriments, 'selenium_100g', 1_000_000),
      zincMg: getNutrimentValue(nutriments, 'zinc_100g', 1000),
      vitaminB12Microg: getNutrimentValue(nutriments, 'vitamin-b12_100g', 1_000_000),
      vitaminB2Mg: getNutrimentValue(nutriments, 'vitamin-b2_100g', 1000),
      vitaminDMicrog: getNutrimentValue(nutriments, 'vitamin-d_100g', 1_000_000),
      vitaminEMg: getNutrimentValue(nutriments, 'vitamin-e_100g', 1000),
      vitaminCMg: getNutrimentValue(nutriments, 'vitamin-c_100g', 1000),
      vitaminB1Mg: getNutrimentValue(nutriments, 'vitamin-b1_100g', 1000),
      vitaminB6Mg: getNutrimentValue(nutriments, 'vitamin-b6_100g', 1000),
      vitaminB9Microg: getNutrimentValue(nutriments, 'vitamin-b9_100g', 1_000_000),
      vitaminB3Mg: getNutrimentValue(nutriments, 'vitamin-b3_100g', 1000),
      vitaminB5Mg: getNutrimentValue(nutriments, 'vitamin-b5_100g', 1000),
      galactoseG: 0,
      waterG: 0,
      glutenG: 0,
      fa181G: 0,
      fa182G: 0,
      portion: safePortion,
      portionUnit: unit,
      referenceDatabase: 'OpenFoodFacts',
      barcode: String(barcode),
      addedById,
    }

    const existingByBarcode = await Aliment.query().where('barcode', String(barcode)).first()
    if (existingByBarcode) {
      if (!existingByBarcode.portion || existingByBarcode.portion <= 0) {
        existingByBarcode.portion = 100
        await existingByBarcode.save()
      }
      return existingByBarcode
    }

    const existing = await Aliment.query()
      .where('name', alimentPayload.name ?? '')
      .where('energyKcal', alimentPayload.energyKcal ?? 0)
      .where('carbohydrateG', alimentPayload.carbohydrateG ?? 0)
      .where('proteinsG', alimentPayload.proteinsG ?? 0)
      .where('alcoholG', alimentPayload.alcoholG ?? 0)
      .where('fatG', alimentPayload.fatG ?? 0)
      .where('fibresG', alimentPayload.fibresG ?? 0)
      .where('faSaturatedG', alimentPayload.faSaturatedG ?? 0)
      .where('saltG', alimentPayload.saltG ?? 0)
      .where('sodiumMg', alimentPayload.sodiumMg ?? 0)
      .where('sugarsG', alimentPayload.sugarsG ?? 0)
      .where('fructoseG', alimentPayload.fructoseG ?? 0)
      .where('glucoseG', alimentPayload.glucoseG ?? 0)
      .where('lactoseG', alimentPayload.lactoseG ?? 0)
      .where('maltoseG', alimentPayload.maltoseG ?? 0)
      .where('sucroseG', alimentPayload.sucroseG ?? 0)
      .where('starchG', alimentPayload.starchG ?? 0)
      .where('faMonoG', alimentPayload.faMonoG ?? 0)
      .where('faPolyG', alimentPayload.faPolyG ?? 0)
      .where('cholesterolMg', alimentPayload.cholesterolMg ?? 0)
      .where('calciumMg', alimentPayload.calciumMg ?? 0)
      .where('chlorideMg', alimentPayload.chlorideMg ?? 0)
      .where('copperMg', alimentPayload.copperMg ?? 0)
      .where('ironMg', alimentPayload.ironMg ?? 0)
      .where('iodineMicrog', alimentPayload.iodineMicrog ?? 0)
      .where('magnesiumMg', alimentPayload.magnesiumMg ?? 0)
      .where('manganeseMg', alimentPayload.manganeseMg ?? 0)
      .where('phosphorusMg', alimentPayload.phosphorusMg ?? 0)
      .where('potassiumMg', alimentPayload.potassiumMg ?? 0)
      .where('seleniumMicrog', alimentPayload.seleniumMicrog ?? 0)
      .where('zincMg', alimentPayload.zincMg ?? 0)
      .where('vitaminB12Microg', alimentPayload.vitaminB12Microg ?? 0)
      .where('vitaminB2Mg', alimentPayload.vitaminB2Mg ?? 0)
      .where('vitaminDMicrog', alimentPayload.vitaminDMicrog ?? 0)
      .where('vitaminEMg', alimentPayload.vitaminEMg ?? 0)
      .where('vitaminCMg', alimentPayload.vitaminCMg ?? 0)
      .where('vitaminB1Mg', alimentPayload.vitaminB1Mg ?? 0)
      .where('vitaminB6Mg', alimentPayload.vitaminB6Mg ?? 0)
      .where('vitaminB9Microg', alimentPayload.vitaminB9Microg ?? 0)
      .where('vitaminB3Mg', alimentPayload.vitaminB3Mg ?? 0)
      .where('vitaminB5Mg', alimentPayload.vitaminB5Mg ?? 0)
      .first()

    if (existing) {
      return existing
    }

    const aliment = await Aliment.create(alimentPayload)
    return aliment
  }

  async getRecents(athleteId: string, mealType?: NutritionMealType) {
    return Nutrition.query()
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .where((query) => {
        query.whereNotNull('alimentId').orWhereNotNull('llmAlimentId')
      })
      .if(mealType, (query) =>
        query.whereIn(
          'mealType',
          mealType!.toLowerCase().includes('snack') ? [...SNACK_DB_MEAL_TYPES] : [mealType!]
        )
      )
      .preload('aliment', (alimentQuery) => {
        alimentQuery.preload('nutritionFavorites', (favoritesQuery) => {
          favoritesQuery.where('athleteId', athleteId)
        })
      })
      .preload('llmAliment')
      .orderBy('updatedAt', 'desc')
      .orderBy('id', 'desc')
      .limit(30)
  }

  async addNutrition(
    athleteId: string,
    payload: Infer<typeof addNutritionSchema> & Infer<typeof addNutritionQuerySchema>
  ) {
    const { mealType, quantity, portion, source, dateOfDay, alimentId, recipeId } = payload
    const day = await this.athleteService.getOrCreateDay(athleteId, DateTime.fromJSDate(dateOfDay))

    await Nutrition.create({
      dayId: day.id,
      mealType,
      quantity,
      portion,
      llmAlimentId: source === 'llmAliment' ? alimentId : null,
      alimentId: source === 'meal' ? alimentId : null,
      recipeId: recipeId ?? null,
    })
  }

  async deleteNutrition(athleteId: string, id: string) {
    await Nutrition.query()
      .where('id', id)
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .delete()
  }

  async getNutrition(athleteId: string, payload: Infer<typeof getNutritionQuerySchema>) {
    const { mealType, dateOfDay } = payload

    return Nutrition.query()
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
        query.where('dateOfDay', dateOfDay)
      })
      .whereIn(
        'mealType',
        mealType.toLowerCase().includes('snack') ? [...SNACK_DB_MEAL_TYPES] : [mealType]
      )
      .preload('aliment', (alimentQuery) => {
        alimentQuery.preload('nutritionFavorites', (favoritesQuery) => {
          favoritesQuery.where('athleteId', athleteId)
        })
      })
      .preload('llmAliment')
      .preload('recipe', (recipeQuery) => {
        recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
          recipeAlimentsQuery.preload('meal')
        })
      })
  }

  async getNutritionSummaryByMealType(
    athleteId: string,
    payload: Infer<typeof getNutritionSummaryQuerySchema>
  ) {
    const { dateOfDay } = payload

    const nutritionEntries = await Nutrition.query()
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
        query.where('dateOfDay', dateOfDay)
      })
      .preload('aliment')
      .preload('llmAliment')
      .preload('recipe', (recipeQuery) => {
        recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
          recipeAlimentsQuery.preload('meal')
        })
      })

    const initSummary = (): MealSummary =>
      ({
        quantity: 0,
        portion: 0,
        ...Object.fromEntries(MEAL_SUMMARY_NUTRIENT_KEYS.map((k) => [k, 0])),
      }) as MealSummary

    const summaries: Record<string, MealSummary> = {}

    for (const mealType of [
      'Breakfast',
      'Lunch',
      'Dinner',
      'Snack AM',
      'Snack PM',
      'intakes',
      'Effort Nutrition',
    ]) {
      summaries[mealType] = initSummary()
    }

    const addContribution = (mealTypes: string[], base: ContributionInput) => {
      if (mealTypes.length === 0 || base.portion == null || base.quantity == null) return

      for (const mealType of mealTypes) {
        if (!mealType) continue
        const lower = mealType.trim().toLowerCase()
        const key =
          lower === 'snack pm'
            ? NUTRITION_MEAL_TYPES.SNACK_PM
            : lower.includes('snack')
              ? NUTRITION_MEAL_TYPES.SNACK_AM
              : mealType.trim()
        if (!summaries[key]) summaries[key] = initSummary()

        const summary = summaries[key]
        const factor = (base.portion * base.quantity) / 100
        summary.quantity += base.quantity
        summary.portion += base.portion * base.quantity

        for (const k of MEAL_SUMMARY_NUTRIENT_KEYS) {
          summary[k] += (base[k] ?? 0) * factor
        }
      }
    }

    for (const nutrition of nutritionEntries) {
      const baseMealType = nutrition.mealType

      const mealData = nutrition.llmAliment ?? nutrition.aliment
      if (mealData) {
        addContribution(
          [baseMealType ?? ''],
          toContributionInput(mealData, nutrition.quantity, nutrition.portion)
        )
      }

      if (nutrition.recipe?.recipeAliments) {
        for (const recipeMeal of nutrition.recipe.recipeAliments) {
          if (!recipeMeal.meal) continue
          addContribution(
            [baseMealType ?? ''],
            toContributionInput(recipeMeal.meal, recipeMeal.quantity, recipeMeal.portion)
          )
        }
      }
    }

    return summaries
  }

  async updateNutrition(
    athleteId: string,
    id: string,
    payload: Infer<typeof updateNutritionSchema>
  ) {
    await Nutrition.query()
      .where('id', id)
      .whereHas('day', (query) => {
        query.where('athleteId', athleteId)
      })
      .update(payload)
  }
}
