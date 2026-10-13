import type { HttpContext } from '@adonisjs/core/http'
import AthleteService from '#services/athlete_service'
import RegisterUtilitiesService from '#services/mobile/register_utilities_service'
import { getLanguageFromRequest } from '#utils/language'

export default class RegisterUtilitiesController {
  private athleteService: AthleteService
  private registerUtilitiesService: RegisterUtilitiesService

  constructor() {
    this.athleteService = new AthleteService()
    this.registerUtilitiesService = new RegisterUtilitiesService()
  }

  public async getRegisterUtilities({ response, athlete, request }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const language = getLanguageFromRequest(request)
    const utilities = await this.registerUtilitiesService.getRegisterUtilities(language)

    const payload = {
      sports: utilities.sports.map((sport) => sport.serialize()),
      frontZones: utilities.frontZones.map((zone) => zone.serialize()),
      backZones: utilities.backZones.map((zone) => zone.serialize()),
      frontPainZones: utilities.frontPainZones.map((zone) => zone.serialize()),
      backPainZones: utilities.backPainZones.map((zone) => zone.serialize()),
    }

    return response.json(payload)
  }
}
