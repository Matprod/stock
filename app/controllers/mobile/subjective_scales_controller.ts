import type { HttpContext } from '@adonisjs/core/http'
import AthleteService from '#services/athlete_service'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { getLanguageFromRequest } from '#utils/language'

export default class SubjectiveScalesController {
  private athleteService: AthleteService
  private subjectiveScaleService: SubjectiveScaleService

  constructor() {
    this.athleteService = new AthleteService()
    this.subjectiveScaleService = new SubjectiveScaleService()
  }

  public async getScales({ response, athlete, request }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const language = getLanguageFromRequest(request)
    const scales = await this.subjectiveScaleService.getScales(
      athleteRecord.clubId ?? null,
      language
    )

    return response.json(scales)
  }
}
