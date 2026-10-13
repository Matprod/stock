import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SeasonMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const xSeasonId = request.header('x-season-id')

    if (xSeasonId) {
      request.updateBody({
        ...request.body(),
        _seasonId: xSeasonId,
      })
    }

    return next()
  }
}
