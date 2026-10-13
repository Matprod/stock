import { APP_LANGUAGES, parseAppLanguage } from '#utils/localize';
export default class LanguageMiddleware {
    async handle({ request }, next) {
        const acceptLanguage = request.header('accept-language');
        const xLanguage = request.header('x-language');
        const xLocale = request.header('x-locale');
        let language = APP_LANGUAGES.FR;
        const parsedXLanguage = parseAppLanguage(xLanguage);
        if (parsedXLanguage) {
            language = parsedXLanguage;
        }
        else if (xLocale) {
            const localeLang = parseAppLanguage(xLocale.split('-')[0]);
            if (localeLang) {
                language = localeLang;
            }
        }
        else if (acceptLanguage) {
            const preferredLang = parseAppLanguage(acceptLanguage.split(',')[0].split('-')[0]);
            if (preferredLang) {
                language = preferredLang;
            }
        }
        request.updateBody({ ...request.body(), _language: language });
        return next();
    }
}
//# sourceMappingURL=language_middleware.js.map