import type { HttpContext } from '@adonisjs/core/http'
import { EvolutionService } from '#services/mobile/evolution_service'
import { getEvolutionQuerySchema } from '#schemas/mobile/evolution'

export default class EvolutionController {
  private evolutionService: EvolutionService

  constructor() {
    this.evolutionService = new EvolutionService()
  }

  public async getSleepEvolution({ response, athlete, request }: HttpContext) {
    const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs())
    const evolution = await this.evolutionService.getSleepEvolution(
      athlete!.athleteid,
      startDate,
      endDate
    )
    return response.json(evolution)
  }

  public async getHealthEvolution({ response, athlete, request }: HttpContext) {
    const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs())

    const evolution = await this.evolutionService.getHealthEvolution(
      athlete!.athleteid,
      startDate,
      endDate
    )

    return response.json(evolution)
  }

  public async getActivityEvolution({ response, athlete, request }: HttpContext) {
    const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs())
    const evolution = await this.evolutionService.getActivityEvolution(
      athlete!.athleteid,
      startDate,
      endDate
    )
    return response.json(evolution)
  }

  public async getNutritionEvolution({ response, athlete, request }: HttpContext) {
    const { startDate, endDate } = await getEvolutionQuerySchema.validate(request.qs())
    const evolution = await this.evolutionService.getNutritionEvolution(
      athlete!.athleteid,
      startDate,
      endDate
    )
    return response.json(evolution)
  }
}
