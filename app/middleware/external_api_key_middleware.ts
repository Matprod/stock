import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'
import type ClubApiKey from '#models_pg/club_api_key'
import ExternalApiKeyService from '#services/external_api_key_service'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    externalApiKey?: ClubApiKey
  }
}

export default class ExternalApiKeyMiddleware {
  constructor(private readonly apiKeyService = new ExternalApiKeyService()) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('Authorization')?.trim() ?? ''
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    const apiKey = token ? await this.apiKeyService.authenticate(token) : null

    if (!apiKey) {
      return ctx.response.unauthorized({ message: 'Invalid API key' })
    }

    ctx.externalApiKey = apiKey
    void this.apiKeyService.touchLastUsed(apiKey).catch((error) => {
      logger.warn({ error, apiKeyId: apiKey.id }, 'Failed to update API key lastUsedAt')
    })
    return next()
  }
}
