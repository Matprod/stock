import { HAMBURG_ML_DATE_FORMAT, HAMBURG_ML_DAY_FACTOR_METRICS, HAMBURG_ML_PERSIST_CHUNK_SIZE, } from '#constants/hamburg_ml.constants';
import Day from '#models_pg/day';
import DayMetric from '#models_pg/day_metric';
import DayMetricValue from '#models_pg/day_metric_value';
import logger from '@adonisjs/core/services/logger';
import db from '@adonisjs/lucid/services/db';
import { DateTime } from 'luxon';
const DAY_FACTOR_METRIC_SET = new Set(HAMBURG_ML_DAY_FACTOR_METRICS);
export class HamburgDailyFactorsPersistService {
    async persist(players, request) {
        const rows = this.collectRows(players, request);
        if (rows.length === 0)
            return;
        const trx = await db.transaction();
        try {
            await this.attachDays(rows, trx);
            const catalog = await this.loadCatalog(rows, trx);
            const entries = this.collectEntries(rows, catalog);
            for (let i = 0; i < entries.length; i += HAMBURG_ML_PERSIST_CHUNK_SIZE) {
                await DayMetricValue.updateOrCreateMany(['dayId', 'metricId'], entries.slice(i, i + HAMBURG_ML_PERSIST_CHUNK_SIZE), { client: trx });
            }
            await trx.commit();
            logger.info(`Hamburg ML daily-factors: persisted ${rows.length} day(s), ${entries.length} day metric value(s)`);
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
                const metrics = {};
                for (const metric of day.metrics) {
                    if (!DAY_FACTOR_METRIC_SET.has(metric.metric))
                        continue;
                    const value = this.toFiniteNumber(metric.value);
                    if (value === null)
                        continue;
                    metrics[metric.metric] = value;
                }
                if (Object.keys(metrics).length === 0)
                    continue;
                rows.push({ athleteId: player.id, dayId, dateOfDay, metrics });
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
                .filter((row) => row.dateOfDay && !daysByAthleteDate.has(`${row.athleteId}|${row.dateOfDay}`))
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
    async loadCatalog(rows, trx) {
        const names = [
            ...new Set(rows.flatMap((row) => Object.keys(row.metrics))),
        ];
        if (names.length === 0)
            return new Map();
        const metrics = await DayMetric.query({ client: trx }).whereIn('name', names);
        const catalog = new Map(metrics.map((metric) => [metric.name, metric.id]));
        const missing = names.filter((name) => !catalog.has(name));
        if (missing.length > 0) {
            logger.warn(`Hamburg ML daily-factors: unknown day_metrics ${missing.join(', ')}`);
        }
        return catalog;
    }
    collectEntries(rows, catalog) {
        const entries = new Map();
        for (const row of rows) {
            if (!row.dayId)
                continue;
            for (const [name, value] of Object.entries(row.metrics)) {
                const metricId = catalog.get(name);
                if (!metricId)
                    continue;
                entries.set(`${row.dayId}:${metricId}`, {
                    dayId: row.dayId,
                    metricId,
                    value: String(value),
                });
            }
        }
        return [...entries.values()];
    }
    toFiniteNumber(value) {
        if (value === null)
            return null;
        const numeric = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(numeric))
            return null;
        return Math.round(numeric * 1e6) / 1e6;
    }
}
//# sourceMappingURL=hamburg_daily_factors_persist_service.js.map