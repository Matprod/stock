import type { HttpContext } from '@adonisjs/core/http'
import ExternalScoreService from '#services/external_score_service'
import { getExternalScoresSchema } from '#schemas/external'

export default class ExternalScoresController {
  constructor(private readonly scoreService = new ExternalScoreService()) {}

  async index({ request, response, externalApiKey }: HttpContext) {
    const filters = await getExternalScoresSchema.validate(request.qs())
    const result = await this.scoreService.listByClub({
      clubId: externalApiKey!.clubId,
      ...filters,
    })

    return response.json(result)
  }
}
