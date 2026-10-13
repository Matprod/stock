import { DateTime } from 'luxon';
export const HAMBURG_ML_API_CONFIG = {
    timeoutMs: 1_200_000,
    maxRetries: 3,
    retryBaseDelayMs: 5_000,
};
export const HAMBURG_ML_STAGES = {
    statsportsComplete: 'statsports-complete',
    merge: 'merge',
    injuryHistory: 'injury-history',
    subjectiveImputation: 'subjective-imputation',
    dailyFactors: 'daily-factors',
    enrich: 'enrich',
    diagnostik: 'diagnostik',
    loadFeatures: 'load-features',
    predictInjury: 'predict/injury',
    predictPerformance: 'predict/performance-v1',
};
export const HAMBURG_ML_STAGE_ORDER = [
    HAMBURG_ML_STAGES.statsportsComplete,
    HAMBURG_ML_STAGES.merge,
    HAMBURG_ML_STAGES.injuryHistory,
    HAMBURG_ML_STAGES.subjectiveImputation,
    HAMBURG_ML_STAGES.dailyFactors,
    HAMBURG_ML_STAGES.enrich,
    HAMBURG_ML_STAGES.diagnostik,
    HAMBURG_ML_STAGES.loadFeatures,
];
export const HAMBURG_ML_PERIOD_PROVIDER_ID = 'hamburg-ml';
export const HAMBURG_ML_MAX_RANGE_DAYS = 92;
export const HAMBURG_ML_INJURY_MAX_RANGE_DAYS = 7;
export const HAMBURG_ML_PERSIST_CHUNK_SIZE = 500;
export const HAMBURG_ML_DATE_FORMAT = 'yyyy-MM-dd';
export const HAMBURG_ML_SUBJECTIVE_TARGETS = {
    mood_rating: { kind: 'health_rating', field: 'moodRating' },
    body_soreness_rating: { kind: 'health_rating', field: 'bodySorenessRating' },
    sleep_quality_rating: { kind: 'sleep', field: 'qualityRating' },
    training_rpe: { kind: 'health_metric', metric: 'training_rpe' },
    injury_status: { kind: 'health_metric', metric: 'injury_status' },
    at_it_rt_rpe: { kind: 'health_metric', metric: 'at_it_rt_rpe' },
};
export const HAMBURG_ML_HEALTH_METRIC_NAMES = [
    HAMBURG_ML_SUBJECTIVE_TARGETS.training_rpe.metric,
    HAMBURG_ML_SUBJECTIVE_TARGETS.injury_status.metric,
    HAMBURG_ML_SUBJECTIVE_TARGETS.at_it_rt_rpe.metric,
];
export const HAMBURG_ML_DAY_FACTOR_METRICS = [
    'F1_load',
    'F2_load',
    'F3_load',
    'F4_load',
    'F5_load',
    'F6_load',
    'F7_load',
];
export function buildRangeBatches(startDate, endDate, maxRangeDays = HAMBURG_ML_MAX_RANGE_DAYS) {
    const start = DateTime.fromISO(startDate, { zone: 'utc' }).startOf('day');
    const end = DateTime.fromISO(endDate, { zone: 'utc' }).startOf('day');
    if (!start.isValid || !end.isValid || start > end) {
        throw new Error(`Invalid backfill range: ${startDate} .. ${endDate}`);
    }
    if (maxRangeDays < 1) {
        throw new Error(`Invalid maxRangeDays: ${maxRangeDays}`);
    }
    const batches = [];
    let cursor = start;
    while (cursor <= end) {
        const batchEnd = DateTime.min(cursor.plus({ days: maxRangeDays - 1 }), end);
        batches.push({ start: cursor.toISODate(), end: batchEnd.toISODate() });
        cursor = batchEnd.plus({ days: 1 });
    }
    return batches;
}
//# sourceMappingURL=hamburg_ml.constants.js.map