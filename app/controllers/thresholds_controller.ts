import { HttpContext } from '@adonisjs/core/http'
import ThresholdsService from '#services/thresholds_service'
import type { ThresholdsResponse } from '#contracts/thresholds'

export default class ThresholdsController {
  private readonly thresholdsService: ThresholdsService

  constructor() {
    this.thresholdsService = new ThresholdsService()
  }

  async getThresholds({ auth, response, logger }: HttpContext) {
    try {
      const clubId = auth.user!.clubId
      const payload: ThresholdsResponse = await this.thresholdsService.getThresholdsByClubId(clubId)
      return response.json(payload)
    } catch (error) {
      logger.error({ err: error }, 'ThresholdsController: getThresholds failed')
      return response.status(500).json({
        error: 'An internal server error occurred while retrieving thresholds.',
      })
    }
  }
}
