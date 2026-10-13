import { ensureLegacyIdColumn } from '#services/migration/legacy_id';
import { LegacyResolver } from '#services/migration/legacy_resolver';
import { timestamps, timeValueToSeconds, toDate, toDecimal, toFloat, toInt, toLowerEnum, } from '#services/migration/utils';
const BATCH = 500;
function mapChatbotAuthor(value) {
    const v = toLowerEnum(value, 'athlete');
    if (v === 'team')
        return 'team';
    if (v === 'user')
        return 'user';
    return 'athlete';
}
function mapChatbotMessageAuthor(value) {
    const v = toLowerEnum(value, 'staff');
    if (v === 'bot')
        return 'bot';
    if (v === 'user')
        return 'staff';
    return 'athlete';
}
const ENTITY_TYPE_TO_TABLE = {
    activity: 'sport_activities',
    health: 'health_ratings',
    sleep: 'sleeps',
    nutrition: 'nutritions',
};
export const migrateDiseases = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'diseases', dryRun);
    const resolver = new LegacyResolver(pg);
    const diseaseTypes = await pg
        .from('disease_types')
        .join('clubs', 'disease_types.club_id', 'clubs.id')
        .select('disease_types.id', 'disease_types.name', 'clubs.legacy_id as club_legacy_id')
        .whereNotNull('clubs.legacy_id');
    const diseaseTypeByClubAndName = new Map();
    for (const dt of diseaseTypes) {
        diseaseTypeByClubAndName.set(`${dt.club_legacy_id}:${String(dt.name).toLowerCase()}`, dt.id);
    }
    const athletes = await pg
        .from('athletes')
        .select('id', 'legacy_id', 'club_id')
        .whereNotNull('legacy_id');
    const athleteClubByLegacy = new Map();
    const athleteClubLegacy = await pg
        .from('clubs')
        .select('id', 'legacy_id')
        .whereNotNull('legacy_id');
    const clubLegacyByUuid = new Map(athleteClubLegacy.map((c) => [c.id, Number(c.legacy_id)]));
    for (const a of athletes) {
        const clubLegacy = clubLegacyByUuid.get(a.club_id);
        if (clubLegacy)
            athleteClubByLegacy.set(Number(a.legacy_id), String(clubLegacy));
    }
    const [{ total }] = await mysql.from('diseases').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('diseases').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('diseases').select('*').limit(BATCH).offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const athleteId = await resolver.require('athletes', row.athlete_id);
            if (!athleteId) {
                rejected++;
                continue;
            }
            const clubLegacy = athleteClubByLegacy.get(Number(row.athlete_id));
            const diseaseTypeId = clubLegacy
                ? diseaseTypeByClubAndName.get(`${clubLegacy}:${String(row.name).toLowerCase()}`)
                : null;
            if (!diseaseTypeId) {
                rejected++;
                continue;
            }
            toInsert.push({
                start_date: toDate(row.date_of_disease),
                end_date: toDate(row.recovery_date),
                note: row.note,
                source: row.source.toLowerCase(),
                name: row.name ?? 'Viral illness',
                athlete_id: athleteId,
                disease_type_id: diseaseTypeId,
                legacy_id: legacyId,
                ...timestamps(row),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('diseases').multiInsert(toInsert);
            resolver.invalidate('diseases');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'diseases', total: totalCount, inserted, skipped, rejected };
};
export const migrateNutritions = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'nutritions', dryRun);
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql.from('nutrition_nutrition').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('nutritions').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('nutrition_nutrition').select('*').limit(BATCH).offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const dayId = await resolver.require('days', row.athlete_day_id);
            if (!dayId) {
                rejected++;
                continue;
            }
            const hasMeal = row.meal_id != null;
            const hasRecipe = row.recipe_id != null;
            const hasLlm = row.chatgpt_meal_id != null;
            const sourceCount = [hasMeal, hasRecipe, hasLlm].filter(Boolean).length;
            if (sourceCount !== 1) {
                rejected++;
                continue;
            }
            const alimentId = hasMeal ? await resolver.require('aliments', row.meal_id) : null;
            const recipeId = hasRecipe ? await resolver.require('recipes', row.recipe_id) : null;
            const llmAlimentId = hasLlm
                ? await resolver.require('llm_aliments', row.chatgpt_meal_id)
                : null;
            if ((hasMeal && !alimentId) || (hasRecipe && !recipeId) || (hasLlm && !llmAlimentId)) {
                rejected++;
                continue;
            }
            toInsert.push({
                meal_type: row.meal_type || 'unknown',
                quantity: toDecimal(row.quantity) ?? 0,
                portion: toDecimal(row.portion),
                day_id: dayId,
                aliment_id: alimentId,
                recipe_id: recipeId,
                llm_aliment_id: llmAlimentId,
                legacy_id: legacyId,
                ...timestamps(row, {
                    createdKeys: ['date_added', 'created_at'],
                    updatedKeys: ['date_updated', 'date_added', 'created_at'],
                }),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('nutritions').multiInsert(toInsert);
            resolver.invalidate('nutritions');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'nutritions', total: totalCount, inserted, skipped, rejected };
};
export const migrateExerciseLoads = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'exercise_loads', dryRun);
    const resolver = new LegacyResolver(pg);
    const sportActivityMatches = await mysql
        .from('sportactivity_sportactivity as sa')
        .join('base_athleteday as d', 'sa.athlete_day_id', 'd.id')
        .select('sa.id as sport_activity_id', 'd.athlete_id', 'sa.activity_type_id')
        .orderBy('d.date_of_day', 'desc');
    const matchKey = (athleteId, activityId) => `${athleteId}:${activityId}`;
    const saByAthleteActivity = new Map();
    for (const row of sportActivityMatches) {
        const key = matchKey(Number(row.athlete_id), Number(row.activity_type_id));
        if (!saByAthleteActivity.has(key)) {
            saByAthleteActivity.set(key, Number(row.sport_activity_id));
        }
    }
    const [{ total }] = await mysql.from('exercise_loads').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('exercise_loads').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('exercise_loads').select('*').limit(BATCH).offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const athleteId = await resolver.require('athletes', row.athlete_id);
            if (!athleteId) {
                rejected++;
                continue;
            }
            const saLegacyId = saByAthleteActivity.get(matchKey(Number(row.athlete_id), Number(row.activity_id)));
            const sportActivityId = saLegacyId
                ? await resolver.require('sport_activities', saLegacyId)
                : null;
            if (!sportActivityId) {
                rejected++;
                continue;
            }
            toInsert.push({
                athlete_id: athleteId,
                sport_activity_id: sportActivityId,
                gear_load_kg: toFloat(row.gear_load_kg),
                weapon_load_kg: toFloat(row.weapon_load_kg),
                legacy_id: legacyId,
                ...timestamps(row),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('exercise_loads').multiInsert(toInsert);
            resolver.invalidate('exercise_loads');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'exercise_loads', total: totalCount, inserted, skipped, rejected };
};
export const migrateSportActivitiesBackfill = async (mysql, pg, dryRun) => {
    const resolver = new LegacyResolver(pg);
    const rows = await mysql
        .from('sportactivity_sportactivity')
        .select('id', 'workout_session_instance_id')
        .whereNotNull('workout_session_instance_id');
    let updated = 0;
    let rejected = 0;
    for (const row of rows) {
        const legacyId = Number(row.id);
        const pgRow = await pg
            .from('sport_activities')
            .select('id', 'workout_session_instance_id')
            .where('legacy_id', legacyId)
            .first();
        if (!pgRow) {
            rejected++;
            continue;
        }
        const workoutSessionInstanceId = await resolver.resolve('workout_session_instances', row.workout_session_instance_id);
        if (!workoutSessionInstanceId) {
            rejected++;
            continue;
        }
        if (pgRow.workout_session_instance_id === workoutSessionInstanceId) {
            continue;
        }
        if (!dryRun) {
            await pg
                .from('sport_activities')
                .where('id', pgRow.id)
                .update({ workout_session_instance_id: workoutSessionInstanceId });
        }
        updated++;
    }
    return {
        table: 'sport_activities (workout backfill)',
        total: rows.length,
        inserted: updated,
        skipped: 0,
        rejected,
    };
};
export const migrateSubjectiveFieldConfigs = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'subjective_field_configs', dryRun);
    const resolver = new LegacyResolver(pg);
    const clubSettingsRows = await mysql.from('club_settings').select('id', 'club_id');
    const clubSettingsToClub = new Map(clubSettingsRows.map((r) => [Number(r.id), Number(r.club_id)]));
    const [{ total }] = await mysql.from('subjective_field_configs').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg
            .from('subjective_field_configs')
            .select('legacy_id')
            .whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql
            .from('subjective_field_configs')
            .select('*')
            .limit(BATCH)
            .offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const mysqlClubId = clubSettingsToClub.get(Number(row.club_settings_id));
            const clubsId = mysqlClubId ? await resolver.require('clubs', mysqlClubId) : null;
            if (!clubsId) {
                rejected++;
                continue;
            }
            toInsert.push({
                club_id: clubsId,
                field_id: row.field_id,
                min_scale: row.min_scale ?? 1,
                max_scale: row.max_scale ?? 10,
                is_reversed: row.is_reversed ?? false,
                legacy_id: legacyId,
                ...timestamps(row),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('subjective_field_configs').multiInsert(toInsert);
            resolver.invalidate('subjective_field_configs');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'subjective_field_configs', total: totalCount, inserted, skipped, rejected };
};
export const migrateAiSummaries = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'ai_summaries', dryRun);
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql.from('ai_summaries').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('ai_summaries').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('ai_summaries').select('*').limit(BATCH).offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const dayId = await resolver.require('days', row.athlete_day_id);
            const entityType = toLowerEnum(row.entity_type);
            const pgTable = ENTITY_TYPE_TO_TABLE[entityType];
            if (!dayId || !pgTable) {
                rejected++;
                continue;
            }
            const entityId = row.entity_id
                ? await resolver.require(pgTable, row.entity_id)
                : null;
            toInsert.push({
                entity_id: entityId,
                entity_type: entityType,
                day_id: dayId,
                summary: row.summary_message || row.summary || '',
                legacy_id: legacyId,
                ...timestamps(row),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('ai_summaries').multiInsert(toInsert);
            resolver.invalidate('ai_summaries');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'ai_summaries', total: totalCount, inserted, skipped, rejected };
};
export const migrateAppVersions = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'app_versions', dryRun);
    const rows = await mysql.from('base_appversion').select('*');
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('app_versions').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    for (const row of rows) {
        const legacyId = Number(row.id);
        if (existingLegacyIds.has(legacyId)) {
            skipped++;
            continue;
        }
        const record = {
            version: row.version,
            platform: 'ios',
            status: 'published',
            update_message: null,
            legacy_id: legacyId,
            ...timestamps(row),
        };
        if (!dryRun) {
            await pg.table('app_versions').insert(record);
        }
        inserted++;
    }
    return { table: 'app_versions', total: rows.length, inserted, skipped, rejected };
};
export { mapChatbotAuthor, mapChatbotMessageAuthor };
export const migrateExerciseSets = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'exercise_sets', dryRun);
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql.from('sportactivity_exerciseset').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('exercise_sets').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((r) => Number(r.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql
            .from('sportactivity_exerciseset')
            .select('*')
            .limit(BATCH)
            .offset(offset);
        const toInsert = [];
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const workoutSessionInstanceId = row.workout_session_instance_id
                ? await resolver.require('workout_session_instances', row.workout_session_instance_id)
                : null;
            const sportActivityId = row.sport_activity_id
                ? await resolver.require('sport_activities', row.sport_activity_id)
                : null;
            const exerciseId = await resolver.require('reinforcement_exercises', row.exercise_id);
            if (!exerciseId) {
                rejected++;
                continue;
            }
            const isTemplateSet = !row.sport_activity_id && row.workout_session_instance_id;
            const isPlayerSet = !!row.sport_activity_id;
            if (!isTemplateSet && !isPlayerSet) {
                rejected++;
                continue;
            }
            if (isTemplateSet && !workoutSessionInstanceId) {
                rejected++;
                continue;
            }
            if (isPlayerSet && !sportActivityId) {
                rejected++;
                continue;
            }
            toInsert.push({
                reps: toInt(row.reps),
                weight: toDecimal(row.weight),
                duration_seconds: row.time ? timeValueToSeconds(row.time) : null,
                order: toInt(row.order),
                set_order: toInt(row.set_order),
                sport_activity_id: sportActivityId,
                exercise_id: exerciseId,
                workout_session_instance_id: isTemplateSet ? workoutSessionInstanceId : null,
                legacy_id: legacyId,
                ...timestamps(row, {
                    createdKeys: ['date_added', 'created_at'],
                    updatedKeys: ['date_updated', 'date_added', 'created_at'],
                }),
            });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('exercise_sets').multiInsert(toInsert);
            resolver.invalidate('exercise_sets');
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return { table: 'exercise_sets', total: totalCount, inserted, skipped, rejected };
};
const FIRSTBEAT_METRIC_COLUMNS = [
    'rmssd',
    'hf_average',
    'lf_average',
    'lf_hf_ratio',
    'movement_load',
    'strain',
    'epoc_final',
    'epoc_peak',
    'trimp',
    'energy_consumption_carbs',
    'energy_consumption_fats',
    'zone1_time',
    'zone2_time',
    'zone3_time',
    'zone4_time',
    'zone5_time',
];
const FIRSTBEAT_METRIC_DEFS = {
    rmssd: { dataType: 'float', aggregationMethod: 'average', unit: 'ms' },
    hf_average: { dataType: 'float', aggregationMethod: 'average', unit: null },
    lf_average: { dataType: 'float', aggregationMethod: 'average', unit: null },
    lf_hf_ratio: { dataType: 'float', aggregationMethod: 'average', unit: null },
    movement_load: { dataType: 'float', aggregationMethod: 'sum', unit: null },
    strain: { dataType: 'float', aggregationMethod: 'average', unit: null },
    epoc_final: { dataType: 'float', aggregationMethod: 'max', unit: 'ml/kg' },
    epoc_peak: { dataType: 'float', aggregationMethod: 'max', unit: 'ml/kg' },
    trimp: { dataType: 'float', aggregationMethod: 'sum', unit: null },
    energy_consumption_carbs: { dataType: 'float', aggregationMethod: 'sum', unit: 'kcal' },
    energy_consumption_fats: { dataType: 'float', aggregationMethod: 'sum', unit: 'kcal' },
    zone1_time: { dataType: 'float', aggregationMethod: 'sum', unit: 'min' },
    zone2_time: { dataType: 'float', aggregationMethod: 'sum', unit: 'min' },
    zone3_time: { dataType: 'float', aggregationMethod: 'sum', unit: 'min' },
    zone4_time: { dataType: 'float', aggregationMethod: 'sum', unit: 'min' },
    zone5_time: { dataType: 'float', aggregationMethod: 'sum', unit: 'min' },
};
async function ensureFirstbeatPeriodMetrics(pg, dryRun) {
    const existing = await pg
        .from('period_metrics')
        .select('id', 'name', 'unit')
        .whereIn('name', [...FIRSTBEAT_METRIC_COLUMNS]);
    const byName = new Map(existing.map((row) => [String(row.name), String(row.id)]));
    if (dryRun)
        return byName;
    const now = new Date();
    for (const name of FIRSTBEAT_METRIC_COLUMNS) {
        const def = FIRSTBEAT_METRIC_DEFS[name];
        const existingId = byName.get(name);
        if (existingId) {
            const row = existing.find((r) => String(r.name) === name);
            if (row && row.unit !== def.unit) {
                await pg.from('period_metrics').where('id', existingId).update({
                    unit: def.unit,
                    updated_at: now,
                });
            }
            continue;
        }
        await pg.table('period_metrics').insert({
            name,
            description: `Firstbeat ${name}`,
            unit: def.unit,
            data_type: def.dataType,
            aggregation_method: def.aggregationMethod,
            created_at: now,
            updated_at: now,
        });
        const created = await pg.from('period_metrics').select('id').where('name', name).first();
        if (created) {
            byName.set(name, String(created.id));
        }
    }
    return byName;
}
export const migrateFirstbeatPeriodMetrics = async (mysql, pg, dryRun) => {
    const metricIds = await ensureFirstbeatPeriodMetrics(pg, dryRun);
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql
        .from('sportactivity_sportactivity')
        .where((query) => {
        for (const column of FIRSTBEAT_METRIC_COLUMNS) {
            query.orWhereNotNull(column);
        }
    })
        .count('* as total');
    const totalCount = Number(total);
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql
            .from('sportactivity_sportactivity')
            .select('id', ...FIRSTBEAT_METRIC_COLUMNS)
            .where((query) => {
            for (const column of FIRSTBEAT_METRIC_COLUMNS) {
                query.orWhereNotNull(column);
            }
        })
            .orderBy('id', 'asc')
            .limit(BATCH)
            .offset(offset);
        const sportActivityIds = [];
        const legacyToPgSa = new Map();
        for (const row of rows) {
            const sportActivityId = await resolver.require('sport_activities', Number(row.id));
            if (!sportActivityId) {
                rejected++;
                continue;
            }
            legacyToPgSa.set(Number(row.id), sportActivityId);
            sportActivityIds.push(sportActivityId);
        }
        if (sportActivityIds.length === 0) {
            offset += BATCH;
            continue;
        }
        const periods = await pg
            .from('periods')
            .select('id', 'sport_activity_id')
            .whereIn('sport_activity_id', sportActivityIds)
            .orderBy('start_time', 'asc');
        const periodBySportActivity = new Map();
        for (const period of periods) {
            const saId = String(period.sport_activity_id);
            if (!periodBySportActivity.has(saId)) {
                periodBySportActivity.set(saId, String(period.id));
            }
        }
        const periodIds = [...periodBySportActivity.values()];
        const existingValues = periodIds.length > 0
            ? await pg
                .from('period_metric_values')
                .select('period_id', 'metric_id')
                .whereIn('period_id', periodIds)
                .whereIn('metric_id', [...metricIds.values()])
            : [];
        const existingKeys = new Set(existingValues.map((row) => `${row.period_id}|${row.metric_id}`));
        const toInsert = [];
        const now = new Date();
        for (const row of rows) {
            const sportActivityId = legacyToPgSa.get(Number(row.id));
            if (!sportActivityId)
                continue;
            const periodId = periodBySportActivity.get(sportActivityId);
            if (!periodId) {
                rejected++;
                continue;
            }
            for (const column of FIRSTBEAT_METRIC_COLUMNS) {
                const value = toFloat(row[column]);
                if (value === null)
                    continue;
                const metricId = metricIds.get(column);
                if (!metricId) {
                    rejected++;
                    continue;
                }
                const key = `${periodId}|${metricId}`;
                if (existingKeys.has(key)) {
                    skipped++;
                    continue;
                }
                existingKeys.add(key);
                toInsert.push({
                    period_id: periodId,
                    metric_id: metricId,
                    value: String(Math.round(value * 100) / 100),
                    created_at: now,
                    updated_at: now,
                });
            }
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('period_metric_values').multiInsert(toInsert);
        }
        inserted += toInsert.length;
        offset += BATCH;
    }
    return {
        table: 'firstbeat_period_metrics',
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
};
export const migrateInjuryTypesClubIdBackfill = async (mysql, pg, dryRun) => {
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql
        .from('base_typeofinjury')
        .whereNotNull('club_id')
        .count('* as total');
    const totalCount = Number(total);
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql
            .from('base_typeofinjury')
            .select('id', 'club_id')
            .whereNotNull('club_id')
            .orderBy('id', 'asc')
            .limit(BATCH)
            .offset(offset);
        for (const row of rows) {
            const legacyId = Number(row.id);
            const pgRow = await pg
                .from('injury_types')
                .select('id', 'club_id')
                .where('legacy_id', legacyId)
                .first();
            if (!pgRow) {
                rejected++;
                continue;
            }
            const clubId = await resolver.require('clubs', row.club_id);
            if (!clubId) {
                rejected++;
                continue;
            }
            if (pgRow.club_id === clubId) {
                skipped++;
                continue;
            }
            if (!dryRun) {
                await pg.from('injury_types').where('id', pgRow.id).update({
                    club_id: clubId,
                    updated_at: new Date(),
                });
            }
            inserted++;
        }
        offset += BATCH;
    }
    return {
        table: 'injury_types (club_id backfill)',
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
};
export const migrateCatapultAthleteProviders = async (mysql, pg, dryRun) => {
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql
        .from('base_athlete')
        .whereNotNull('catapult_id')
        .where('catapult_id', '!=', '')
        .count('* as total');
    const totalCount = Number(total);
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql
            .from('base_athlete')
            .select('id', 'catapult_id')
            .whereNotNull('catapult_id')
            .where('catapult_id', '!=', '')
            .orderBy('id', 'asc')
            .limit(BATCH)
            .offset(offset);
        for (const row of rows) {
            const catapultId = String(row.catapult_id).trim();
            if (!catapultId) {
                skipped++;
                continue;
            }
            const athleteId = await resolver.require('athletes', row.id);
            if (!athleteId) {
                rejected++;
                continue;
            }
            const existing = await pg
                .from('athlete_providers')
                .where('athlete_id', athleteId)
                .where('provider', 'catapult')
                .first();
            if (existing) {
                if (String(existing.provider_athlete_id ?? '') === catapultId) {
                    skipped++;
                    continue;
                }
                if (!dryRun) {
                    await pg.from('athlete_providers').where('id', existing.id).update({
                        provider_athlete_id: catapultId,
                        updated_at: new Date(),
                    });
                }
                inserted++;
                continue;
            }
            if (!dryRun) {
                await pg.table('athlete_providers').insert({
                    athlete_id: athleteId,
                    provider: 'catapult',
                    provider_athlete_id: catapultId,
                    created_at: new Date(),
                    updated_at: new Date(),
                });
            }
            inserted++;
        }
        offset += BATCH;
    }
    return {
        table: 'athlete_providers (catapult from base_athlete.catapult_id)',
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
};
//# sourceMappingURL=tables_custom.js.map