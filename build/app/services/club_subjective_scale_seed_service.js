import { findClubSubjectiveScaleSeed, getClubSubjectiveScaleSeedAliases, CLUB_SUBJECTIVE_SCALE_SEEDS, } from '#constants/club_subjective_scale_seed.constants';
import { SUBJECTIVE_VARIABLE_DESCRIPTION_KEY, SUBJECTIVE_VARIABLE_LEVEL_KEY, SUBJECTIVE_VARIABLE_NAME_KEY, } from '#constants/subjective_translation.constants';
import { TRANSLATABLE_TYPES } from '#constants/translation.constants';
import Club from '#models_pg/club';
import SubjectiveFieldConfig from '#models_pg/subjective_field_config';
import Translation from '#models_pg/translation';
const findClubSubjectiveScaleSeedByFieldName = (fieldName) => {
    const normalized = fieldName.trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    return (CLUB_SUBJECTIVE_SCALE_SEEDS.find((seed) => getClubSubjectiveScaleSeedAliases(seed).includes(normalized)) ?? null);
};
export default class ClubSubjectiveScaleSeedService {
    async seedClub(clubId, seeds) {
        const club = await Club.find(clubId);
        if (!club) {
            throw new Error(`Club not found: ${clubId}`);
        }
        let configsCreated = 0;
        let configsUpdated = 0;
        let translationsCreated = 0;
        let translationsUpdated = 0;
        for (const seed of seeds) {
            let config = await SubjectiveFieldConfig.query()
                .where('clubId', club.id)
                .where('domain', seed.domain)
                .where('fieldName', seed.fieldName)
                .first();
            if (config) {
                config.minScale = seed.minScale;
                config.maxScale = seed.maxScale;
                config.isReversed = seed.isReversed;
                config.gap = seed.gap ?? null;
                await config.save();
                configsUpdated++;
            }
            else {
                config = await SubjectiveFieldConfig.create({
                    clubId: club.id,
                    domain: seed.domain,
                    fieldName: seed.fieldName,
                    minScale: seed.minScale,
                    maxScale: seed.maxScale,
                    isReversed: seed.isReversed,
                    gap: seed.gap ?? null,
                });
                configsCreated++;
            }
            for (const language of ['en', 'fr']) {
                const nameResult = await this.upsertTranslation({
                    language,
                    translatableId: config.id,
                    key: SUBJECTIVE_VARIABLE_NAME_KEY,
                    value: seed.labels[language],
                });
                translationsCreated += nameResult.created;
                translationsUpdated += nameResult.updated;
                if (seed.intro?.[language]) {
                    const introResult = await this.upsertTranslation({
                        language,
                        translatableId: config.id,
                        key: SUBJECTIVE_VARIABLE_DESCRIPTION_KEY,
                        value: seed.intro[language],
                    });
                    translationsCreated += introResult.created;
                    translationsUpdated += introResult.updated;
                }
                const levels = seed.levels?.[language];
                if (!levels)
                    continue;
                for (const [levelRaw, value] of Object.entries(levels)) {
                    const level = Number(levelRaw);
                    if (!Number.isFinite(level))
                        continue;
                    const levelResult = await this.upsertTranslation({
                        language,
                        translatableId: config.id,
                        key: SUBJECTIVE_VARIABLE_LEVEL_KEY(level),
                        value,
                    });
                    translationsCreated += levelResult.created;
                    translationsUpdated += levelResult.updated;
                }
            }
        }
        return {
            configsCreated,
            configsUpdated,
            translationsCreated,
            translationsUpdated,
            seededKeys: seeds.map((seed) => seed.key),
        };
    }
    async seedConfigFromCatalogue(configId) {
        const config = await SubjectiveFieldConfig.findOrFail(configId);
        const seed = findClubSubjectiveScaleSeed({
            fieldName: config.fieldName,
            minScale: config.minScale,
            maxScale: config.maxScale,
        }) ?? findClubSubjectiveScaleSeedByFieldName(config.fieldName);
        if (!seed) {
            throw new Error(`No seed constant matches field "${config.fieldName}" (scale ${config.minScale}-${config.maxScale})`);
        }
        return this.seedClub(config.clubId, [seed]);
    }
    async upsertTranslation(input) {
        const existing = await Translation.query()
            .where('language', input.language)
            .where('translatableType', TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE)
            .where('translatableId', input.translatableId)
            .where('key', input.key)
            .first();
        if (existing) {
            existing.value = input.value;
            await existing.save();
            return { created: 0, updated: 1 };
        }
        await Translation.create({
            language: input.language,
            translatableType: TRANSLATABLE_TYPES.SUBJECTIVE_VARIABLE,
            translatableId: input.translatableId,
            key: input.key,
            value: input.value,
        });
        return { created: 1, updated: 0 };
    }
}
//# sourceMappingURL=club_subjective_scale_seed_service.js.map