import type { HttpContext } from '@adonisjs/core/http'
import ExternalAthleteService from '#services/external_athlete_service'

export default class ExternalAthletesController {
  constructor(private readonly athleteService = new ExternalAthleteService()) {}

  async index({ response, externalApiKey }: HttpContext) {
    const athletes = await this.athleteService.listByClub(externalApiKey!.clubId)
    return response.json({ data: athletes })
  }
}
