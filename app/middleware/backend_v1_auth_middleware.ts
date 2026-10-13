import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

export default class BackendV1AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = ctx.request.header('Backend-V1-Token')

    const expectedToken = env.get('BACKEND_V1_TOKEN')

    if (token !== expectedToken) {
      return ctx.response.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      })
    }

    return next()
  }
}
