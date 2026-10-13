import type { HttpContext } from '@adonisjs/core/http'
import { type AppLanguage, APP_LANGUAGES, parseAppLanguage } from '#utils/localize'

/**
 * Récupère la langue depuis une requête HTTP
 * @param request - L'objet request
 * @returns La langue détectée (fr par défaut)
 */
export function getLanguageFromRequest(request: HttpContext['request']): AppLanguage {
  const bodyLanguage = parseAppLanguage(request.body()._language)
  if (bodyLanguage) return bodyLanguage

  const xLanguage = parseAppLanguage(request.header('x-language'))
  if (xLanguage) return xLanguage

  return APP_LANGUAGES.EN
}
