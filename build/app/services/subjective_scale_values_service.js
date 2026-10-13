import { MetricDomain } from '#contracts/metric';
import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable';
import { MetricService } from '#services/metric_service';
export class SubjectiveScaleValuesService {
    healthMetricService = new MetricService(MetricDomain.HEALTH);
    validatePayload(values, scales, label) {
        if (!values)
            return null;
        const scaleByFieldName = new Map(scales.map((scale) => [scale.fieldName, scale]));
        for (const [fieldName, value] of Object.entries(values)) {
            if (value == null)
                continue;
            const scale = scaleByFieldName.get(fieldName);
            if (!scale) {
                return `Unknown ${label} field: ${fieldName}`;
            }
            if (value < scale.min || value > scale.max) {
                return `${fieldName} must be between ${scale.min} and ${scale.max}`;
            }
        }
        return null;
    }
    validateHealthPayload(payload, scales) {
        const ratingError = this.validatePayload(payload.ratings, scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING), 'health rating');
        if (ratingError)
            return ratingError;
        return this.validatePayload(payload.metrics, scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC), 'health metric');
    }
    validateSleepPayload(ratings, scales) {
        return this.validatePayload(ratings, scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.SLEEP), 'sleep');
    }
    async applyActivity(activity, scales, patch) {
        await this.applyColumnValues(activity, scales, SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY, patch);
        return activity;
    }
    async applySleep(sleep, scales, patch) {
        await this.applyColumnValues(sleep, scales, SUBJECTIVE_VARIABLE_DOMAIN.SLEEP, patch);
        return sleep;
    }
    async applyHealth(health, scales, payload) {
        const ratingPatch = {};
        const metricPatch = {};
        for (const scale of scales) {
            if (scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING) {
                const value = payload.ratings?.[scale.fieldName];
                if (value === undefined)
                    continue;
                ratingPatch[scale.fieldName] = value;
                continue;
            }
            if (scale.domain !== SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC)
                continue;
            const value = payload.metrics?.[scale.fieldName];
            if (value === undefined || value == null)
                continue;
            metricPatch[scale.fieldName] = value;
        }
        if (Object.keys(ratingPatch).length > 0) {
            health.merge(ratingPatch);
            await health.save();
        }
        if (Object.keys(metricPatch).length > 0) {
            await this.healthMetricService.updateMetrics(health.id, metricPatch);
        }
        await health.load('metricValues', (query) => query.preload('metric'));
        return health;
    }
    readSleep(sleep, scales) {
        return this.readColumnValues(sleep, scales, SUBJECTIVE_VARIABLE_DOMAIN.SLEEP);
    }
    readHealthSplit(health, scales) {
        const ratings = {};
        const metrics = {};
        for (const scale of scales) {
            if (scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING) {
                const value = health[scale.fieldName];
                ratings[scale.fieldName] = typeof value === 'number' ? value : null;
                continue;
            }
            if (scale.domain !== SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_METRIC)
                continue;
            const metricValue = health.metricValues.find((entry) => entry.metric?.name === scale.fieldName);
            metrics[scale.fieldName] = metricValue ? Number(metricValue.value) : null;
        }
        return { ratings, metrics };
    }
    async applyColumnValues(model, scales, domain, patch) {
        const modelPatch = {};
        for (const scale of scales) {
            if (scale.domain !== domain)
                continue;
            const value = patch[scale.fieldName];
            if (value === undefined)
                continue;
            modelPatch[scale.fieldName] = value;
        }
        if (Object.keys(modelPatch).length === 0)
            return;
        model.merge(modelPatch);
        await model.save();
    }
    readColumnValues(model, scales, domain) {
        const result = {};
        const record = model;
        for (const scale of scales) {
            if (scale.domain !== domain)
                continue;
            const value = record[scale.fieldName];
            result[scale.fieldName] = typeof value === 'number' ? value : null;
        }
        return result;
    }
}
//# sourceMappingURL=subjective_scale_values_service.js.map