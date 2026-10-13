import { HAMBURG_ML_DATE_FORMAT, HAMBURG_ML_HEALTH_METRIC_NAMES, HAMBURG_ML_PERSIST_CHUNK_SIZE, HAMBURG_ML_SUBJECTIVE_TARGETS, } from '#constants/hamburg_ml.constants';
import Day from '#models_pg/day';
import HealthMetric from '#models_pg/health_metric';
import HealthMetricValue from '#models_pg/health_metric_value';
import HealthRating from '#models_pg/health_rating';
import Sleep from '#models_pg/sleep';
import logger from '@adonisjs/core/services/logger';
import db from '@adonisjs/lucid/services/db';
import { DateTime } from 'luxon';
export class HamburgSubjectivePersistService {
    async persist(players, request) {
        const rows = this.collectRows(players, request);
        if (rows.length === 0)
            return;
        const trx = await db.transaction();
        try {
            await this.attachDays(rows, trx);
            const healthByDayId = await this.upsertHealthRatings(rows, trx);
            await this.upsertSleeps(rows, trx);
            const metricEntries = await this.collectHealthMetricEntries(rows, healthByDayId, trx);
            for (let i = 0; i < metricEntries.length; i += HAMBURG_ML_PERSIST_CHUNK_SIZE) {
                await HealthMetricValue.updateOrCreateMany(['healthId', 'metricId'], metricEntries.slice(i, i + HAMBURG_ML_PERSIST_CHUNK_SIZE), { client: trx });
            }
            await trx.commit();
            logger.info(`Hamburg ML subjective-imputation: persisted ${rows.length} day(s), ${metricEntries.length} health metric value(s)`);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    collectRows(players, request) {
        const fallbackDate = 'date' in request ? request.date : null;
        const rows = [];
        for (const player of players) {
            if (!player.id)
                continue;
            for (const day of player.days ?? []) {
                const dayId = day.id?.trim() ? day.id : null;
                const dateOfDay = day.date ?? fallbackDate ?? null;
                if (!dayId && !dateOfDay)
                    continue;
                const row = {
                    athleteId: player.id,
                    dayId,
                    dateOfDay,
                    healthRatings: {},
                    healthMetrics: {},
                    sleepQuality: null,
                };
                for (const metric of day.metrics) {
                    const numeric = typeof metric.value === 'number' ? metric.value : Number(metric.value);
                    if (!Number.isFinite(numeric))
                        continue;
                    const target = HAMBURG_ML_SUBJECTIVE_TARGETS[metric.metric];
                    if (!target)
                        continue;
                    const value = Math.round(numeric);
                    if (target.kind === 'health_rating') {
                        row.healthRatings[target.field] = value;
                    }
                    else if (target.kind === 'sleep') {
                        row.sleepQuality = value;
                    }
                    else {
                        row.healthMetrics[target.metric] = value;
                    }
                }
                if (Object.keys(row.healthRatings).length === 0 &&
                    Object.keys(row.healthMetrics).length === 0 &&
                    row.sleepQuality === null) {
                    continue;
                }
                rows.push(row);
            }
        }
        return rows;
    }
    async attachDays(rows, trx) {
        const ids = [...new Set(rows.map((row) => row.dayId).filter((id) => Boolean(id)))];
        const daysById = new Map();
        const daysByAthleteDate = new Map();
        if (ids.length > 0) {
            const existing = await Day.query({ client: trx }).whereIn('id', ids);
            for (const day of existing) {
                const dateOfDay = day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT);
                daysById.set(day.id, day);
                daysByAthleteDate.set(`${day.athleteId}|${dateOfDay}`, day);
                for (const row of rows) {
                    if (row.dayId === day.id)
                        row.dateOfDay = dateOfDay;
                }
            }
        }
        const unresolved = rows.filter((row) => !row.dayId || !daysById.has(row.dayId));
        const athleteIds = [...new Set(unresolved.map((row) => row.athleteId))];
        const dates = [
            ...new Set(unresolved.map((row) => row.dateOfDay).filter((date) => Boolean(date))),
        ];
        if (athleteIds.length > 0 && dates.length > 0) {
            const existing = await Day.query({ client: trx })
                .whereIn('athleteId', athleteIds)
                .whereIn('dateOfDay', dates);
            for (const day of existing) {
                daysByAthleteDate.set(`${day.athleteId}|${day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT)}`, day);
            }
        }
        const missing = [
            ...new Map(unresolved
                .filter((row) => {
                if (!row.dateOfDay)
                    return false;
                return !daysByAthleteDate.has(`${row.athleteId}|${row.dateOfDay}`);
            })
                .map((row) => [
                `${row.athleteId}|${row.dateOfDay}`,
                {
                    athleteId: row.athleteId,
                    dateOfDay: DateTime.fromISO(row.dateOfDay, { zone: 'utc' }),
                },
            ])).values(),
        ];
        if (missing.length > 0) {
            await Day.updateOrCreateMany(['athleteId', 'dateOfDay'], missing, { client: trx });
            const refreshed = await Day.query({ client: trx })
                .whereIn('athleteId', missing.map((day) => day.athleteId))
                .whereIn('dateOfDay', missing.map((day) => day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT)));
            for (const day of refreshed) {
                daysByAthleteDate.set(`${day.athleteId}|${day.dateOfDay.toFormat(HAMBURG_ML_DATE_FORMAT)}`, day);
            }
        }
        for (const row of rows) {
            const day = (row.dayId ? daysById.get(row.dayId) : undefined) ??
                (row.dateOfDay ? daysByAthleteDate.get(`${row.athleteId}|${row.dateOfDay}`) : undefined);
            row.dayId = day?.id ?? null;
        }
    }
    async upsertHealthRatings(rows, trx) {
        const healthRows = rows.filter((row) => row.dayId &&
            (Object.keys(row.healthRatings).length > 0 || Object.keys(row.healthMetrics).length > 0));
        const dayIds = [...new Set(healthRows.map((row) => row.dayId))];
        const healthByDayId = new Map();
        if (dayIds.length === 0)
            return healthByDayId;
        const existing = await HealthRating.query({ client: trx }).whereIn('dayId', dayIds);
        for (const health of existing) {
            if (!healthByDayId.has(health.dayId))
                healthByDayId.set(health.dayId, health);
        }
        const toCreate = [];
        const toUpdate = [];
        const seen = new Set();
        for (const row of healthRows) {
            const dayId = row.dayId;
            if (seen.has(dayId))
                continue;
            seen.add(dayId);
            const moodRating = row.healthRatings.moodRating ?? null;
            const bodySorenessRating = row.healthRatings.bodySorenessRating ?? null;
            const health = healthByDayId.get(dayId);
            if (!health) {
                toCreate.push({ dayId, moodRating, bodySorenessRating });
                continue;
            }
            if (moodRating !== null)
                health.moodRating = moodRating;
            if (bodySorenessRating !== null)
                health.bodySorenessRating = bodySorenessRating;
            if (moodRating !== null || bodySorenessRating !== null)
                toUpdate.push(health);
        }
        if (toCreate.length > 0) {
            const created = await HealthRating.createMany(toCreate, { client: trx });
            for (const health of created) {
                healthByDayId.set(health.dayId, health);
            }
        }
        if (toUpdate.length > 0) {
            await Promise.all(toUpdate.map((health) => health.save()));
        }
        return healthByDayId;
    }
    async upsertSleeps(rows, trx) {
        const sleepRows = rows.filter((row) => row.dayId && row.sleepQuality !== null);
        const dayIds = [...new Set(sleepRows.map((row) => row.dayId))];
        if (dayIds.length === 0)
            return;
        const sleepByDayId = new Map();
        const existing = await Sleep.query({ client: trx }).whereIn('dayId', dayIds);
        for (const sleep of existing) {
            if (!sleepByDayId.has(sleep.dayId))
                sleepByDayId.set(sleep.dayId, sleep);
        }
        const toCreate = [];
        const toUpdate = [];
        const seen = new Set();
        for (const row of sleepRows) {
            const dayId = row.dayId;
            const qualityRating = row.sleepQuality;
            if (seen.has(dayId))
                continue;
            seen.add(dayId);
            const sleep = sleepByDayId.get(dayId);
            if (!sleep) {
                toCreate.push({ dayId, qualityRating });
                continue;
            }
            sleep.qualityRating = qualityRating;
            toUpdate.push(sleep);
        }
        if (toCreate.length > 0) {
            await Sleep.createMany(toCreate, { client: trx });
        }
        if (toUpdate.length > 0) {
            await Promise.all(toUpdate.map((sleep) => sleep.save()));
        }
    }
    async collectHealthMetricEntries(rows, healthByDayId, trx) {
        const metrics = await HealthMetric.query({ client: trx }).whereIn('name', [
            ...HAMBURG_ML_HEALTH_METRIC_NAMES,
        ]);
        const catalog = new Map(metrics.map((metric) => [metric.name, metric.id]));
        const entries = new Map();
        for (const row of rows) {
            if (!row.dayId)
                continue;
            const health = healthByDayId.get(row.dayId);
            if (!health)
                continue;
            for (const [name, value] of Object.entries(row.healthMetrics)) {
                if (value === undefined)
                    continue;
                const metricId = catalog.get(name);
                if (!metricId)
                    continue;
                entries.set(`${health.id}:${metricId}`, {
                    healthId: health.id,
                    metricId,
                    value: String(value),
                });
            }
        }
        return [...entries.values()];
    }
}
//# sourceMappingURL=hamburg_subjective_persist_service.js.map