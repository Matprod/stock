import type { HttpContext } from '@adonisjs/core/http'
import { MyCoachService } from '#services/my_coach_service'

export default class MyCoachController {
  private readonly myCoachService: MyCoachService
  
  constructor() {
    this.myCoachService = new MyCoachService()
  }

  public async getAnalysisVariables({ request, response }: HttpContext) {
    try {
      const { playerId, isFetchPast } = request.body()
      
      const data = await this.myCoachService.fetchPlayerDataByTimeRange(
        isFetchPast === 'true',
        playerId
      )

      return response.json(data)
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch MyCoach data',
        error: error.message
      })
    }
  }
} 