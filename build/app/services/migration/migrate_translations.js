import { LegacyResolver } from '#services/migration/legacy_resolver';
import { timestamps, toLowerEnum } from '#services/migration/utils';
const PG_TABLE_BY_TYPE = {
    insight: 'insights',
    player_position: 'player_positions',
    notification_message: 'notification_messages',
    chatbot_question: 'chatbot_questions',
    event_type: 'event_types',
    subjective_variable: 'subjective_field_configs',
    activity: 'activities',
    sport: 'sports',
    aliment: 'aliments',
    injury_section: 'injury_sections',
    injury_type: 'injury_types',
    pain_discomfort_location: 'pain_discomfort_locations',
};
export const migrateMysqlTranslations = async (mysql, pg, dryRun) => {
    const batchSize = 500;
    const [{ total }] = await mysql.from('translations').count('* as total');
    const totalCount = Number(total);
    const resolver = new LegacyResolver(pg);
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('translations').select('*').limit(batchSize).offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const pgTable = PG_TABLE_BY_TYPE[toLowerEnum(row.translatable_type)];
            if (!pgTable) {
                rejected++;
                continue;
            }
            const translatableId = await resolver.resolve(pgTable, row.translatable_id);
            if (!translatableId) {
                rejected++;
                continue;
            }
            const language = toLowerEnum(row.language);
            if (language !== 'fr' && language !== 'en') {
                rejected++;
                continue;
            }
            toInsert.push({
                language,
                translatable_type: toLowerEnum(row.translatable_type),
                translatable_id: translatableId,
                key: row.key,
                value: row.value,
                ...timestamps(row),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('translations').multiInsert(toInsert);
        }
        inserted += toInsert.length;
        offset += batchSize;
    }
    return { table: 'translations', total: totalCount, inserted, skipped, rejected };
};
//# sourceMappingURL=migrate_translations.js.map