import DiscomfortLocation from '#models_pg/pain_discomfort_location'
import { getAllPainsBySportActivityIdParamsSchema, getAllPainsSchema } from '#schemas/pain'
import {
  deleteActivityPainParamsSchema,
  upsertActivityPainParamsSchema,
  upsertActivityPainSchema,
} from '#schemas/sport_activity_schema'
import { PainService } from '#services/pain_service'
import { TranslationService } from '#services/translation_service'
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import type { HttpContext } from '@adonisjs/core/http'
import { getLanguageFromRequest } from '#utils/language'

export default class PainsController {
  private painService: PainService
  private translationService: TranslationService

  constructor() {
    this.painService = new PainService()
    this.translationService = new TranslationService()
  }

  private getContextIdentifiers({
    auth,
    athlete,
  }: {
    auth?: HttpContext['auth']
    athlete?: HttpContext['athlete']
  }) {
    const clubId = auth?.user?.clubId
    const athleteId = athlete?.athleteid

    return { clubId, athleteId }
  }

  private async translateLocations(
    locations: Array<{ id: string; name: string | null } | null | undefined>,
    language: ReturnType<typeof getLanguageFromRequest>
  ) {
    await this.translationService.applyTranslatedNames(
      locations.filter(
        (location): location is { id: string; name: string } =>
          location != null && location.name != null
      ),
      TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION,
      TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME,
      language
    )
  }

  async getLocations({ response, request }: HttpContext) {
    const language = getLanguageFromRequest(request)
    const locations = await DiscomfortLocation.query().preload('zone')
    await this.translateLocations(locations, language)
    return response.json(locations)
  }

  async getAllPains({ response, auth, request }: HttpContext) {
    const { athleteId } = await getAllPainsSchema.validate(request.qs())
    const language = getLanguageFromRequest(request)
    const pains = await this.painService.getAllPains({ athleteId, clubId: auth.user!.clubId })
    await this.translateLocations(
      pains.map((pain) => pain.location),
      language
    )
    return response.json(pains)
  }

  async getAllPainsBySportActivityId({ response, params, auth, athlete, request }: HttpContext) {
    const { sportActivityId } = await getAllPainsBySportActivityIdParamsSchema.validate(params)

    const { clubId, athleteId } = this.getContextIdentifiers({ auth, athlete })
    if (!clubId && !athleteId) {
      return response.status(401).json({
        success: false,
        message: 'Contexte utilisateur non trouvé',
      })
    }

    const language = getLanguageFromRequest(request)
    const pains = await this.painService.getAllPainsBySportActivityId({
      sportActivityId,
      clubId,
      athleteId,
    })
    await this.translateLocations(
      pains.map((pain) => pain.location),
      language
    )

    return response.json(pains)
  }

  async upsertActivityPain({ response, params, request, auth, athlete }: HttpContext) {
    const { sportActivityId } = await upsertActivityPainParamsSchema.validate(params)
    const { rating, locationId } = await upsertActivityPainSchema.validate(request.body())

    const { clubId, athleteId } = this.getContextIdentifiers({ auth, athlete })
    if (!clubId && !athleteId) {
      return response.status(401).json({
        success: false,
        message: 'Contexte utilisateur non trouvé',
      })
    }

    const pain = await this.painService.upsertPain({
      sportActivityId,
      locationId,
      rating,
      clubId,
      athleteId,
    })

    return response.json(pain)
  }

  async deletePain({ response, params, auth, athlete }: HttpContext) {
    const { painId } = await deleteActivityPainParamsSchema.validate(params)

    const { clubId, athleteId } = this.getContextIdentifiers({ auth, athlete })
    if (!clubId && !athleteId) {
      return response.status(401).json({
        success: false,
        message: 'Contexte utilisateur non trouvé',
      })
    }

    await this.painService.deletePain(painId, { clubId, athleteId })

    return response.json({ success: true })
  }
}
