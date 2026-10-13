import type { HttpContext } from '@adonisjs/core/http'
import FoodAIService from '#services/llm/food_ai_service'
import { analyzeNutritionFromItemsSchema } from '#schemas/food_ai'
import fs from 'node:fs/promises'
import { DateTime } from 'luxon'
import AthleteService from '#services/athlete_service'
import LlmAliment from '#models_pg/llm_aliment'
import Nutrition from '#models_pg/nutrition'

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function formatPreviewFoodItem(item: {
  name: string
  portion: number
  nutrition_per_100g?: Record<string, unknown>
}) {
  const n = item.nutrition_per_100g ?? {}

  return {
    name: item.name,
    portion: safeNumber(item.portion),
    energyKcal: safeNumber(n.energy_kcal),
    proteinsG: safeNumber(n.proteins_g),
    carbohydrateG: safeNumber(n.carbohydrate_g),
    fatG: safeNumber(n.fat_g),
    fibresG: safeNumber(n.fibres_g),
    sugarsG: safeNumber(n.sugars_g),
    sodiumMg: safeNumber(n.sodium_mg),
    waterG: safeNumber(n.water_g),
    glutenG: safeNumber(n.gluten_g),
    starchG: safeNumber(n.starch_g),
    alcoholG: safeNumber(n.alcohol_g),
    FASaturatedG: safeNumber(n.FA_saturated_g),
    FAMonoG: safeNumber(n.FA_mono_g),
    FAPolyG: safeNumber(n.FA_poly_g),
    FA181G: safeNumber(n.FA_181_g),
    FA182G: safeNumber(n.FA_182_g),
    cholesterolMg: safeNumber(n.cholesterol_mg),
    saltG: safeNumber(n.salt_g),
    calciumMg: safeNumber(n.calcium_mg),
    chlorideMg: safeNumber(n.chloride_mg),
    copperMg: safeNumber(n.copper_mg),
    ironMg: safeNumber(n.iron_mg),
    iodineMicrog: safeNumber(n.iodine_microg),
    magnesiumMg: safeNumber(n.magnesium_mg),
    manganeseMg: safeNumber(n.manganese_mg),
    phosphorusMg: safeNumber(n.phosphorus_mg),
    potassiumMg: safeNumber(n.potassium_mg),
    seleniumMicrog: safeNumber(n.selenium_microg),
    zincMg: safeNumber(n.zinc_mg),
    vitaminDMicrog: safeNumber(n.vitamin_D_microg),
    vitaminEMg: safeNumber(n.vitamin_E_mg),
    vitaminCMg: safeNumber(n.vitamin_C_mg),
    vitaminB1Mg: safeNumber(n.vitamin_B1_mg),
    vitaminB2Mg: safeNumber(n.vitamin_B2_mg),
    vitaminB3Mg: safeNumber(n.vitamin_B3_mg),
    vitaminB5Mg: safeNumber(n.vitamin_B5_mg),
    vitaminB6Mg: safeNumber(n.vitamin_B6_mg),
    vitaminB9Microg: safeNumber(n.vitamin_B9_microg),
    vitaminB12Microg: safeNumber(n.vitamin_B12_microg),
    fructoseG: safeNumber(n.fructose_g),
    glucoseG: safeNumber(n.glucose_g),
    lactoseG: safeNumber(n.lactose_g),
    maltoseG: safeNumber(n.maltose_g),
    sucroseG: safeNumber(n.sucrose_g),
  }
}

export default class FoodAiController {
  private readonly foodAI: FoodAIService
  private readonly athleteService: AthleteService

  constructor() {
    this.foodAI = new FoodAIService()
    this.athleteService = new AthleteService()
  }

  public async recognizeFoodItems({ request, response, athlete }: HttpContext) {
    try {
      const image = request.file('image')
      if (!image) {
        return response.badRequest({ message: 'No image provided' })
      }
      if (!image.isValid) {
        return response.badRequest({ message: 'Invalid image', errors: image.errors })
      }
      if (!image.tmpPath) {
        return response.badRequest({ message: 'Invalid image upload' })
      }

      const buffer = await fs.readFile(image.tmpPath)
      const acceptLanguage = request.header('Accept-Language')

      const items = await this.foodAI.recognizeFoodItems({
        imageBuffer: buffer,
        athleteId: athlete!.athleteid,
        acceptLanguage,
      })

      return response.json(items)
    } catch (e) {
      console.error('Error in recognizeFoodItems', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'Error recognizing food items',
      })
    }
  }

  public async analyzeNutritionFromItems({ request, response, athlete }: HttpContext) {
    try {
      const payload = await request.validateUsing(analyzeNutritionFromItemsSchema)
      const acceptLanguage = request.header('Accept-Language')

      const foodData = await this.foodAI.analyzeNutritionFromFoodItems({
        foodItems: payload.foodItems,
        acceptLanguage,
      })

      const shouldPersist = payload.persist !== false

      if (!shouldPersist) {
        return response.json(foodData.map(formatPreviewFoodItem))
      }

      const dateOfMeal = (() => {
        if (payload.dateOfMeal) {
          const dt = DateTime.fromISO(payload.dateOfMeal, { zone: 'utc' })
          if (dt.isValid) return dt
        }
        return DateTime.now()
      })()

      const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
      if (!athleteRecord) {
        return response.notFound({ message: 'Athlete not found' })
      }

      const day = await this.athleteService.getOrCreateDay(athleteRecord.id, dateOfMeal)

      let mealType = payload.mealType ?? 'Lunch'
      if (mealType.toLowerCase().includes('effort_nutrition')) {
        mealType = 'Effort Nutrition'
      }

      const created: any[] = []

      for (const item of foodData) {
        const n = item.nutrition_per_100g ?? {}
        const preview = formatPreviewFoodItem(item)

        const llmAliment = await LlmAliment.create({
          name: item.name,
          portion: safeNumber(item.portion),
          portionUnit: 'g',

          energyKcal: safeNumber(n.energy_kcal),
          waterG: safeNumber(n.water_g),
          proteinsG: safeNumber(n.proteins_g),
          carbohydrateG: safeNumber(n.carbohydrate_g),
          fatG: safeNumber(n.fat_g),
          fibresG: safeNumber(n.fibres_g),
          sugarsG: safeNumber(n.sugars_g),
          sodiumMg: safeNumber(n.sodium_mg),
          glutenG: safeNumber(n.gluten_g),
          starchG: safeNumber(n.starch_g),
          alcoholG: safeNumber(n.alcohol_g),

          faSaturatedG: safeNumber(n.FA_saturated_g),
          faMonoG: safeNumber(n.FA_mono_g),
          faPolyG: safeNumber(n.FA_poly_g),
          fa181G: safeNumber(n.FA_181_g),
          fa182G: safeNumber(n.FA_182_g),
          cholesterolMg: safeNumber(n.cholesterol_mg),
          saltG: safeNumber(n.salt_g),
          calciumMg: safeNumber(n.calcium_mg),
          chlorideMg: safeNumber(n.chloride_mg),
          copperMg: safeNumber(n.copper_mg),
          ironMg: safeNumber(n.iron_mg),
          iodineMicrog: safeNumber(n.iodine_microg),
          magnesiumMg: safeNumber(n.magnesium_mg),
          manganeseMg: safeNumber(n.manganese_mg),
          phosphorusMg: safeNumber(n.phosphorus_mg),
          potassiumMg: safeNumber(n.potassium_mg),
          seleniumMicrog: safeNumber(n.selenium_microg),
          zincMg: safeNumber(n.zinc_mg),
          vitaminDMicrog: safeNumber(n.vitamin_D_microg),
          vitaminEMg: safeNumber(n.vitamin_E_mg),
          vitaminCMg: safeNumber(n.vitamin_C_mg),
          vitaminB1Mg: safeNumber(n.vitamin_B1_mg),
          vitaminB2Mg: safeNumber(n.vitamin_B2_mg),
          vitaminB3Mg: safeNumber(n.vitamin_B3_mg),
          vitaminB5Mg: safeNumber(n.vitamin_B5_mg),
          vitaminB6Mg: safeNumber(n.vitamin_B6_mg),
          vitaminB9Microg: safeNumber(n.vitamin_B9_microg),
          vitaminB12Microg: safeNumber(n.vitamin_B12_microg),
          fructoseG: safeNumber(n.fructose_g),
          glucoseG: safeNumber(n.glucose_g),
          lactoseG: safeNumber(n.lactose_g),
          maltoseG: safeNumber(n.maltose_g),
          sucroseG: safeNumber(n.sucrose_g),
        })

        const nutrition = await Nutrition.create({
          dayId: day.id,
          mealType,
          quantity: 1,
          portion: safeNumber(item.portion),
          llmAlimentId: llmAliment.id,
          alimentId: null,
          recipeId: null,
        })

        created.push({
          id: nutrition.id,
          date_of_meal: dateOfMeal.toFormat('yyyy-MM-dd'),
          reference_database: 'Llm Analysis',
          ...preview,
        })
      }
      return response.json(created)
    } catch (e) {
      console.error('Error in analyzeNutritionFromItems', e)
      return response.internalServerError({
        message: e instanceof Error ? e.message : 'Error analyzing nutrition',
      })
    }
  }
}
