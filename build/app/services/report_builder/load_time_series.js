import { REPORT_MAX_TIME_SERIES_CURVES, REPORT_TIME_SERIES_POINTS, } from '#constants/report_builder.constants';
import { HEART_RATE_BPM_MAX, HEART_RATE_BPM_MIN, SERIE_TYPE } from '#constants/serie.constants';
import { decodeSeriePoints, downsampleSeriePoints } from '#utils/series';
import db from '@adonisjs/lucid/services/db';
const roundMetricValue = (value) => Math.round(value * 100) / 100;
const mean = (values) => {
    if (values.length === 0)
        return null;
    return roundMetricValue(values.reduce((sum, value) => sum + value, 0) / values.length);
};
const isValidSample = (type, value) => {
    if (type === SERIE_TYPE.HEART_RATE) {
        return value >= HEART_RATE_BPM_MIN && value <= HEART_RATE_BPM_MAX;
    }
    if (type === SERIE_TYPE.POWER_IN_WATTS)
        return value >= 0 && value < 5000;
    if (type === SERIE_TYPE.SPEED_METERS_PER_SECOND)
        return value >= 0;
    if (type === SERIE_TYPE.TOTAL_DISTANCE_IN_METERS)
        return value >= 0;
    return Number.isFinite(value);
};
const scopedSeriesQuery = (clubId, dateRange, types, athleteIds) => {
    const query = db
        .from('series as s')
        .join('periods as p', 'p.id', 's.period_id')
        .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .where('a.club_id', clubId)
        .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
        .whereIn('s.type', types);
    if (athleteIds?.length) {
        query.whereIn('a.id', athleteIds);
    }
    return query;
};
const loadActivityIds = async (clubId, dateRange, types, athleteIds) => {
    const rows = (await scopedSeriesQuery(clubId, dateRange, types, athleteIds)
        .groupBy('sa.id')
        .select('sa.id as sport_activity_id')
        .select(db.raw('MAX(d.date_of_day) as date_of_day'))
        .orderBy('date_of_day', 'desc')
        .limit(REPORT_MAX_TIME_SERIES_CURVES));
    return rows.map((row) => row.sport_activity_id);
};
const toCurvePoints = (type, encodedChunks) => {
    const raw = encodedChunks.flatMap((encoded) => {
        try {
            return decodeSeriePoints(encoded, type);
        }
        catch {
            return [];
        }
    });
    const filtered = raw
        .filter((point) => isValidSample(type, point.value))
        .sort((left, right) => left.ts - right.ts);
    if (filtered.length === 0)
        return [];
    const t0 = filtered[0].ts;
    const normalized = filtered.map((point) => ({
        ts: Math.max(0, point.ts - t0),
        value: point.value,
    }));
    return downsampleSeriePoints(normalized, REPORT_TIME_SERIES_POINTS).map((point) => ({
        elapsedSec: point.ts,
        value: roundMetricValue(point.value),
    }));
};
export const loadTimeSeriesData = async (clubId, dateRange, definitions, athleteIds) => {
    const pointsByKey = new Map(definitions.map((definition) => [definition.key, []]));
    const curvesByKey = new Map(definitions.map((definition) => [definition.key, []]));
    const athletes = {};
    if (definitions.length === 0)
        return { points: pointsByKey, curves: curvesByKey, athletes };
    const types = [...new Set(definitions.map((definition) => definition.field))];
    const activityIds = await loadActivityIds(clubId, dateRange, types, athleteIds);
    if (activityIds.length === 0)
        return { points: pointsByKey, curves: curvesByKey, athletes };
    const rows = (await db
        .from('series as s')
        .join('periods as p', 'p.id', 's.period_id')
        .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .whereIn('sa.id', activityIds)
        .whereIn('s.type', types)
        .select('s.type', 's.data_encoded', 'd.athlete_id', 'a.first_name', 'a.last_name', db.raw("to_char(d.date_of_day, 'YYYY-MM-DD') as date_of_day"), 'sa.id as sport_activity_id')
        .orderBy('p.start_time', 'asc'));
    const keyByType = new Map(definitions.map((definition) => [definition.field, definition.key]));
    const grouped = new Map();
    for (const row of rows) {
        const key = keyByType.get(row.type);
        if (!key)
            continue;
        athletes[row.athlete_id] = `${row.first_name} ${row.last_name}`.trim();
        const groupKey = `${row.sport_activity_id}:${row.type}`;
        const existing = grouped.get(groupKey);
        if (existing) {
            existing.encoded.push(row.data_encoded);
            continue;
        }
        grouped.set(groupKey, {
            key,
            type: row.type,
            athleteId: row.athlete_id,
            activityId: row.sport_activity_id,
            date: row.date_of_day,
            encoded: [row.data_encoded],
        });
    }
    for (const group of grouped.values()) {
        const points = toCurvePoints(group.type, group.encoded);
        if (points.length === 0)
            continue;
        curvesByKey.get(group.key).push({
            athleteId: group.athleteId,
            activityId: group.activityId,
            date: group.date,
            points,
        });
        const sessionMean = mean(points.map((point) => point.value));
        if (sessionMean === null)
            continue;
        pointsByKey.get(group.key).push({
            date: group.date,
            value: sessionMean,
            athleteId: group.athleteId,
        });
    }
    return { points: pointsByKey, curves: curvesByKey, athletes };
};
//# sourceMappingURL=load_time_series.js.map