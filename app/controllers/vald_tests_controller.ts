import type { HttpContext } from '@adonisjs/core/http'
import {
  listValdTestsQuerySchema,
  valdTestTypesQuerySchema,
  valdTrendQuerySchema,
} from '#schemas/vald_test'
import SeasonService from '#services/season_service'
import ValdTestsService from '#services/vald_tests_service'

export default class ValdTestsController {
  private valdTestsService = new ValdTestsService()
  private seasonService = new SeasonService()

  async getAll({ response, auth, request }: HttpContext) {
    const filters = await listValdTestsQuerySchema.validate(request.qs())
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user!.clubId)
    const result = await this.valdTestsService.getValdTestsByClub(
      auth.user!.clubId,
      filters,
      seasonInfo.seasonStartDate,
      seasonInfo.seasonEndDate
    )
    return response.ok(result)
  }

  async getTypes({ response, auth, request }: HttpContext) {
    const filters = await valdTestTypesQuerySchema.validate(request.qs())
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user!.clubId)
    const testTypes = await this.valdTestsService.getAvailableTestTypes(
      auth.user!.clubId,
      filters,
      seasonInfo.seasonStartDate,
      seasonInfo.seasonEndDate
    )
    return response.ok({ data: testTypes })
  }

  async getTrend({ response, auth, request }: HttpContext) {
    const { athleteIds, testType } = await valdTrendQuerySchema.validate(request.qs())
    const seasonInfo = await this.seasonService.getSeasonFromRequest(request, auth.user!.clubId)
    const result = await this.valdTestsService.getTrend(
      auth.user!.clubId,
      athleteIds,
      testType,
      seasonInfo.seasonStartDate,
      seasonInfo.seasonEndDate
    )
    if (!result) {
      return response.notFound({ message: 'Athlete not found' })
    }
    return response.ok(result)
  }
}
