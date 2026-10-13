import { USER_ROLE } from '#constants/user.constants';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import { ensureLegacyIdColumn } from '#services/migration/legacy_id';
import { createBilingualMigrator, createMigrator, LARGE_BATCH, } from '#services/migration/migrate_table';
import { durationMicrosToSeconds, extractTime, mapGender, mapAggregationMethod, mapMetricDataType, toBool, toDate, timestamps, toDecimal, toFloat, toInt, toTimestamp, } from '#services/migration/utils';
export const migrateSports = createBilingualMigrator({
    name: 'sports',
    mysqlTable: 'base_sport',
    pgTable: 'sports',
    translatableType: TRANSLATABLE_TYPES.SPORT,
    translationKey: TRANSLATION_KEYS.SPORT_NAME,
    mapRow: () => ({
        ...timestamps({}),
    }),
});
export const migratePlayerPositions = createMigrator({
    name: 'player_positions',
    mysqlTable: 'player_positions',
    pgTable: 'player_positions',
    mapRow: async (row, resolve) => {
        const sportId = await resolve.require('sports', row.sport_id);
        if (!sportId)
            return null;
        return {
            name: row.name,
            sport_id: sportId,
            ...timestamps(row),
        };
    },
});
export const migratePermissions = createMigrator({
    name: 'permissions',
    mysqlTable: 'permissions',
    pgTable: 'permissions',
    mapRow: (row) => ({
        name: row.name,
        description: row.description,
        ...timestamps(row),
    }),
});
export const migrateDisplayVariables = async (mysql, pg, dryRun) => {
    const hasLegacyId = await ensureLegacyIdColumn(pg, 'display_variables', dryRun);
    await ensureLegacyIdColumn(pg, 'translations', dryRun);
    const [{ total }] = await mysql.from('display_variables').count('* as total');
    const totalCount = Number(total);
    let existingLegacyIds = new Set();
    if (hasLegacyId) {
        const existing = await pg
            .from('display_variables')
            .select('legacy_id')
            .whereNotNull('legacy_id');
        existingLegacyIds = new Set(existing.map((row) => Number(row.legacy_id)));
    }
    const rows = await mysql.from('display_variables').select('*').orderBy('id', 'asc');
    let inserted = 0;
    let skipped = 0;
    let rejected = 0;
    const toInsert = [];
    const labelsByLegacyId = new Map();
    for (const row of rows) {
        const legacyId = Number(row.id);
        const name = String(row.name ?? '').trim();
        const labelFr = String(row.label_fr ?? '').trim();
        const labelEn = String(row.label_en ?? '').trim();
        if (!name) {
            rejected++;
            continue;
        }
        labelsByLegacyId.set(legacyId, { fr: labelFr, en: labelEn });
        if (existingLegacyIds.has(legacyId)) {
            skipped++;
            continue;
        }
        toInsert.push({
            name,
            unit: null,
            legacy_id: legacyId,
            ...timestamps(row),
        });
    }
    if (!dryRun && toInsert.length > 0) {
        await pg.table('display_variables').multiInsert(toInsert);
        inserted = toInsert.length;
    }
    if (!dryRun) {
        await insertDisplayVariableTranslations(pg, labelsByLegacyId);
    }
    return {
        table: 'display_variables',
        total: totalCount,
        inserted,
        skipped,
        rejected,
    };
};
async function insertDisplayVariableTranslations(pg, labelsByLegacyId) {
    if (labelsByLegacyId.size === 0)
        return;
    const legacyIds = [...labelsByLegacyId.keys()];
    const entities = await pg
        .from('display_variables')
        .select('id', 'legacy_id')
        .whereIn('legacy_id', legacyIds);
    if (entities.length === 0)
        return;
    const idByLegacy = new Map(entities.map((row) => [Number(row.legacy_id), row.id]));
    const entityIds = [...idByLegacy.values()];
    const existing = await pg
        .from('translations')
        .select('translatable_id', 'language', 'key')
        .where('translatable_type', TRANSLATABLE_TYPES.DISPLAY_VARIABLE)
        .where('key', TRANSLATION_KEYS.DISPLAY_VARIABLE_NAME)
        .whereIn('translatable_id', entityIds);
    const existingKeys = new Set(existing.map((row) => `${row.translatable_id}:${row.language}:${row.key}`));
    const ts = timestamps({});
    const translationRows = [];
    for (const [legacyId, labels] of labelsByLegacyId) {
        const entityId = idByLegacy.get(legacyId);
        if (!entityId)
            continue;
        for (const [language, value] of [
            ['fr', labels.fr],
            ['en', labels.en],
        ]) {
            if (!value)
                continue;
            const dedupeKey = `${entityId}:${language}:${TRANSLATION_KEYS.DISPLAY_VARIABLE_NAME}`;
            if (existingKeys.has(dedupeKey))
                continue;
            translationRows.push({
                language,
                translatable_type: TRANSLATABLE_TYPES.DISPLAY_VARIABLE,
                translatable_id: entityId,
                key: TRANSLATION_KEYS.DISPLAY_VARIABLE_NAME,
                value,
                ...ts,
            });
        }
    }
    if (translationRows.length > 0) {
        await pg.table('translations').multiInsert(translationRows);
    }
}
export const migrateClubs = createMigrator({
    name: 'clubs',
    mysqlTable: 'clubs',
    pgTable: 'clubs',
    mapRow: async (row, resolve) => {
        const sportId = await resolve.require('sports', row.sport_id);
        if (!sportId)
            return null;
        return {
            name: row.name,
            sport_id: sportId,
            start_date: toDate(row.start_date),
            end_date: toDate(row.end_date),
            language: row.club_language || 'en',
            ...timestamps(row),
        };
    },
});
export const migrateUsers = createMigrator({
    name: 'users',
    mysqlTable: 'users',
    pgTable: 'users',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        const mapMySQLRoleToPGRole = (role) => {
            switch (role) {
                case 'SUPER_ADMIN':
                    return USER_ROLE.SUPER_ADMIN;
                case 'CLUB_ADMIN':
                    return USER_ROLE.CLUB_ADMIN;
                case 'CLUB_STAFF':
                    return USER_ROLE.CLUB_STAFF;
                default:
                    return USER_ROLE.CLUB_STAFF;
            }
        };
        return {
            email: row.email,
            password: row.password,
            role: mapMySQLRoleToPGRole(row.role) || USER_ROLE.CLUB_STAFF,
            default_page: row.default_page,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateSeasons = createMigrator({
    name: 'seasons',
    mysqlTable: 'seasons',
    pgTable: 'seasons',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            name: row.name,
            start_date: toDate(row.start_date),
            end_date: toDate(row.end_date),
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateActivities = createBilingualMigrator({
    name: 'activities',
    mysqlTable: 'base_activity',
    pgTable: 'activities',
    translatableType: TRANSLATABLE_TYPES.ACTIVITY,
    translationKey: TRANSLATION_KEYS.ACTIVITY_NAME,
    mapRow: () => ({
        ...timestamps({}),
    }),
});
export const migrateEventTypes = createMigrator({
    name: 'event_types',
    mysqlTable: 'event_types',
    pgTable: 'event_types',
    mapRow: async (row, resolve) => {
        const activitiesId = row.activity_id
            ? await resolve.resolve('activities', row.activity_id)
            : null;
        return {
            name: row.name,
            color: row.color,
            icon: row.icon,
            event_category: row.event_category,
            travel_type: row.travel_type,
            activity_id: activitiesId,
            ...timestamps(row),
        };
    },
});
export const migrateZones = createMigrator({
    name: 'zones',
    mysqlTable: 'base_zone',
    pgTable: 'zones',
    mapRow: (row) => {
        const side = row.side === 'back' ? 'back' : 'front';
        return {
            side,
            name: row.name,
            ...timestamps({}),
        };
    },
});
export const migrateInjurySections = createBilingualMigrator({
    name: 'injury_sections',
    mysqlTable: 'base_typeofinjurycategory',
    pgTable: 'injury_sections',
    translatableType: TRANSLATABLE_TYPES.INJURY_SECTION,
    translationKey: TRANSLATION_KEYS.INJURY_SECTION_NAME,
    mapRow: async (row, _bilingual, resolve) => {
        const zoneId = await resolve.require('zones', row.zone_id);
        if (!zoneId)
            return null;
        return {
            zone_id: zoneId,
            ...timestamps({}),
        };
    },
});
export const migrateInjuryTypes = createBilingualMigrator({
    name: 'injury_types',
    mysqlTable: 'base_typeofinjury',
    pgTable: 'injury_types',
    translatableType: TRANSLATABLE_TYPES.INJURY_TYPE,
    translationKey: TRANSLATION_KEYS.INJURY_TYPE_NAME,
    mapRow: async (row, _bilingual, resolve) => {
        const categoryId = await resolve.require('injury_sections', row.category_id);
        if (!categoryId)
            return null;
        const clubId = row.club_id ? await resolve.require('clubs', row.club_id) : null;
        return {
            category_id: categoryId,
            club_id: clubId,
            ...timestamps({}),
        };
    },
});
export const migratePainDiscomfortLocations = createBilingualMigrator({
    name: 'pain_discomfort_locations',
    mysqlTable: 'base_paindiscomfortlocation',
    pgTable: 'pain_discomfort_locations',
    translatableType: TRANSLATABLE_TYPES.PAIN_DISCOMFORT_LOCATION,
    translationKey: TRANSLATION_KEYS.PAIN_DISCOMFORT_LOCATION_NAME,
    mapRow: async (row, _bilingual, resolve) => {
        const zoneId = await resolve.require('zones', row.zone_id);
        if (!zoneId)
            return null;
        return {
            zone_id: zoneId,
            ...timestamps({}),
        };
    },
});
export const migrateHealthMetrics = createMigrator({
    name: 'health_metrics',
    mysqlTable: 'health_metrics',
    pgTable: 'health_metrics',
    mapRow: (row) => ({
        name: row.name,
        description: row.description,
        unit: row.unit,
        data_type: mapMetricDataType(row.data_type),
        ...timestamps(row),
    }),
});
export const migrateSleepMetrics = createMigrator({
    name: 'sleep_metrics',
    mysqlTable: 'sleep_metrics',
    pgTable: 'sleep_metrics',
    mapRow: (row) => ({
        name: row.name,
        description: row.description,
        unit: row.unit,
        data_type: mapMetricDataType(row.data_type),
        ...timestamps(row),
    }),
});
export const migratePeriodMetrics = createMigrator({
    name: 'period_metrics',
    mysqlTable: 'period_metrics',
    pgTable: 'period_metrics',
    mapRow: (row) => ({
        name: row.name,
        description: row.description,
        unit: row.unit,
        data_type: mapMetricDataType(row.data_type),
        aggregation_method: mapAggregationMethod(row.aggregation_method),
        ...timestamps(row),
    }),
});
export const migrateDayMetrics = createMigrator({
    name: 'day_metrics',
    mysqlTable: 'day_metrics',
    pgTable: 'day_metrics',
    mapRow: (row) => ({
        name: row.name,
        description: row.description,
        unit: row.unit,
        data_type: mapMetricDataType(row.data_type),
        ...timestamps(row),
    }),
});
export const migrateDiseaseTypes = createMigrator({
    name: 'disease_types',
    mysqlTable: 'disease_types',
    pgTable: 'disease_types',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            name: row.name,
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateClubSettings = createMigrator({
    name: 'club_settings',
    mysqlTable: 'club_settings',
    pgTable: 'club_settings',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        if (!clubId)
            return null;
        return {
            performance_high: toFloat(row.performance_high),
            performance_medium: toFloat(row.performance_medium),
            injury_high: toFloat(row.injury_high),
            injury_medium: toFloat(row.injury_medium),
            availability_high: toFloat(row.availability_high),
            availability_medium: toFloat(row.availability_medium),
            club_id: clubId,
            ...timestamps(row),
        };
    },
});
export const migrateAthletes = createMigrator({
    name: 'athletes',
    mysqlTable: 'base_athlete',
    pgTable: 'athletes',
    mapRow: async (row, resolve) => {
        const clubId = await resolve.require('clubs', row.club_id);
        const playerPositionId = await resolve.require('player_positions', row.player_position_id);
        if (!clubId || !playerPositionId)
            return null;
        const birthDate = toDate(row.birth_date) || '1970-01-01';
        const startDate = toDate(row.start_date) || toDate(row.date_joined) || new Date().toISOString().slice(0, 10);
        return {
            password: row.password,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            birth_date: birthDate,
            fc_max: row.fc_max,
            fc_min: row.fc_min,
            height_cm: row.height ?? 170,
            weight_kg: row.weight ?? 70,
            fat_percentage: row.fat_percentage,
            gender: mapGender(row.gender),
            fcm_device_token: row.fcm_device_token,
            app_language: row.app_language || 'en',
            start_date: startDate,
            end_date: toDate(row.end_date),
            jersey_number: row.jersey_number,
            club_id: clubId,
            player_position_id: playerPositionId,
            ...timestamps(row, {
                createdKeys: ['created_at', 'date_joined'],
                updatedKeys: ['updated_at', 'created_at', 'date_joined'],
            }),
        };
    },
});
export const migrateAthleteProviders = createMigrator({
    name: 'athlete_providers',
    mysqlTable: 'athlete_providers',
    pgTable: 'athlete_providers',
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        if (!athleteId)
            return null;
        return {
            provider: row.provider,
            provider_athlete_id: row.provider_athlete_id ? String(row.provider_athlete_id) : null,
            athlete_id: athleteId,
            access_token: row.access_token,
            access_token_secret: row.access_token_secret,
            refresh_token: row.refresh_token,
            ...timestamps(row),
        };
    },
});
export const migrateDays = createMigrator({
    name: 'days',
    mysqlTable: 'base_athleteday',
    pgTable: 'days',
    batchSize: LARGE_BATCH,
    conflictColumns: ['athlete_id', 'date_of_day'],
    mapRow: async (row, resolve) => {
        const athleteId = await resolve.require('athletes', row.athlete_id);
        const dateOfDay = toDate(row.date_of_day);
        if (!athleteId || !dateOfDay)
            return null;
        return {
            date_of_day: dateOfDay,
            performance_score: row.performance_prediction ?? row.performance_score,
            injury_risk_score: row.injury_score,
            athlete_id: athleteId,
            ...timestamps({}),
        };
    },
});
const usedActivityTimes = new Set();
export const migrateSportActivities = createMigrator({
    name: 'sport_activities',
    mysqlTable: 'sportactivity_sportactivity',
    pgTable: 'sport_activities',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        if (!dayId)
            return null;
        const activityTypeId = row.activity_type_id
            ? await resolve.resolve('activities', row.activity_type_id)
            : null;
        const eventId = row.event_id ? await resolve.resolve('events', row.event_id) : null;
        let timeOfActivity = extractTime(row.time_of_activity);
        if (timeOfActivity && usedActivityTimes.has(timeOfActivity)) {
            timeOfActivity = null;
        }
        if (timeOfActivity)
            usedActivityTimes.add(timeOfActivity);
        return {
            data_source: row.data_source || 'manual',
            distance: toFloat(row.distance),
            speed: toFloat(row.speed),
            duration_seconds: durationMicrosToSeconds(row.duration),
            elevation: toFloat(row.elevation),
            power: toFloat(row.power),
            averaged_bpm: toInt(row.averaged_bpm),
            rpe: toInt(row.rpe),
            fitness_level: toInt(row.fitness_level),
            cardio_respiratory: toInt(row.cardio_respiratory),
            muscular_difficulty: toInt(row.muscular_difficulty),
            time_of_activity: timeOfActivity,
            fatigue_level: toInt(row.fatigue_level),
            pleasure_level: toInt(row.pleasure_level),
            active_calories: toInt(row.active_calories),
            cadence: toInt(row.cadence),
            elevation_descent: toInt(row.elevation_descent),
            training_load: toDecimal(row.training_load),
            game_activity: toBool(row.game_activity),
            fc_max: toInt(row.fc_max),
            activity_name: row.activity_name ?? null,
            session_comment: null,
            day_id: dayId,
            activity_type_id: activityTypeId,
            workout_session_instance_id: null,
            event_id: eventId,
            ...timestamps(row, {
                createdKeys: ['date_added', 'created_at'],
                updatedKeys: ['date_updated', 'date_added', 'created_at'],
            }),
        };
    },
});
export const migrateSleeps = createMigrator({
    name: 'sleeps',
    mysqlTable: 'sleep_sleep',
    pgTable: 'sleeps',
    batchSize: LARGE_BATCH,
    mapRow: async (row, resolve) => {
        const dayId = await resolve.require('days', row.athlete_day_id);
        if (!dayId)
            return null;
        return {
            day_id: dayId,
            bedtime_date: toTimestamp(row.bedtime_date),
            wake_up_date: toTimestamp(row.wake_up_date),
            quality_rating: row.quality_rating,
            data_source: row.data_source,
            sleep_efficiency_percentage: toFloat(row.sleep_efficiency_percentage),
            sleep_consistency_percentage: toFloat(row.sleep_consistency_percentage),
            need_from_sleep_debt_milli: row.need_from_sleep_debt_milli,
            total_slow_wave_sleep_time_milli: toFloat(row.total_slow_wave_sleep_time_milli),
            total_rem_sleep_time_milli: toFloat(row.total_rem_sleep_time_milli),
            total_in_bed_time_milli: toFloat(row.total_in_bed_time_milli),
            total_awake_time_milli: row.total_awake_time_milli,
            baseline_mili: row.baseline_mili,
            nap_am: row.nap_am,
            nap_pm: row.nap_pm,
            ...timestamps(row, {
                createdKeys: ['date_added', 'created_at'],
                updatedKeys: ['date_updated', 'date_added', 'created_at'],
            }),
        };
    },
});
//# sourceMappingURL=tables.js.map