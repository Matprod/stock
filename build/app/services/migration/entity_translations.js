import { ensureLegacyIdColumn } from '#services/migration/legacy_id';
import { timestamps } from '#services/migration/utils';
export async function insertEntityTranslations(pg, dryRun, rows, options) {
    const withTranslation = rows.filter((row) => row.translation);
    if (dryRun || withTranslation.length === 0)
        return;
    await ensureLegacyIdColumn(pg, 'translations', dryRun);
    const legacyIds = withTranslation.map((row) => row.legacyId);
    const entities = await pg
        .from(options.pgTable)
        .select('id', 'legacy_id')
        .whereIn('legacy_id', legacyIds);
    const idByLegacy = new Map(entities.map((row) => [Number(row.legacy_id), row.id]));
    const existing = await pg
        .from('translations')
        .select('translatable_id', 'language', 'key')
        .where('translatable_type', options.translatableType)
        .where('key', options.translationKey)
        .whereIn('translatable_id', [...idByLegacy.values()]);
    const existingKeys = new Set(existing.map((row) => `${row.translatable_id}:${row.language}:${row.key}`));
    const ts = timestamps({});
    const toInsert = [];
    for (const row of withTranslation) {
        const entityId = idByLegacy.get(row.legacyId);
        if (!entityId || !row.translation)
            continue;
        const dedupeKey = `${entityId}:${row.translation.language}:${options.translationKey}`;
        if (existingKeys.has(dedupeKey))
            continue;
        toInsert.push({
            language: row.translation.language,
            translatable_type: options.translatableType,
            translatable_id: entityId,
            key: options.translationKey,
            value: row.translation.value,
            ...ts,
        });
    }
    if (toInsert.length > 0) {
        await pg.table('translations').multiInsert(toInsert);
    }
}
//# sourceMappingURL=entity_translations.js.map