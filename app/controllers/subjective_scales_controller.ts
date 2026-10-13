import type { HttpContext } from '@adonisjs/core/http'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import { getLanguageFromRequest } from '#utils/language'

export default class SubjectiveScalesController {
  private subjectiveScaleService = new SubjectiveScaleService()

  public async getScales({ response, auth, request }: HttpContext) {
    const clubId = auth.user?.clubId
    if (!clubId) {
      return response.notFound({ error: 'Club not found' })
    }

    const language = getLanguageFromRequest(request)
    const scales = await this.subjectiveScaleService.getScales(clubId, language)

    return response.json(scales)
  }
}
