const RESERVED_KEYS = new Set([
    'day_id',
    'data_source',
    'time_of_activity',
    'duration',
    'event_type',
    'game_activity',
    'activity_type_id',
]);
const FIELD_NAME_TO_MODEL = {
    active_calories: 'activeCalories',
    rpe: 'rpe',
    distance: 'distance',
};
const toDurationSeconds = (duration) => duration > 10_000_000 ? Math.round(duration / 1_000_000) : Math.round(duration / 1000);
export const toSportActivityCreatePayload = (updateData) => {
    const payload = {
        dayId: updateData.day_id,
        dataSource: updateData.data_source,
    };
    if (updateData.time_of_activity !== undefined) {
        payload.timeOfActivity = updateData.time_of_activity;
    }
    if (updateData.duration !== undefined) {
        payload.durationSeconds = toDurationSeconds(updateData.duration);
    }
    if (updateData.game_activity !== undefined) {
        payload.gameActivity = updateData.game_activity === 1;
    }
    if (updateData.activity_type_id !== undefined && updateData.activity_type_id !== null) {
        payload.activityTypeId = String(updateData.activity_type_id);
    }
    for (const [key, value] of Object.entries(updateData)) {
        if (RESERVED_KEYS.has(key) || value === undefined)
            continue;
        const modelKey = FIELD_NAME_TO_MODEL[key];
        if (!modelKey)
            continue;
        payload[modelKey] = value;
    }
    return payload;
};
//# sourceMappingURL=my_coach_sport_activity.js.map