export const SKILLCORNER_API_CONFIG = {
    baseUrl: 'https://skillcorner.com/api',
    pageSize: 100,
    timeoutMs: 60_000,
};
export const SKILLCORNER_IMPORT_MIN_DATE = '2022-06-20';
export const SKILLCORNER_PHYSICAL_METRIC_MAP = {
    minutes_full_all: 'minutes_played',
    total_distance_full_all: 'total_distance',
    sprint_distance_full_all: 'sprint_distance',
    hi_distance_full_all: 'intensive_run_distance',
    psv99: 'max_speed',
};
export function mapSkillcornerPhysicalMetrics(row) {
    const result = {};
    for (const [apiField, metricName] of Object.entries(SKILLCORNER_PHYSICAL_METRIC_MAP)) {
        const raw = row[apiField];
        if (raw === null || raw === undefined || raw === '') {
            result[metricName] = null;
            continue;
        }
        const numeric = Number(raw);
        result[metricName] = Number.isFinite(numeric) ? numeric : null;
    }
    return result;
}
//# sourceMappingURL=skillcorner.constants.js.map