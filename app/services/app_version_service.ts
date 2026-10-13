import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants'
import type { AppPlatform } from '#contracts/mobile/app_version'
import AppVersion from '#models_pg/app_version'
import { TranslationService } from '#services/translation_service'
import { isVersionLower, parseAppPlatform } from '#utils/app_version'
import { type AppLanguage, APP_LANGUAGES } from '#utils/localize'

export class AppVersionService {
  constructor(private readonly translationService = new TranslationService()) {}

  async getUpdateRequired(
    appVersion: string,
    platform: string,
    language?: AppLanguage
  ): Promise<{ updateMessage: string | null } | null> {
    const parsedPlatform = parseAppPlatform(platform)

    if (!parsedPlatform) {
      return null
    }

    const requiredVersion = await this.getRequiredVersionForPlatform(parsedPlatform)
    const minimalSupportedVersion = requiredVersion?.version ?? null

    if (
      !requiredVersion ||
      !minimalSupportedVersion ||
      !isVersionLower(appVersion, minimalSupportedVersion)
    ) {
      return null
    }

    return {
      updateMessage: await this.resolveUpdateMessage(requiredVersion, language),
    }
  }

  private async getRequiredVersionForPlatform(platform: AppPlatform): Promise<AppVersion | null> {
    const rows = await AppVersion.query().where('platform', platform).where('status', 'required')

    return rows.reduce<AppVersion | null>(
      (highest, row) => (!highest || isVersionLower(highest.version, row.version) ? row : highest),
      null
    )
  }

  private async resolveUpdateMessage(
    appVersion: AppVersion,
    language?: AppLanguage
  ): Promise<string | null> {
    const resolvedLanguage = language ?? APP_LANGUAGES.EN

    const translations = await this.translationService.getTranslations(
      TRANSLATABLE_TYPES.APP_VERSION,
      TRANSLATION_KEYS.APP_VERSION_UPDATE_MESSAGE,
      [appVersion.id],
      resolvedLanguage
    )

    const translatedMessage = translations.get(appVersion.id)?.trim()

    return translatedMessage || appVersion.updateMessage || null
  }
}
