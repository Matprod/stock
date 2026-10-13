import { TranslatableType, TranslationKey } from '#constants/translation.constants'
import Translation from '#models_pg/translation'
import { type AppLanguage, APP_LANGUAGES } from '#utils/localize'

type NamedEntity = { id: string; name: string }

type LabeledEntity = {
  id: string
  name?: string | null
  $extras: Record<string, unknown>
}

export class TranslationService {
  public async getTranslations(
    translatableType: TranslatableType,
    key: TranslationKey,
    translatableIds: Array<string>,
    language: AppLanguage
  ): Promise<Map<string, string>> {
    if (translatableIds.length === 0) return new Map()

    const translationLanguage = language === APP_LANGUAGES.FR ? APP_LANGUAGES.FR : APP_LANGUAGES.EN
    const rows = await Translation.query()
      .where('translatable_type', translatableType)
      .whereIn('translatable_id', translatableIds)
      .where('key', key)
      .where('language', translationLanguage)

    return new Map(rows.map((r) => [r.translatableId, r.value]))
  }

  public async applyTranslatedNames(
    entities: Array<NamedEntity | null | undefined>,
    translatableType: TranslatableType,
    key: TranslationKey,
    language: AppLanguage
  ): Promise<void> {
    const targets = entities.filter(
      (entity): entity is NamedEntity => entity != null && entity.name != null
    )
    if (targets.length === 0) return

    const translations = await this.getTranslations(
      translatableType,
      key,
      [...new Set(targets.map((entity) => entity.id))],
      language
    )

    for (const entity of targets) {
      entity.name = translations.get(entity.id) ?? entity.name
    }
  }
  public async attachTranslatedLabels(
    entities: Array<LabeledEntity | null | undefined>,
    translatableType: TranslatableType,
    key: TranslationKey,
    language: AppLanguage
  ): Promise<void> {
    const targets = entities.filter((entity): entity is LabeledEntity => entity != null)
    if (targets.length === 0) return

    const translations = await this.getTranslations(
      translatableType,
      key,
      [...new Set(targets.map((entity) => entity.id))],
      language
    )

    for (const entity of targets) {
      entity.$extras.label = translations.get(entity.id) ?? entity.name ?? ''
    }
  }
}
