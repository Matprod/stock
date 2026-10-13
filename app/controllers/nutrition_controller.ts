import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { nutritionDateSchema } from '#schemas/nutrition'
import { athleteIdParamSchema } from '#schemas/athlete'
import NutritionService from '#services/nutrition_service'
import AthleteService from '#services/athlete_service'

export default class NutritionController {
  private nutritionService: NutritionService
  private athleteService: AthleteService
  constructor() {
    this.nutritionService = new NutritionService()
    this.athleteService = new AthleteService()
  }

  private async validateRequest(params: HttpContext['params'], request: HttpContext['request']) {
    const validatedAthleteId = await athleteIdParamSchema.validate(params)
    const validatedDate = await nutritionDateSchema.validate(request.qs())
    const date = DateTime.fromJSDate(validatedDate.date)
    return { athleteId: validatedAthleteId.athleteId, date }
  }

  async getMealsFilled({ params, request, response }: HttpContext) {
    try {
      const { athleteId, date } = await this.validateRequest(params, request)

      let day = await this.nutritionService.getDayWithNutrition(athleteId, date)
      if (!day) {
        await this.athleteService.getOrCreateDay(athleteId, date)
        day = await this.nutritionService.getDayWithNutrition(athleteId, date)
      }

      const mealsFilled = await this.nutritionService.getMealsFilled(day!)
      const skippedMeals = await this.nutritionService.getSkippedMeals(day!.id)

      return response.ok({
        ...mealsFilled,
        skippedMeals,
      })
    } catch (error) {
      return response.internalServerError({ error: 'Internal server error' })
    }
  }

  async getNutritionDetail({ params, request, response }: HttpContext) {
    try {
      const { athleteId, date } = await this.validateRequest(params, request)

      let day = await this.nutritionService.getDayWithNutrition(athleteId, date)
      if (!day) {
        day = await this.athleteService.getOrCreateDay(athleteId, date)
      }

      return response.ok(this.nutritionService.formatNutritionDetail(day))
    } catch (error) {
      return response.internalServerError({ error: 'Internal server error' })
    }
  }
}
