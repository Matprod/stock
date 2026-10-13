import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import JevService, { type TypeSafeClient } from '#services/jev_service'
import type { AppLanguage } from '#utils/localize'

export type IntentProvider = 'jev' | 'haiku'

export const jevUnavailableMessage = (language: AppLanguage = 'en'): string =>
  language === 'fr'
    ? 'Le service de rapport est momentanément indisponible. Réessayez dans un instant.'
    : 'The report service is temporarily unavailable. Please try again in a moment.'

export const isJevUnavailableError = (error: unknown): boolean =>
  error instanceof Exception && error.status === 503

export const throwJevUnavailable = (args?: {
  cause?: unknown
  language?: AppLanguage
  context?: string
}): never => {
  if (args?.cause && isJevUnavailableError(args.cause)) throw args.cause
  logger.warn(
    { err: args?.cause, context: args?.context ?? 'jev' },
    'report_v4.jev_unavailable'
  )
  throw new Exception(jevUnavailableMessage(args?.language ?? 'en'), { status: 503 })
}

export const requireJevClient = (args?: {
  language?: AppLanguage
  context?: string
}): TypeSafeClient => {
  const client = JevService.getClient()
  if (!client) {
    throwJevUnavailable({ language: args?.language, context: args?.context ?? 'jev_client' })
  }
  return client as TypeSafeClient
}

export const runIntentClassifier = async <T>(args: {
  context: string
  language?: AppLanguage
  jev: (client: TypeSafeClient) => Promise<T>
  haiku: () => Promise<T>
}): Promise<{ value: T; provider: IntentProvider }> => {
  const client = JevService.getClient()
  if (client) {
    try {
      const value = await args.jev(client)
      return { value, provider: 'jev' }
    } catch (error) {
      if (isJevUnavailableError(error)) throw error
      logger.warn({ err: error, context: args.context }, 'report_v4.jev_failed_trying_haiku')
    }
  } else {
    logger.warn({ context: args.context }, 'report_v4.jev_missing_trying_haiku')
  }

  try {
    const value = await args.haiku()
    logger.info({ context: args.context, provider: 'haiku' }, 'report_v4.intent_haiku_fallback')
    return { value, provider: 'haiku' }
  } catch (error) {
    return throwJevUnavailable({
      cause: error,
      language: args.language,
      context: `${args.context}_haiku`,
    })
  }
}
