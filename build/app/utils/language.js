import { APP_LANGUAGES, parseAppLanguage } from '#utils/localize';
export function getLanguageFromRequest(request) {
    const bodyLanguage = parseAppLanguage(request.body()._language);
    if (bodyLanguage)
        return bodyLanguage;
    const xLanguage = parseAppLanguage(request.header('x-language'));
    if (xLanguage)
        return xLanguage;
    return APP_LANGUAGES.EN;
}
//# sourceMappingURL=language.js.map