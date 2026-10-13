import { TRANSLATABLE_TYPES, } from '#constants/translation.constants';
import { SUBJECTIVE_VARIABLE_DESCRIPTION_KEY, SUBJECTIVE_VARIABLE_NAME_KEY, SUBJECTIVE_VARIABLE_LEVEL_KEY, } from '#constants/subjective_translation.constants';
import { subjectiveDomainToDisplayContext, } from '#contracts/subjective_variable';
import SubjectiveFieldConfig from '#models_pg/subjective_field_config';
import { TranslationService } from '#services/translation_service';
import { subjectiveFieldNameToModelAttribute } from '#utils/subjective_field_name';
import string from '@adonisjs/core/helpers/string';
export class SubjectiveScaleService {
    translationService = new TranslationService();
    getLevelKeys(config) {
        const min = Math.max(0, config.minScale);
        const max = Math.max(0, config.maxScale);
        if (max < min)
            return [];
        return Array.from({ length: max - min + 1 }, (_, i) => SUBJECTIVE_VARIABLE_LEVEL_KEY(min + i));
    }
    toFieldResponse(field) {
        return {
            id: field.id,
            fieldName: field.fieldName,
            domain: field.domain,
            context: field.context,
            min: field.min,
            max: field.max,
            isReversed: field.isReversed,
            gap: field.gap,
            label: field.label,
            help: {
                intro: field.intro,
                descriptions: field.descriptions,
            },
        };
    }
    matchesFilter(field, filter) {
        if (!filter)
            return true;
        if (filter.context && field.context !== filter.context) {
            return false;
        }
        if (filter.domains?.length && !filter.domains.includes(field.domain)) {
            return false;
        }
        return true;
    }
    async getTranslationsByKeys(translatableIds, keys, language) {
        if (translatableIds.length === 0 || keys.length === 0)
            return [];
        const translationMaps = await Promise.all(keys.map((key) => this.translationService
            .getTranslations(TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE, key, translatableIds.map(String), language)
            .then((map) => ({ key, map }))));
        return translationMaps.flatMap(({ key, map }) => Array.from(map, ([translatableId, value]) => ({
            translatableId,
            key,
            value,
        })));
    }
    async getClubCatalogue(clubId, language) {
        const configs = await SubjectiveFieldConfig.query().where('clubId', clubId);
        if (configs.length === 0)
            return [];
        const configIds = configs.map((config) => config.id);
        const [nameRows, descriptionRows] = await Promise.all([
            this.getTranslationsByKeys(configIds, [SUBJECTIVE_VARIABLE_NAME_KEY], language),
            this.getTranslationsByKeys(configIds, [SUBJECTIVE_VARIABLE_DESCRIPTION_KEY], language),
        ]);
        const levelKeys = Array.from(new Set(configs.flatMap((config) => this.getLevelKeys(config))));
        const levelRows = await this.getTranslationsByKeys(configIds, levelKeys, language);
        const nameByConfigId = new Map(nameRows.map((row) => [row.translatableId, row.value]));
        const descriptionByConfigId = new Map(descriptionRows.map((row) => [row.translatableId, row.value]));
        const levelByConfigAndKey = new Map(levelRows.map((row) => [`${row.translatableId}:${row.key}`, row.value]));
        return configs.map((config) => {
            const domain = config.domain;
            const fieldName = subjectiveFieldNameToModelAttribute(domain, config.fieldName);
            const min = Math.max(0, config.minScale);
            const max = Math.max(0, config.maxScale);
            return {
                id: config.id,
                fieldName,
                domain,
                context: subjectiveDomainToDisplayContext(domain),
                min,
                max,
                isReversed: Boolean(config.isReversed),
                gap: config.gap ?? null,
                label: nameByConfigId.get(config.id) || '',
                intro: descriptionByConfigId.get(config.id) || '',
                descriptions: Array.from({ length: max >= min ? max - min + 1 : 0 }, (_, i) => {
                    const level = min + i;
                    return {
                        level,
                        description: levelByConfigAndKey.get(`${config.id}:${SUBJECTIVE_VARIABLE_LEVEL_KEY(level)}`) || '',
                    };
                }),
            };
        });
    }
    async getClubCatalogueMap(clubId, language, filter) {
        const catalogue = await this.getClubCatalogue(clubId, language);
        const filtered = catalogue.filter((field) => this.matchesFilter(field, filter));
        return new Map(filtered.map((field) => [field.fieldName, field]));
    }
    getDbSourceLabel(field) {
        const columnName = string.snakeCase(field.fieldName);
        const domainSources = {
            sport_activity: `sport_activities.${columnName}`,
            health_rating: `health_ratings.${columnName}`,
            health_metric: `health_metric_values + health_metrics.name = ${field.fieldName}`,
            sleep: `sleeps.${columnName}`,
        };
        return domainSources[field.domain] ?? null;
    }
    formatFieldConfigReference(field) {
        const direction = field.isReversed ? 'higher is better' : 'lower is better';
        const dbSource = this.getDbSourceLabel(field);
        return [
            field.label ? `Subjective scale: ${field.label}` : `Subjective scale (${field.fieldName}):`,
            `Range: ${field.min} to ${field.max}`,
            `Interpretation: ${direction}`,
            dbSource ? `DB source: ${dbSource}` : null,
            field.intro ? `Description: ${field.intro}` : null,
        ]
            .filter((line) => line !== null)
            .join('\n');
    }
    async getScales(clubId, language, filter) {
        if (!clubId)
            return [];
        const catalogue = await this.getClubCatalogue(clubId, language);
        const filtered = catalogue.filter((field) => this.matchesFilter(field, filter));
        return filtered.map((field) => this.toFieldResponse(field));
    }
    async formatClubCatalogueReference(clubId, language) {
        const catalogue = await this.getClubCatalogue(clubId, language);
        if (catalogue.length === 0)
            return '';
        return [
            '=== Club subjective scale configuration (authoritative) ===',
            'Use these ranges and interpretations when interpreting any subjective score.',
            'Never assume a fixed 1-10 scale.',
            'USER-FACING LABELS (answers, chart titles, axis labels): always use the exact "Subjective scale: …" label from this block for that field.',
            'Never invent club-specific nicknames (e.g. do not say "RPE Body" unless that exact label appears below).',
            'User synonyms (RPE Body, body RPE, body soreness, courbatures, etc.) may map to the same DB source for querying — still answer with this club\'s label.',
            '',
            catalogue.map((field) => this.formatFieldConfigReference(field)).join('\n\n'),
            '===',
        ].join('\n');
    }
}
//# sourceMappingURL=subjective_scale_service.js.map