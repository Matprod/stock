import { METRIC_DATA_TYPE } from '#constants/metrics.constants';
import PeriodMetric from '#models_pg/period_metric';
import Period from '#models_pg/period';
import db from '@adonisjs/lucid/services/db';
import logger from '@adonisjs/core/services/logger';
const PERIOD_METRIC_VALUE_UPSERT_CHUNK = 500;
export class PeriodMetricService {
    convertValueToString(value, dataType) {
        switch (dataType) {
            case METRIC_DATA_TYPE.INTEGER:
                return String(Math.round(Number(value)));
            case METRIC_DATA_TYPE.BOOLEAN:
                return value === '1' || value === 'true' || Number(value) !== 0 ? 'true' : 'false';
            case METRIC_DATA_TYPE.FLOAT:
                return String(Number(value));
            case METRIC_DATA_TYPE.STRING:
            default:
                return String(value);
        }
    }
    async storePeriodMetrics(period, metricValues, options) {
        const providedTrx = options?.transaction;
        const trx = providedTrx || (await db.transaction());
        const shouldCommit = !providedTrx;
        try {
            const metricsMap = options?.metricsMap ??
                new Map((await PeriodMetric.query({ client: trx }).whereIn('name', options?.metricNames || Object.keys(metricValues))).map((m) => [m.name, m]));
            const entries = this.buildPeriodMetricValueEntries(period.id, metricValues, metricsMap);
            await this.upsertPeriodMetricValues(entries, { transaction: trx });
            if (shouldCommit)
                await trx.commit();
        }
        catch (error) {
            if (shouldCommit && !trx.isCompleted) {
                await trx.rollback();
            }
            throw error;
        }
    }
    async updatePeriodMetrics(periodId, metrics, options) {
        const providedTrx = options?.transaction;
        const trx = providedTrx || (await db.transaction());
        const shouldCommit = !providedTrx;
        try {
            const period = await Period.query({ client: trx })
                .where('id', periodId)
                .preload('sportActivity')
                .first();
            if (!period) {
                if (shouldCommit)
                    await trx.rollback();
                throw new Error('Period not found');
            }
            if (options?.periodValidation) {
                const isValid = this.validatePeriod(period, options.periodValidation);
                if (!isValid) {
                    if (shouldCommit)
                        await trx.rollback();
                    throw new Error('Period validation failed');
                }
            }
            if (options?.metricValidation) {
                const isValid = this.validateMetrics(Object.keys(metrics), options.metricValidation);
                if (!isValid) {
                    if (shouldCommit)
                        await trx.rollback();
                    throw new Error('Invalid metrics provided');
                }
            }
            await this.storePeriodMetrics(period, metrics, {
                metricNames: Object.keys(metrics),
                transaction: trx,
            });
            if (shouldCommit) {
                await trx.commit();
            }
            if (options?.trainingLoadRecalculator) {
                try {
                    const period = await Period.query().where('id', periodId).preload('sportActivity').first();
                    if (period?.sportActivityId) {
                        await options.trainingLoadRecalculator.computeBasketballExternalLoad(period.sportActivityId, {
                            useHistorical: true,
                            updateTrainingLoad: true,
                        });
                    }
                }
                catch (error) {
                    logger.error({ error, periodId }, 'Failed to recalculate training load');
                }
            }
            const updatedPeriod = await Period.query()
                .where('id', periodId)
                .preload('metricValues', (q) => q.preload('metric'))
                .first();
            if (!updatedPeriod)
                throw new Error('Failed to reload updated period');
            return updatedPeriod;
        }
        catch (error) {
            if (shouldCommit) {
                await trx.rollback();
            }
            throw error;
        }
    }
    buildPeriodMetricValueEntries(periodId, metricValues, metricsMap) {
        const entries = [];
        for (const [name, raw] of Object.entries(metricValues)) {
            if (raw === null)
                continue;
            const metric = metricsMap.get(name);
            if (!metric)
                continue;
            entries.push({
                periodId,
                metricId: metric.id,
                value: this.convertValueToString(raw, metric.dataType),
            });
        }
        return entries;
    }
    async upsertPeriodMetricValues(entries, options) {
        if (entries.length === 0)
            return;
        const unique = new Map();
        for (const entry of entries) {
            unique.set(`${entry.periodId}|${entry.metricId}`, entry);
        }
        const deduped = [...unique.values()];
        const providedTrx = options?.transaction;
        const trx = providedTrx || (await db.transaction());
        const shouldCommit = !providedTrx;
        try {
            for (let i = 0; i < deduped.length; i += PERIOD_METRIC_VALUE_UPSERT_CHUNK) {
                const chunk = deduped.slice(i, i + PERIOD_METRIC_VALUE_UPSERT_CHUNK);
                await trx
                    .knexQuery()
                    .table('period_metric_values')
                    .insert(chunk.map((entry) => ({
                    period_id: entry.periodId,
                    metric_id: entry.metricId,
                    value: entry.value,
                })))
                    .onConflict(['period_id', 'metric_id'])
                    .merge(['value']);
            }
            if (shouldCommit)
                await trx.commit();
        }
        catch (error) {
            if (shouldCommit && !trx.isCompleted) {
                await trx.rollback();
            }
            throw error;
        }
    }
    async getClubMetrics(clubId, startDate, endDate) {
        const rows = await this.getClubMetricsWithUnits(clubId, startDate, endDate);
        return rows.map((r) => r.name);
    }
    async getClubMetricsWithUnits(clubId, startDate, endDate) {
        const rows = await db
            .from('period_metrics as pm')
            .join('period_metric_values as pmv', 'pmv.metric_id', 'pm.id')
            .join('periods as p', 'p.id', 'pmv.period_id')
            .join('sport_activities as sa', 'sa.id', 'p.sport_activity_id')
            .join('days as d', 'd.id', 'sa.day_id')
            .join('athletes as a', 'a.id', 'd.athlete_id')
            .leftJoin('period_metric_club_units as pmcu', function () {
            this.on('pmcu.metric_id', '=', 'pm.id').andOnVal('pmcu.club_id', clubId);
        })
            .where('a.club_id', clubId)
            .whereBetween('d.date_of_day', [startDate, endDate])
            .groupBy('pm.name', 'pmcu.unit', 'pm.unit')
            .orderBy('pm.name')
            .select('pm.name')
            .select(db.raw('COALESCE(pmcu.unit, pm.unit) AS unit'));
        return rows.map((r) => ({
            name: String(r.name),
            unit: r.unit != null ? String(r.unit) : null,
        }));
    }
    validatePeriod(period, validation) {
        if (!validation.dataSource) {
            return true;
        }
        if (!period.sportActivity) {
            return false;
        }
        const dataSources = Array.isArray(validation.dataSource)
            ? validation.dataSource
            : [validation.dataSource];
        return dataSources.includes(period.sportActivity.dataSource);
    }
    validateMetrics(metricNames, validation) {
        if (!validation.allowedMetricNames) {
            return true;
        }
        const allowedSet = validation.allowedMetricNames instanceof Set
            ? validation.allowedMetricNames
            : new Set(validation.allowedMetricNames);
        for (const name of metricNames) {
            if (!allowedSet.has(name)) {
                throw new Error(`Invalid metric: ${name}. Allowed metrics: ${Array.from(allowedSet).join(', ')}`);
            }
        }
        return true;
    }
}
//# sourceMappingURL=period_metric_service.js.map