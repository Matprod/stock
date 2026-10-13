export const SUBJECTIVE_VARIABLE_DOMAIN = {
    SPORT_ACTIVITY: 'sport_activity',
    HEALTH_RATING: 'health_rating',
    HEALTH_METRIC: 'health_metric',
    SLEEP: 'sleep',
};
export const SUBJECTIVE_VARIABLE_DOMAINS = Object.values(SUBJECTIVE_VARIABLE_DOMAIN);
export const SUBJECTIVE_DISPLAY_CONTEXT = {
    ACTIVITY: 'activity',
    WELLNESS: 'wellness',
};
export function subjectiveDomainToDisplayContext(domain) {
    return domain === SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY
        ? SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY
        : SUBJECTIVE_DISPLAY_CONTEXT.WELLNESS;
}
//# sourceMappingURL=subjective_variable.js.map