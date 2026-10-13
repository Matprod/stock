import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AthleteTokenService, { TokenError } from '#services/athlete_token_service'
import type { AthleteAccessPayload } from '#services/athlete_token_service'
import { AppVersionService } from '#services/app_version_service'
import { getLanguageFromRequest } from '#utils/language'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    athlete?: AthleteAccessPayload
    athleteToken?: string
  }
}

export default class MobileMiddleware {
  constructor(private readonly appVersionService = new AppVersionService()) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const appVersion = ctx.request.header('x-app-version')?.trim()
    const platform = ctx.request.header('x-app-platform')?.trim()

    if (appVersion && platform) {
      const updateRequired = await this.appVersionService.getUpdateRequired(
        appVersion,
        platform,
        getLanguageFromRequest(ctx.request)
      )

      if (updateRequired) {
        return ctx.response.status(426).json(updateRequired)
      }
    }

    const token = ctx.request.header('Authorization')?.trim() ?? null

    if (!token) {
      return ctx.response.status(401).json({
        success: false,
        message: 'No token provided',
      })
    }

    try {
      const payload = await AthleteTokenService.verifyAccessToken(token)
      ctx.athlete = payload
      ctx.athleteToken = token
      return next()
    } catch (err) {
      const message = err instanceof TokenError ? err.message : 'Token is invalid'
      return ctx.response.status(401).json({
        success: false,
        message,
      })
    }
  }
}
