import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { ensureLegacyIdColumn } from '#services/migration/legacy_id';
import { LegacyResolver } from '#services/migration/legacy_resolver';
import { splitBilingualName } from '#services/migration/bilingual';
import { createMigrator, LARGE_BATCH, runTableMigration, XL_BATCH, } from '#services/migration/migrate_table';
import { mapChatbotAuthor, mapChatbotMessageAuthor } from '#services/migration/tables_custom';
import { mapSerieDataType, timestamps, toBool, toDate, toDecimal, toFloat, toInt, toJson, toLowerEnum, minutesToSeconds, toTimestamp, } from '#services/migration/utils';
const ALIMENT_SKIP_KEYS = new Set([
    'id',
    'subgroup_id',
    'added_by_id',
    'alim_nom_fr',
    'alim_nom_eng',
    'alim_fr',
    'alim_en',
    'name_fr',
    'name_en',
]);
function readAlimentName(row, language) {
    const candidates = language === 'fr' ? [row.alim_nom_fr, row.alim_fr, row.name_fr] : [row.alim_nom_eng, row.alim_en, row.name_en];
    for (const value of candidates) {
        const normalized = String(value ?? '').trim();
        if (normalized)
            return normalized;
    }
    return '';
}
function extractAlimentNames(row) {
    const fr = readAlimentName(row, 'fr');
    const en = readAlimentName(row, 'en');
    return {
        fr,
        en,
        canonical: en || fr,
    };
}
function mapAlimentFields(row, athleteId) {
    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
        if (!ALIMENT_SKIP_KEYS.has(key))
            mapped[key] = value;
    }
    mapped.athlete_id = athleteId;
    mapped.popularity_score = toFloat(row.popularity_score) ?? 0.5;
    return mapped;
}
const LLM_NUMERIC_KEYS = [
    'energy_kcal',
    'water_g',
    'proteins_g',
    'carbohydrate_g',
    'fat_g',
    'sugars_g',
    'fibres_g',
    'starch_g',
    'gluten_g',
    'alcohol_g',
    'fa_saturated_g',
    'fa_mono_g',
    'fa_poly_g',
    'fa_181_g',
    'fa_182_g',
    'cholesterol_mg',
    'salt_g',
    'calcium_mg',
    'chloride_mg',
    'copper_mg',
    'iron_mg',
    'iodine_microg',
    'magnesium_mg',
    'manganese_mg',
    'phosphorus_mg',
    'potassium_mg',
    'selenium_microg',
    'sodium_mg',
    'zinc_mg',
    'vitamin_d_microg',
    'vitamin_e_mg',
    'vitamin_c_mg',
    'vitamin_b1_mg',
    'vitamin_b2_mg',
    'vitamin_b3_mg',
    'vitamin_b5_mg',
    'vitamin_b6_mg',
    'vitamin_b9_microg',
    'vitamin_b12_microg',
    'fructose_g',
    'glucose_g',
    'lactose_g',
    'maltose_g',
    'sucrose_g',
    'portion',
];
function mapLlmAlimentRow(row) {
    const mapped = {
        name: row.name,
        portion_unit: row.portion_unit || 'g',
    };
    for (const key of LLM_NUMERIC_KEYS) {
        mapped[key] = toFloat(row[key]);
    }
    return mapped;
}
export const migrateAuthAccessTokens = createMigrator({
    name: 'auth_access_tokens',
    mysqlTable: 'auth_access_tokens',
    pgTable: 'auth_access_tokens',
    mapRow: async (row, resolve) => {
        const userId = await resolve.require('users', row.tokenable_id);
        if (!userId)
            return null;
        return {
            tokenable_id: userId,
            type: row.type,
            name: row.name,
            hash: row.hash,
            abilities: row.abilities,
            last_used_at: toTimestamp(row.last_used_at),
            expires_at: toTimestamp(row.expires_at),
            ...timestamps(row),
        };
    },
});
export const migrateUserPermissions = createMigrator({
    name: 'user_permissions',
    mysqlTable: 'user_permissions',
    pgTable: 'user_permissions',
    mapRow: async (row, resolve) => {
        const userId = await resolve.require('users', row.user_id);
        const permissionId = await resolve.require('permissions', row.permission_id);
        if (!userId || !permissionId)
            return null;
        return { user_id: userId, permission_id: permissionId, ...timestamps(row) };
    },
});
export const migrateActivityDisplayVariables = createMigrator({
    name: 'activity_display_variables',
    mysqlTable: 'activity_display_variables',
    pgTable: 'activity_display_variables',
    mapRow: async (row, resolve) => {
        const activityId = await resolve.require('activities', row.activity_id);
        const displayVariableId = await resolve.require('display_variables', row.display_variable_id);
        if (!activityId || !displayVariableId)
            return null;
        return {
            activity_id: activityId,
            display_variable_id: displayVariableId,
            unit: row.unit,
            club_id: null,
            ...timestamps(row),
        };
    },
});
export const migrateEventTypeClubs = createMigrator({
    name: 'event_type_clubs',
    mysqlTable: 'event_type_clubs',
    pgTable: 'event_type_clubs',
    mapRow: async (row, resolve) => {
        const eventTypeId = await resolve.require('event_types', row.event_type_id);
        const clubId = await resolve.require('clubs', row.club_id);
        if (!eventTypeId || !clubId)
            return null;
        return { event_type_id: eventTypeId, club_id: clubId, ...timestamps(row) };
    },
});
export const migrateBlacklistActivities = createMigrator({
    name: 'blacklist_activities',
    mysqlTable: 'black_list_activities',
    pgTable: 'blacklist_activities',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        const activityId = await resolve.require('activities', row.activity_id);
        if (!clubId || !activityId)
            return null;
        return { club_id: clubId, activity_id: activityId, ...timestamps(row) };
    },
});
export const migrateInsights = createMigrator({
    name: 'insights',
    mysqlTable: 'insights',
    pgTable: 'insights',
    mapRow: (row) => ({
        variable_name: row.variable_name,
        name: row.name,
        description: row.description,
        can_too_high: toBool(row.can_too_high),
        can_too_low: toBool(row.can_too_low),
        treshold_low: toFloat(row.treshold_low),
        treshold_too_low: toFloat(row.treshold_too_low),
        treshold_high: toFloat(row.treshold_high),
        treshold_too_high: toFloat(row.treshold_too_high),
        treshold_type: row.treshold_type ? toLowerEnum(row.treshold_type) : null,
        maximum: toFloat(row.maximum),
        ...timestamps(row),
    }),
});
export const migrateClubInsights = createMigrator({
    name: 'club_insights',
    mysqlTable: 'club_insights',
    pgTable: 'club_insights',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        const insightId = await resolve.require('insights', row.insight_id);
        if (!clubId || !insightId)
            return null;
        return { club_id: clubId, insight_id: insightId, ...timestamps(row) };
    },
});
export const migratePrompts = createMigrator({
    name: 'prompts',
    mysqlTable: 'prompts',
    pgTable: 'prompts',
    mapRow: async (row, resolve) => {
        const clubId = row.club_id ? await resolve.resolve('clubs', row.club_id) : null;
        return {
            title: row.title,
            content: row.content,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migratePriorityCategoryWeights = createMigrator({
    name: 'priority_category_weights',
    mysqlTable: 'priority_category_weights',
    pgTable: 'priority_category_weights',
    mapRow: async (row, resolve) => {
        const clubId = row.club_id ? await resolve.resolve('clubs', row.club_id) : null;
        return {
            type: toLowerEnum(row.type, 'performance'),
            category_type: toLowerEnum(row.category_type, 'activity'),
            weight: toFloat(row.weight) ?? 0,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateNotificationMessages = createMigrator({
    name: 'notification_messages',
    mysqlTable: 'notifications_messages',
    pgTable: 'notification_messages',
    mapRow: (row) => ({
        title: row.title,
        content: row.content,
        ...timestamps(row),
    }),
});
export const migrateAliments = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'aliments', dryRun);
    await ensureLegacyIdColumn(pg, 'translations', dryRun);
    const resolver = new LegacyResolver(pg);
    const [{ total }] = await mysql.from('nutrition_aliment').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg.from('aliments').select('legacy_id').whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)));
    }
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    let offset = 0;
    while (offset < totalCount) {
        const rows = await mysql.from('nutrition_aliment').select('*').limit(LARGE_BATCH).offset(offset);
        const toInsert = [];
        const namesByLegacyId = new Map();
        for (const row of rows) {
            const legacyId = Number(row.id);
            if (existingLegacyIds.has(legacyId)) {
                skipped++;
                continue;
            }
            const { canonical, fr, en } = extractAlimentNames(row);
            if (!canonical) {
                rejected++;
                continue;
            }
            const athleteId = row.added_by_id
                ? await resolver.resolve('athletes', row.added_by_id)
                : null;
            toInsert.push({
                ...mapAlimentFields(row, athleteId),
                name: canonical,
                legacy_id: legacyId,
                ...timestamps(row),
            });
            namesByLegacyId.set(legacyId, { fr, en });
        }
        if (!dryRun && toInsert.length > 0) {
            await pg.table('aliments').multiInsert(toInsert);
            resolver.invalidate('aliments');
            const insertedRows = await pg
                .from('aliments')
                .select('id', 'legacy_id')
                .whereIn('legacy_id', toInsert.map((row) => Number(row.legacy_id)));
            const translationRows = insertedRows.flatMap((row) => {
                const names = namesByLegacyId.get(Number(row.legacy_id));
                if (!names)
                    return [];
                const items = [];
                if (names.fr) {
                    items.push({
                        language: 'fr',
                        translatable_type: TRANSLATABLE_TYPES.ALIMENT,
                        translatable_id: row.id,
                        key: TRANSLATION_KEYS.ALIMENT_NAME,
                        value: names.fr,
                        ...timestamps({}),
                    });
                }
                if (names.en) {
                    items.push({
                        language: 'en',
                        translatable_type: TRANSLATABLE_TYPES.ALIMENT,
                        translatable_id: row.id,
                        key: TRANSLATION_KEYS.ALIMENT_NAME,
                        value: names.en,
                        ...timestamps({}),
                    });
                }
                return items;
            });
            if (translationRows.length > 0) {
                await pg.table('translations').multiInsert(translationRows);
            }
        }
        inserted += toInsert.length;
        offset += LARGE_BATCH;
    }
    return { table: 'aliments', total: totalCount, inserted, skipped, rejected };
};
export const migrateLlmAliments = createMigrator({
    name: 'llm_aliments',
    mysqlTable: 'nutrition_chatgptnutrition',
    pgTable: 'llm_aliments',
    batchSize: LARGE_BATCH,
    mapRow: (row) => ({
        ...mapLlmAlimentRow(row),
        ...timestamps(row, {
            createdKeys: ['date_added', 'created_at'],
            updatedKeys: ['date_updated', 'date_added', 'created_at'],
        }),
    }),
});
export const migrateOtpCodes = createMigrator({
    name: 'otp_codes',
    mysqlTable: 'base_register_otp_code',
    pgTable: 'otp_codes',
    mapRow: (row) => ({
        code: row.code,
        index: row.idx ?? row.index ?? 0,
        expires_at: toTimestamp(row.expiry_date),
        ...timestamps(row),
    }),
});
export const migrateWorkoutSessions = createMigrator({
    name: 'workout_sessions',
    mysqlTable: 'workout_sessions',
    pgTable: 'workout_sessions',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            name: row.name,
            club_id: clubId,
            duration_seconds: minutesToSeconds(row.duration),
            ...timestamps(row),
        };
    },
});
const DUPLICATE_NAME_SUFFIX = ' TO_TRANSLATE';
const reinforcementNamesByClub = new Set();
async function preloadReinforcementClubNames(pg) {
    reinforcementNamesByClub.clear();
    const rows = await pg.from('reinforcement_exercises').select('club_id', 'name');
    for (const row of rows) {
        reinforcementNamesByClub.add(`${row.club_id}:${row.name}`);
    }
}
function allocateReinforcementName(clubId, baseName, legacyId) {
    const firstKey = `${clubId ?? ''}:${baseName}`;
    if (!reinforcementNamesByClub.has(firstKey)) {
        reinforcementNamesByClub.add(firstKey);
        return baseName;
    }
    let name = `${baseName}${DUPLICATE_NAME_SUFFIX}`;
    const duplicateKey = `${clubId}:${name}`;
    if (!reinforcementNamesByClub.has(duplicateKey)) {
        reinforcementNamesByClub.add(duplicateKey);
        return name;
    }
    name = `${baseName}${DUPLICATE_NAME_SUFFIX} (${legacyId})`;
    reinforcementNamesByClub.add(`${clubId}:${name}`);
    return name;
}
export const migrateReinforcementExercises = async (mysql, pg, dryRun) => {
    await preloadReinforcementClubNames(pg);
    return runTableMigration({
        name: 'reinforcement_exercises',
        mysqlTable: 'sportactivity_reinforcementexercices',
        pgTable: 'reinforcement_exercises',
        orderBy: { column: 'id' },
        mapRow: async (row, resolve) => {
            const clubId = await resolve.require('clubs', row.club_id);
            const activityId = await resolve.require('activities', row.activity_id);
            const bilingual = splitBilingualName(row);
            if (!activityId || !bilingual)
                return null;
            const name = allocateReinforcementName(clubId, bilingual.name, Number(row.id));
            return {
                name,
                type: toLowerEnum(row.type, 'bodyweight_reps'),
                difficulty: row.difficulty ? toLowerEnum(row.difficulty) : null,
                video_link: row.video_link,
                estimated_reps: toInt(row.estimated_reps),
                estimated_duration: toInt(row.estimated_duration),
                bodyweight_percentage: toInt(row.bodyweight_percentage),
                club_id: clubId,
                activity_id: activityId,
                ...timestamps(row),
            };
        },
    }, mysql, pg, dryRun);
};
export const migrateEvents = createMigrator({
    name: 'events',
    mysqlTable: 'events',
    pgTable: 'events',
    mapRow: async (row, resolve) => {
        const eventTypeId = await resolve.require('event_types', row.event_type_id);
        const clubId = await resolve.require('clubs', row.club_id);
        const startTime = toTimestamp(row.start_time);
        const endTime = toTimestamp(row.end_time);
        if (!eventTypeId || !clubId || !startTime || !endTime)
            return null;
        return {
            start_time: startTime,
            end_time: endTime,
            title: row.title,
            location: row.location,
            event_type_id: eventTypeId,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateRecipes = createMigrator({
    name: 'recipes',
    mysqlTable: 'nutrition_recipe',
    pgTable: 'recipes',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!athleteId)
            return null;
        return {
            name: row.name,
            athlete_id: athleteId,
            ...timestamps(row, {
                createdKeys: ['date_added', 'created_at'],
                updatedKeys: ['date_updated', 'date_added', 'created_at'],
            }),
        };
    },
});
export const migrateRecipeAliments = createMigrator({
    name: 'recipe_aliments',
    mysqlTable: 'nutrition_recipemeal',
    pgTable: 'recipe_aliments',
    mapRow: async (row, resolve) => {
        const recipeId = await resolve.require('recipes', row.recipe_id);
        const alimentId = await resolve.require('aliments', row.meal_id);
        if (!recipeId || !alimentId)
            return null;
        return {
            quantity: toDecimal(row.quantity),
            portion: toDecimal(row.portion) ?? 1,
            recipe_id: recipeId,
            aliment_id: alimentId,
            ...timestamps(row),
        };
    },
});
export const migrateNotifications = createMigrator({
    name: 'notifications',
    mysqlTable: 'notifications',
    pgTable: 'notifications',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            title: row.title,
            date: toDate(row.date),
            day: toLowerEnum(row.day),
            time: extractTimeOrNull(row.time),
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
function extractTimeOrNull(value) {
    if (value === null || value === undefined)
        return null;
    const str = String(value);
    if (/^\d{2}:\d{2}:\d{2}/.test(str))
        return str.slice(0, 8);
    return str.length <= 8 ? str : null;
}
export const migrateNotificationMessageLinks = createMigrator({
    name: 'notification_message_links',
    mysqlTable: 'notification_message_links',
    pgTable: 'notification_message_links',
    mapRow: async (row, resolve) => {
        const notificationId = await resolve.require('notifications', row.notification_id);
        const messageId = await resolve.require('notification_messages', row.notification_message_id);
        if (!notificationId || !messageId) {
            console.log(`row ${row.id} has no notification or message`);
            console.log(`notification_id: ${row.notification_id}`);
            console.log(`notification_message_id: ${row.notification_message_id}`);
            return null;
        }
        return {
            notification_id: notificationId,
            notification_message_id: messageId,
            ...timestamps(row),
        };
    },
});
export const migrateNotificationAthletes = createMigrator({
    name: 'notification_athletes',
    mysqlTable: 'notification_athletes',
    pgTable: 'notification_athletes',
    mapRow: async (row, resolve) => {
        const notificationId = await resolve.require('notifications', row.notification_id);
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!notificationId || !athleteId)
            return null;
        return {
            notification_id: notificationId,
            athlete_id: athleteId,
            ...timestamps(row),
        };
    },
});
export const migrateFavoriteAliments = createMigrator({
    name: 'favorite_aliments',
    mysqlTable: 'nutrition_athletefavoritefood',
    pgTable: 'favorite_aliments',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!athleteId)
            return null;
        const hasFood = row.food_id != null;
        const hasLlm = row.chatgpt_food_id != null;
        if (hasFood === hasLlm)
            return null;
        const alimentId = hasFood ? await resolve.require('aliments', row.food_id) : null;
        const llmAlimentId = hasLlm
            ? await resolve.require('llm_aliments', row.chatgpt_food_id)
            : null;
        if ((hasFood && !alimentId) || (hasLlm && !llmAlimentId))
            return null;
        const mealTypes = Array.isArray(row.meal_types)
            ? row.meal_types
            : String(row.meal_types || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        return {
            meal_types: mealTypes,
            athlete_id: athleteId,
            aliment_id: alimentId,
            llm_aliment_id: llmAlimentId,
            ...timestamps(row, { createdKeys: ['date_added_as_favorite', 'created_at'] }),
        };
    },
});
export const migrateBasketballGames = createMigrator({
    name: 'basketball_games',
    mysqlTable: 'basketball_games',
    pgTable: 'basketball_games',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        const eventId = row.event_id ? await resolve.resolve('events', row.event_id) : null;
        return {
            club_id: clubId,
            event_id: eventId,
            api_game_id: row.api_game_id,
            start_time: toTimestamp(row.start_time),
            end_time: toTimestamp(row.end_time),
            timestamp: row.timestamp,
            title: row.title,
            location: row.location,
            status_short: row.status_short,
            league_id: row.league_id,
            league_name: row.league_name,
            league_season: row.league_season,
            league_logo: row.league_logo,
            home_team_id: row.home_team_id,
            home_team_name: row.home_team_name,
            away_team_id: row.away_team_id,
            away_team_name: row.away_team_name,
            home_score_q1: row.home_score_q1,
            home_score_q2: row.home_score_q2,
            home_score_q3: row.home_score_q3,
            home_score_q4: row.home_score_q4,
            home_score_ot: row.home_score_ot,
            home_score_total: row.home_score_total,
            away_score_q1: row.away_score_q1,
            away_score_q2: row.away_score_q2,
            away_score_q3: row.away_score_q3,
            away_score_q4: row.away_score_q4,
            away_score_ot: row.away_score_ot,
            away_score_total: row.away_score_total,
            ...timestamps(row),
        };
    },
});
export const migrateClubProviders = createMigrator({
    name: 'club_providers',
    mysqlTable: 'club_providers',
    pgTable: 'club_providers',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            club_id: clubId,
            provider: row.provider,
            provider_team_id: row.provider_team_id,
            access_token: row.access_token,
            access_token_secret: row.access_token_secret,
            refresh_token: row.refresh_token,
            token_expires_at: toTimestamp(row.token_expires_at),
            last_synced_at: toTimestamp(row.last_synced_at),
            ...timestamps(row),
        };
    },
});
export const migrateWorkoutSessionExercises = createMigrator({
    name: 'workout_session_exercises',
    mysqlTable: 'exercice_workout_session',
    pgTable: 'workout_session_exercises',
    mapRow: async (row, resolve) => {
        const workoutSessionId = await resolve.require('workout_sessions', row.workout_session_id);
        const reinforcementExerciseId = await resolve.require('reinforcement_exercises', row.exercice_id);
        if (!workoutSessionId || !reinforcementExerciseId)
            return null;
        return {
            workout_session_id: workoutSessionId,
            reinforcement_exercise_id: reinforcementExerciseId,
            ...timestamps(row),
        };
    },
});
export const migrateFavoriteReinforcementExercises = createMigrator({
    name: 'favorite_reinforcement_exercises',
    mysqlTable: 'reinforcement_exercise_favorites',
    pgTable: 'favorite_reinforcement_exercises',
    mapRow: async (row, resolve) => {
        const userId = await resolve.require('users', row.user_id);
        const exerciseId = await resolve.require('reinforcement_exercises', row.exercise_id);
        if (!userId || !exerciseId)
            return null;
        return {
            user_id: userId,
            exercise_id: exerciseId,
            ...timestamps(row),
        };
    },
});
export const migrateChatbotQuestions = createMigrator({
    name: 'chatbot_questions',
    mysqlTable: 'chatbot_questions',
    pgTable: 'chatbot_questions',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            title: row.title,
            question: row.question,
            author: mapChatbotAuthor(row.type ?? row.author),
            category: toLowerEnum(row.category, 'performance'),
            order: toInt(row.order) ?? 0,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migratePriorityFeatureWeights = createMigrator({
    name: 'priority_feature_weights',
    mysqlTable: 'priority_feature_weights',
    pgTable: 'priority_feature_weights',
    mapRow: async (row, resolve) => {
        const clubId = row.club_id ? await resolve.resolve('clubs', row.club_id) : null;
        const insightId = await resolve.require('insights', row.insight_id);
        if (!insightId)
            return null;
        return {
            club_id: clubId,
            insight_id: insightId,
            type: toLowerEnum(row.type, 'performance'),
            ...timestamps(row),
        };
    },
});
export const migrateHealthRatings = createMigrator({
    name: 'health_ratings',
    mysqlTable: 'health_health',
    pgTable: 'health_ratings',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        if (!dayId)
            return null;
        return {
            energy_rating: toInt(row.energy_rating),
            mood_rating: toInt(row.mood_rating),
            stress_rating: toInt(row.stress_rating),
            body_soreness_rating: toInt(row.body_soreness_rating),
            day_id: dayId,
            ...timestamps(row, {
                createdKeys: ['date_added', 'created_at'],
                updatedKeys: ['date_updated', 'date_added', 'created_at'],
            }),
        };
    },
});
export const migrateInjuries = createMigrator({
    name: 'injuries',
    mysqlTable: 'base_injuryhistory',
    pgTable: 'injuries',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        const injuryTypeId = await resolve.require('injury_types', row.type_of_injury_id);
        const dateOfInjury = toDate(row.date_of_injury);
        if (!athleteId || !injuryTypeId || !dateOfInjury)
            return null;
        const pathology = typeof row.pathology === 'string' ? row.pathology.replace(/\s+/gu, ' ').trim() : row.pathology;
        return {
            date_of_injury: dateOfInjury,
            recovery_date: toDate(row.recovery_date),
            context: row.context ? toLowerEnum(row.context) : null,
            note: row.note,
            mechanism: row.mechanism,
            tissue: row.tissue,
            angle: row.angle,
            pathology,
            source: row.source || 'manual',
            athlete_id: athleteId,
            type_of_injury_id: injuryTypeId,
            ...timestamps(row),
        };
    },
});
export const migrateHydratations = createMigrator({
    name: 'hydratations',
    mysqlTable: 'nutrition_hydration',
    pgTable: 'hydratations',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        if (!dayId)
            return null;
        return {
            bottle_count: toInt(row.nbr_of_bottles),
            glass_count: toInt(row.nbr_of_glasses),
            day_id: dayId,
            ...timestamps(row, { createdKeys: ['date_added', 'created_at'] }),
        };
    },
});
export const migrateBodymetricsHistories = createMigrator({
    name: 'bodymetrics_histories',
    mysqlTable: 'bodymetrics_histories',
    pgTable: 'bodymetrics_histories',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        const dayId = await resolve.require('days', row.day_id);
        if (!athleteId || !dayId)
            return null;
        return {
            weight: toFloat(row.weight),
            fat_percentage: toFloat(row.fat_percentage),
            athlete_id: athleteId,
            day_id: dayId,
            ...timestamps(row),
        };
    },
});
export const migrateValdTests = createMigrator({
    name: 'vald_tests',
    mysqlTable: 'vald_tests',
    pgTable: 'vald_tests',
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        if (!dayId)
            return null;
        return {
            day_id: dayId,
            test_type: row.test_type,
            value: toFloat(row.value),
            ...timestamps(row),
        };
    },
});
export const migrateChatbotDiscussions = createMigrator({
    name: 'chatbot_discussions',
    mysqlTable: 'chatbot_discussions',
    pgTable: 'chatbot_discussions',
    mapRow: async (row, resolve) => {
        const userId = await resolve.require('users', row.user_id);
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!userId || !athleteId)
            return null;
        return {
            title: row.title,
            discussion_day: toDate(row.discussion_day),
            category: row.category ? toLowerEnum(row.category) : null,
            user_id: userId,
            athlete_id: athleteId,
            ...timestamps(row),
        };
    },
});
export const migrateChatbotReports = createMigrator({
    name: 'chatbot_reports',
    mysqlTable: 'chatbot_reports',
    pgTable: 'chatbot_reports',
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.day_id);
        if (!dayId)
            return null;
        return {
            day_id: dayId,
            category: row.category ? toLowerEnum(row.category) : null,
            message: row.report_message,
            summary: row.summary,
            score_at_generation: toFloat(row.score_at_generation),
            ...timestamps(row),
        };
    },
});
export const migrateTokens = createMigrator({
    name: 'tokens',
    mysqlTable: 'base_token',
    pgTable: 'tokens',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!athleteId)
            return null;
        return {
            access_token: row.access_token,
            access_expiration_date: toTimestamp(row.access_expiration_date),
            refresh_token: row.refresh_token,
            refresh_expiration_date: toTimestamp(row.refresh_expiration_date),
            athlete_id: athleteId,
            ...timestamps(row),
        };
    },
});
export const migrateFiles = createMigrator({
    name: 'files',
    mysqlTable: 'files',
    pgTable: 'files',
    mapRow: async (row, resolve) => {
        const athleteId = row.athlete_id
            ? await resolve.resolve('athletes', row.athlete_id)
            : null;
        return {
            type: toLowerEnum(row.type),
            key: row.key,
            file_name: row.file_name,
            athlete_id: athleteId,
            ...timestamps(row),
        };
    },
});
export const migratePlayerNotes = createMigrator({
    name: 'player_notes',
    mysqlTable: 'player_notes',
    pgTable: 'player_notes',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!athleteId)
            return null;
        const eventId = row.event_id ? await resolve.resolve('events', row.event_id) : null;
        return {
            athlete_id: athleteId,
            event_id: eventId,
            category: row.category ? toLowerEnum(row.category) : null,
            note_date: toDate(row.note_date),
            content: row.content,
            ...timestamps(row),
        };
    },
});
export const migrateFeatureImportances = createMigrator({
    name: 'feature_importances',
    mysqlTable: 'feature_importances',
    pgTable: 'feature_importances',
    batchSize: XL_BATCH,
    mapRow: async (row, resolve) => {
        const insightId = await resolve.require('insights', row.insight_id);
        const dayId = await resolve.require('days', row.day_id);
        if (!insightId || !dayId)
            return null;
        return {
            value: toFloat(row.value),
            optimal: toFloat(row.optimal),
            shap_value: toFloat(row.shap_value),
            contrib_pct: toFloat(row.contrib_pct),
            type: toLowerEnum(row.type),
            category: toLowerEnum(row.category),
            insight_id: insightId,
            day_id: dayId,
            ...timestamps(row),
        };
    },
});
export const migrateSleepMetricValues = createMigrator({
    name: 'sleep_metric_values',
    mysqlTable: 'sleep_metric_values',
    pgTable: 'sleep_metric_values',
    batchSize: XL_BATCH,
    mapRow: async (row, resolve) => {
        const sleepId = await resolve.require('sleeps', row.sleep_id);
        const metricId = await resolve.require('sleep_metrics', row.metric_id);
        if (!sleepId || !metricId)
            return null;
        return {
            sleep_id: sleepId,
            metric_id: metricId,
            value: String(row.value ?? ''),
            ...timestamps(row),
        };
    },
});
export const migrateDayMetricValues = createMigrator({
    name: 'day_metric_values',
    mysqlTable: 'day_metric_values',
    pgTable: 'day_metric_values',
    batchSize: XL_BATCH,
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        const metricId = await resolve.require('day_metrics', row.metric_id);
        if (!dayId || !metricId)
            return null;
        return {
            day_id: dayId,
            metric_id: metricId,
            value: String(row.value ?? ''),
            ...timestamps(row),
        };
    },
});
export const migrateWorkoutSessionInstances = createMigrator({
    name: 'workout_session_instances',
    mysqlTable: 'workout_session_instances',
    pgTable: 'workout_session_instances',
    mapRow: async (row, resolve) => {
        const workoutSessionId = await resolve.require('workout_sessions', row.workout_session_id);
        if (!workoutSessionId)
            return null;
        return {
            start_time: toTimestamp(row.start_time),
            title: row.title,
            workout_session_id: workoutSessionId,
            duration_seconds: minutesToSeconds(row.duration),
            ...timestamps(row),
        };
    },
});
export const migratePeriods = createMigrator({
    name: 'periods',
    mysqlTable: 'periods',
    pgTable: 'periods',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const sportActivityId = await resolve.require('sport_activities', row.sport_activity_id);
        const startTime = toTimestamp(row.start_time);
        const endTime = toTimestamp(row.end_time);
        if (!sportActivityId || !startTime || !endTime)
            return null;
        if (startTime >= endTime)
            return null;
        return {
            name: row.name,
            provider_id: row.provider_id,
            start_time: startTime,
            end_time: endTime,
            sport_activity_id: sportActivityId,
            ...timestamps(row),
        };
    },
});
export const migrateSportActivityPains = createMigrator({
    name: 'sport_activity_pains',
    mysqlTable: 'sportactivity_painsportactivity',
    pgTable: 'sport_activity_pains',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const locationId = await resolve.require('pain_discomfort_locations', row.location_id);
        const sportActivityId = await resolve.require('sport_activities', row.sport_activity_id);
        if (!locationId || !sportActivityId)
            return null;
        return {
            rating: toInt(row.rating),
            location_id: locationId,
            sport_activity_id: sportActivityId,
            ...timestamps(row),
        };
    },
});
export const migrateSportActivityIntakes = createMigrator({
    name: 'sport_activity_intakes',
    mysqlTable: 'sportactivity_foodintake',
    pgTable: 'sport_activity_intakes',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        if (!row.food_id)
            return null;
        const alimentId = await resolve.require('aliments', row.food_id);
        const sportActivityId = await resolve.require('sport_activities', row.sport_activity_id);
        if (!alimentId || !sportActivityId)
            return null;
        return {
            quantity: toDecimal(row.quantity) ?? 0,
            portion: toDecimal(row.portion),
            aliment_id: alimentId,
            sport_activity_id: sportActivityId,
            ...timestamps(row),
        };
    },
});
export const migratePeriodMetricValues = createMigrator({
    name: 'period_metric_values',
    mysqlTable: 'period_metric_values',
    pgTable: 'period_metric_values',
    batchSize: XL_BATCH,
    mapRow: async (row, resolve) => {
        const periodId = await resolve.require('periods', row.period_id);
        const metricId = await resolve.require('period_metrics', row.metric_id);
        if (!periodId || !metricId)
            return null;
        return {
            period_id: periodId,
            metric_id: metricId,
            value: String(row.value ?? ''),
            ...timestamps(row),
        };
    },
});
export const migrateSeries = createMigrator({
    name: 'series',
    mysqlTable: 'series',
    pgTable: 'series',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const periodId = await resolve.require('periods', row.period_id);
        if (!periodId)
            return null;
        return {
            type: row.type,
            data_encoded: row.data_encoded,
            data_type: mapSerieDataType(row.data_type),
            period_id: periodId,
            ...timestamps(row),
        };
    },
});
export const migrateHealthPains = createMigrator({
    name: 'health_pains',
    mysqlTable: 'health_painhealth',
    pgTable: 'health_pains',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const healthId = await resolve.require('health_ratings', row.health_id);
        const locationId = await resolve.require('pain_discomfort_locations', row.location_id);
        if (!healthId || !locationId)
            return null;
        return {
            rating: toInt(row.rating),
            health_id: healthId,
            location_id: locationId,
            ...timestamps(row),
        };
    },
});
export const migrateHealthMetricValues = createMigrator({
    name: 'health_metric_values',
    mysqlTable: 'health_metric_values',
    pgTable: 'health_metric_values',
    batchSize: XL_BATCH,
    mapRow: async (row, resolve) => {
        const healthId = await resolve.require('health_ratings', row.health_id);
        const metricId = await resolve.require('health_metrics', row.metric_id);
        if (!healthId || !metricId)
            return null;
        return {
            health_id: healthId,
            metric_id: metricId,
            value: String(row.value ?? ''),
            ...timestamps(row),
        };
    },
});
export const migrateTravels = createMigrator({
    name: 'travels',
    mysqlTable: 'health_travel',
    pgTable: 'travels',
    mapRow: async (row, resolve) => {
        const healthId = await resolve.require('health_ratings', row.health_id);
        if (!healthId)
            return null;
        const eventId = row.event_id ? await resolve.resolve('events', row.event_id) : null;
        const durationMinutes = row.duration ? Math.round(Number(row.duration) / 60_000_000) : 0;
        return {
            mean_of_transport: row.mean_of_transport || 'unknown',
            duration_minutes: durationMinutes,
            health_id: healthId,
            event_id: eventId,
            ...timestamps(row, {
                createdKeys: ['date_added', 'created_at'],
                updatedKeys: ['date_updated', 'date_added', 'created_at'],
            }),
        };
    },
});
export const migrateAthleteEvents = createMigrator({
    name: 'athlete_events',
    mysqlTable: 'athlete_events',
    pgTable: 'athlete_events',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        const eventId = await resolve.require('events', row.event_id);
        if (!athleteId || !eventId)
            return null;
        return {
            athlete_id: athleteId,
            event_id: eventId,
            ...timestamps(row),
        };
    },
});
export const migrateBasketballGameStats = createMigrator({
    name: 'basketball_game_stats',
    mysqlTable: 'basketball_games_stats',
    pgTable: 'basketball_game_stats',
    mapRow: async (row, resolve) => {
        const basketballGameId = await resolve.require('basketball_games', row.basketball_game_id);
        if (!basketballGameId)
            return null;
        return {
            basketball_game_id: basketballGameId,
            home_field_goals_total: row.home_field_goals_total,
            home_field_goals_attempts: row.home_field_goals_attempts,
            home_threepoint_goals_total: row.home_threepoint_goals_total,
            home_threepoint_goals_attempts: row.home_threepoint_goals_attempts,
            home_freethrows_goals_total: row.home_freethrows_goals_total,
            home_freethrows_goals_attempts: row.home_freethrows_goals_attempts,
            home_rebounds_total: row.home_rebounds_total,
            home_rebounds_offence: row.home_rebounds_offence,
            home_rebounds_defense: row.home_rebounds_defense,
            home_assists: row.home_assists,
            home_steals: row.home_steals,
            home_blocks: row.home_blocks,
            home_turnovers: row.home_turnovers,
            home_personal_fouls: row.home_personal_fouls,
            away_field_goals_total: row.away_field_goals_total,
            away_field_goals_attempts: row.away_field_goals_attempts,
            away_threepoint_goals_total: row.away_threepoint_goals_total,
            away_threepoint_goals_attempts: row.away_threepoint_goals_attempts,
            away_freethrows_goals_total: row.away_freethrows_goals_total,
            away_freethrows_goals_attempts: row.away_freethrows_goals_attempts,
            away_rebounds_total: row.away_rebounds_total,
            away_rebounds_offence: row.away_rebounds_offence,
            away_rebounds_defense: row.away_rebounds_defense,
            away_assists: row.away_assists,
            away_steals: row.away_steals,
            away_blocks: row.away_blocks,
            away_turnovers: row.away_turnovers,
            away_personal_fouls: row.away_personal_fouls,
            ...timestamps(row),
        };
    },
});
export const migrateBasketballGamePlayerStats = createMigrator({
    name: 'basketball_game_player_stats',
    mysqlTable: 'basketball_games_stats_players',
    pgTable: 'basketball_game_player_stats',
    mapRow: async (row, resolve) => {
        const basketballGameId = await resolve.require('basketball_games', row.basketball_game_id);
        if (!basketballGameId)
            return null;
        return {
            basketball_game_id: basketballGameId,
            api_player_id: row.api_player_id,
            api_team_id: row.api_team_id,
            player_name: row.player_name,
            type: row.type,
            minutes: row.minutes,
            field_goals_total: row.field_goals_total,
            field_goals_attempts: row.field_goals_attempts,
            threepoint_goals_total: row.threepoint_goals_total,
            threepoint_goals_attempts: row.threepoint_goals_attempts,
            freethrows_goals_total: row.freethrows_goals_total,
            freethrows_goals_attempts: row.freethrows_goals_attempts,
            rebounds_total: row.rebounds_total,
            assists: row.assists,
            points: row.points,
            plus_minus: row.plus_minus,
            ...timestamps(row),
        };
    },
});
export const migrateValdTrials = createMigrator({
    name: 'vald_trials',
    mysqlTable: 'vald_trials',
    pgTable: 'vald_trials',
    mapRow: async (row, resolve) => {
        const valdTestId = await resolve.require('vald_tests', row.vald_test_id);
        if (!valdTestId)
            return null;
        return {
            trial_jump_height: toFloat(row.trial_jump_height),
            trial_rsi_modified: toFloat(row.trial_rsi_modified),
            trial_peak_takeoff_power: toFloat(row.trial_peak_takeoff_power),
            trial_concentric_rfd: toFloat(row.trial_concentric_rfd),
            trial_peak_landing_force: toFloat(row.trial_peak_landing_force),
            trial_time_to_stabilisation: toFloat(row.trial_time_to_stabilisation),
            trial_rsi: toFloat(row.trial_rsi),
            trial_eccentric_braking_rfd: toFloat(row.trial_eccentric_braking_rfd),
            vald_test_id: valdTestId,
            ...timestamps(row),
        };
    },
});
export const migrateChatbotMessages = createMigrator({
    name: 'chatbot_messages',
    mysqlTable: 'chatbot_messages',
    pgTable: 'chatbot_messages',
    mapRow: async (row, resolve) => {
        const discussionId = await resolve.require('chatbot_discussions', row.chatbot_discussion_id);
        if (!discussionId)
            return null;
        return {
            content: row.content,
            author: mapChatbotMessageAuthor(row.type),
            chatbot_discussion_id: discussionId,
            ...timestamps(row),
        };
    },
});
function mapDemoCategory(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'performance' || normalized === 'injury')
        return normalized;
    return null;
}
export const migrateDemoPairs = createMigrator({
    name: 'demo_pairs',
    mysqlTable: 'demo_pairs',
    pgTable: 'demo_pairs',
    mapRow: (row) => {
        const question = String(row.question ?? '').trim();
        if (!question)
            return null;
        return {
            question,
            answer: String(row.answer ?? ''),
            category: mapDemoCategory(row.category),
            reference_date: toDate(row.reference_date),
            is_active: row.is_active === null || row.is_active === undefined ? true : toBool(row.is_active),
            embedding: toJson(row.embedding),
            variants: toJson(row.variants),
            variant_embeddings: toJson(row.variant_embeddings),
            chart_data: toJson(row.chart_data),
            ...timestamps(row),
        };
    },
});
//# sourceMappingURL=tables_remaining.js.map