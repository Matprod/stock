import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { APP_LANGUAGES, parseAppLanguage } from '#utils/localize'

export default class LanguageMiddleware {
  async handle({ request }: HttpContext, next: NextFn) {
    const acceptLanguage = request.header('accept-language')
    const xLanguage = request.header('x-language')
    const xLocale = request.header('x-locale')

    // Priorité: x-language > x-locale > accept-language > FR par défaut
    let language: string = APP_LANGUAGES.FR

    const parsedXLanguage = parseAppLanguage(xLanguage)
    if (parsedXLanguage) {
      language = parsedXLanguage
    } else if (xLocale) {
      // Convertir locale en langue (ex: fr-FR -> FR, en-US -> EN)
      const localeLang = parseAppLanguage(xLocale.split('-')[0])
      if (localeLang) {
        language = localeLang
      }
    } else if (acceptLanguage) {
      // Parser accept-language header (ex: "fr-FR,fr;q=0.9,en;q=0.8")
      const preferredLang = parseAppLanguage(acceptLanguage.split(',')[0].split('-')[0])
      if (preferredLang) {
        language = preferredLang
      }
    }
    // Ajouter la langue au contexte de la requête
    request.updateBody({ ...request.body(), _language: language })

    return next()
  }
}
