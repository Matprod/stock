import { getAllPainsSchema } from '#schemas/pain'
import { HealthPainService } from '#services/health_pain_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class HealthPainsController {
  private healthPainService: HealthPainService

  constructor() {
    this.healthPainService = new HealthPainService()
  }

  async getAllPains({ response, auth, request }: HttpContext) {
    const { athleteId } = await getAllPainsSchema.validate(request.qs())
    const pains = await this.healthPainService.getAllPains({ athleteId, clubId: auth.user!.clubId })
    return response.json(pains)
  }
}
