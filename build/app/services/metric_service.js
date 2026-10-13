import db from '@adonisjs/lucid/services/db';
import { DOMAIN_CONFIG, METRIC_DATA_TYPE, } from '#constants/metrics.constants';
export class MetricService {
    domain;
    constructor(domain) {
        this.domain = domain;
    }
    get config() {
        return DOMAIN_CONFIG[this.domain];
    }
    normalizeValue(raw, type) {
        switch (type) {
            case METRIC_DATA_TYPE.INTEGER:
                return String(Math.round(Number(raw)));
            case METRIC_DATA_TYPE.FLOAT:
                return String(Math.round(Number(raw) * 100) / 100);
            case METRIC_DATA_TYPE.BOOLEAN:
                return raw === '1' || raw === 'true' || Number(raw) !== 0 ? 'true' : 'false';
            case METRIC_DATA_TYPE.STRING:
            default:
                return String(raw);
        }
    }
    getTypedValue(raw, dataType) {
        switch (dataType) {
            case METRIC_DATA_TYPE.INTEGER:
                return Math.round(Number(raw));
            case METRIC_DATA_TYPE.FLOAT:
                return Number(raw);
            case METRIC_DATA_TYPE.BOOLEAN:
                return raw === '1' || raw === 'true' || Number(raw) !== 0 ? true : false;
            case METRIC_DATA_TYPE.STRING:
            default:
                return raw;
        }
    }
    extractNumericMetrics(entity, metricNames) {
        const metricMap = new Map();
        const filterSet = metricNames ? new Set(metricNames) : null;
        for (const metricValue of entity.metricValues || []) {
            if (!metricValue.metric)
                continue;
            const metricName = metricValue.metric.name;
            if (filterSet && !filterSet.has(metricName))
                continue;
            const typedValue = this.getTypedValue(metricValue.value, metricValue.metric.dataType);
            if (typeof typedValue === 'number') {
                metricMap.set(metricName, typedValue);
            }
        }
        return metricMap;
    }
    extractNumericMetricsAsObject(entity, metricNames) {
        const metricMap = this.extractNumericMetrics(entity, metricNames);
        const result = {};
        for (const metricName of metricNames) {
            result[metricName] = metricMap.get(metricName) ?? null;
        }
        return result;
    }
    async storeMetrics(entityId, metricValues, transaction, options) {
        const trx = transaction ?? (await db.transaction());
        const shouldCommit = !transaction;
        const { Metric, MetricValue, entityForeignKey } = this.config;
        try {
            const metricNames = Object.keys(metricValues).sort();
            const metricsMap = options?.metricsCatalog ??
                new Map((await Metric.query({ client: trx }).whereIn('name', metricNames)).map((metric) => [metric.name, metric]));
            const entries = Object.entries(metricValues)
                .filter(([, value]) => value !== null && value !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, value]) => {
                const metric = metricsMap.get(name);
                if (!metric || value === null || value === undefined)
                    return null;
                return {
                    [entityForeignKey]: entityId,
                    metricId: metric.id,
                    value: this.normalizeValue(value, metric.dataType),
                };
            })
                .filter((e) => e !== null);
            if (entries.length === 0) {
                if (shouldCommit)
                    await trx.commit();
                return;
            }
            switch (entityForeignKey) {
                case 'periodId':
                    await trx
                        .knexQuery()
                        .table('period_metric_values')
                        .insert(entries.map((entry) => ({
                        period_id: entry.periodId,
                        metric_id: entry.metricId,
                        value: entry.value,
                    })))
                        .onConflict(['period_id', 'metric_id'])
                        .merge(['value']);
                    break;
                case 'sportActivityId': {
                    const source = options?.source;
                    if (!source) {
                        throw new Error('source is required when storing sport_activity metrics');
                    }
                    await trx
                        .knexQuery()
                        .table('sport_activity_metric_values')
                        .insert(entries.map((entry) => ({
                        sport_activity_id: entry.sportActivityId,
                        metric_id: entry.metricId,
                        source,
                        value: entry.value,
                    })))
                        .onConflict(['sport_activity_id', 'metric_id', 'source'])
                        .merge(['value']);
                    break;
                }
                case 'healthId':
                    await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
                        client: trx,
                    });
                    break;
                case 'sleepId':
                    await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
                        client: trx,
                    });
                    break;
                case 'dayId':
                    await MetricValue.updateOrCreateMany([entityForeignKey, 'metricId'], entries, {
                        client: trx,
                    });
                    break;
            }
            if (shouldCommit) {
                await trx.commit();
            }
        }
        catch (error) {
            if (shouldCommit && !trx.isCompleted) {
                await trx.rollback();
            }
            throw error;
        }
    }
    async storeEntityMetrics(entityId, metricValues, transaction, options) {
        return this.storeMetrics(entityId, metricValues, transaction, options);
    }
    async updateMetrics(entityId, metrics, transaction, options) {
        const trx = transaction ?? (await db.transaction());
        const shouldCommit = !transaction;
        const { MetricValue, Entity } = this.config;
        try {
            const entity = await Entity.query({ client: trx }).where('id', entityId).first();
            if (!entity) {
                throw new Error('Entity not found');
            }
            await this.storeMetrics(entityId, metrics, trx, options);
            if (shouldCommit) {
                await trx.commit();
            }
            const updatedEntity = await Entity.query(shouldCommit ? undefined : { client: trx })
                .where('id', entityId)
                .preload('metricValues', (q) => q.preload('metric'))
                .first();
            if (!updatedEntity) {
                throw new Error('Failed to reload entity');
            }
            return updatedEntity;
        }
        catch (error) {
            if (shouldCommit && !trx.isCompleted) {
                await trx.rollback();
            }
            throw error;
        }
    }
}
//# sourceMappingURL=metric_service.js.map