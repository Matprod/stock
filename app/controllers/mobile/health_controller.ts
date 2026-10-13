import type { HttpContext } from '@adonisjs/core/http'
import {
  addHealthQuerySchema,
  addHealthSchema,
  getHealthSchema,
} from '#schemas/mobile/health'
import HealthService from '#services/mobile/health_service'
import AthleteService from '#services/athlete_service'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service'
import { getLanguageFromRequest } from '#utils/language'
import type { TranslationLanguage } from '#constants/translation.constants'

export default class HealthController {
  private healthService: HealthService
  private athleteService: AthleteService
  private subjectiveScaleService: SubjectiveScaleService
  private subjectiveScaleValuesService: SubjectiveScaleValuesService

  constructor() {
    this.healthService = new HealthService()
    this.athleteService = new AthleteService()
    this.subjectiveScaleService = new SubjectiveScaleService()
    this.subjectiveScaleValuesService = new SubjectiveScaleValuesService()
  }

  private async getClubScales(athleteId: string, language: TranslationLanguage) {
    const athleteRecord = await this.athleteService.getAthleteById(athleteId)
    if (!athleteRecord?.clubId) {
      return []
    }

    return await this.subjectiveScaleService.getScales(athleteRecord.clubId, language)
  }

  public async getHealth({ response, athlete, request }: HttpContext) {
    const { dateOfDay } = await getHealthSchema.validate(request.qs())
    const language = getLanguageFromRequest(request)
    const clubScales = await this.getClubScales(athlete!.athleteid, language)
    const health = await this.healthService.getHealth(athlete!.athleteid, dateOfDay)

    if (!health) {
      return response.json(null)
    }

    await this.healthService.translatePainLocations(
      health.pains.map((pain) => pain.location),
      language
    )

    return response.json(await this.healthService.buildHealthResponse(health, clubScales))
  }

  public async addHealth({ response, athlete, request }: HttpContext) {
    const { dateOfDay } = await addHealthQuerySchema.validate(request.qs())
    const language = getLanguageFromRequest(request)
    const clubScales = await this.getClubScales(athlete!.athleteid, language)
    const payload = await addHealthSchema.validate(request.body())

    const validationError = this.subjectiveScaleValuesService.validateHealthPayload(
      { ratings: payload.ratings, metrics: payload.metrics },
      clubScales
    )
    if (validationError) {
      return response.badRequest({ error: validationError })
    }

    const health = await this.healthService.addOrUpdateHealth(athlete!.athleteid, dateOfDay, {
      pains: payload.pains,
      ratings: payload.ratings,
      metrics: payload.metrics,
      clubScales,
    })
    await this.healthService.translatePainLocations(
      health.pains.map((pain) => pain.location),
      language
    )

    return response.json(await this.healthService.buildHealthResponse(health, clubScales))
  }

  public async getDiscomfortLocations({ response, athlete, request }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }
    const language = getLanguageFromRequest(request)
    const discomfortLocations = await this.healthService.getDiscomfortLocations(language)
    return response.json(
      discomfortLocations.map((discomfortLocation) => discomfortLocation.serialize())
    )
  }

  public async getHealthUtilities({ response, athlete, request }: HttpContext) {
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const language = getLanguageFromRequest(request)
    const { painLocations } = await this.healthService.getUtilities(
      athlete!.athleteid,
      language
    )

    return response.json(painLocations.map((location) => location.serialize()))
  }
}
