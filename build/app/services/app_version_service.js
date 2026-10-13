import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import AppVersion from '#models_pg/app_version';
import { TranslationService } from '#services/translation_service';
import { isVersionLower, parseAppPlatform } from '#utils/app_version';
import { APP_LANGUAGES } from '#utils/localize';
export class AppVersionService {
    translationService;
    constructor(translationService = new TranslationService()) {
        this.translationService = translationService;
    }
    async getUpdateRequired(appVersion, platform, language) {
        const parsedPlatform = parseAppPlatform(platform);
        if (!parsedPlatform) {
            return null;
        }
        const requiredVersion = await this.getRequiredVersionForPlatform(parsedPlatform);
        const minimalSupportedVersion = requiredVersion?.version ?? null;
        if (!requiredVersion ||
            !minimalSupportedVersion ||
            !isVersionLower(appVersion, minimalSupportedVersion)) {
            return null;
        }
        return {
            updateMessage: await this.resolveUpdateMessage(requiredVersion, language),
        };
    }
    async getRequiredVersionForPlatform(platform) {
        const rows = await AppVersion.query().where('platform', platform).where('status', 'required');
        return rows.reduce((highest, row) => (!highest || isVersionLower(highest.version, row.version) ? row : highest), null);
    }
    async resolveUpdateMessage(appVersion, language) {
        const resolvedLanguage = language ?? APP_LANGUAGES.EN;
        const translations = await this.translationService.getTranslations(TRANSLATABLE_TYPES.APP_VERSION, TRANSLATION_KEYS.APP_VERSION_UPDATE_MESSAGE, [appVersion.id], resolvedLanguage);
        const translatedMessage = translations.get(appVersion.id)?.trim();
        return translatedMessage || appVersion.updateMessage || null;
    }
}
//# sourceMappingURL=app_version_service.js.map