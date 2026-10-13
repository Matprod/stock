import Translation from '#models_pg/translation';
import { APP_LANGUAGES } from '#utils/localize';
export class TranslationService {
    async getTranslations(translatableType, key, translatableIds, language) {
        if (translatableIds.length === 0)
            return new Map();
        const translationLanguage = language === APP_LANGUAGES.FR ? APP_LANGUAGES.FR : APP_LANGUAGES.EN;
        const rows = await Translation.query()
            .where('translatable_type', translatableType)
            .whereIn('translatable_id', translatableIds)
            .where('key', key)
            .where('language', translationLanguage);
        return new Map(rows.map((r) => [r.translatableId, r.value]));
    }
    async applyTranslatedNames(entities, translatableType, key, language) {
        const targets = entities.filter((entity) => entity != null && entity.name != null);
        if (targets.length === 0)
            return;
        const translations = await this.getTranslations(translatableType, key, [...new Set(targets.map((entity) => entity.id))], language);
        for (const entity of targets) {
            entity.name = translations.get(entity.id) ?? entity.name;
        }
    }
    async attachTranslatedLabels(entities, translatableType, key, language) {
        const targets = entities.filter((entity) => entity != null);
        if (targets.length === 0)
            return;
        const translations = await this.getTranslations(translatableType, key, [...new Set(targets.map((entity) => entity.id))], language);
        for (const entity of targets) {
            entity.$extras.label = translations.get(entity.id) ?? entity.name ?? '';
        }
    }
}
//# sourceMappingURL=translation_service.js.map