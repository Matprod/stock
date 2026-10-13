import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable';
export const extractSportActivitySubjectivePatch = (body, scales) => {
    const activityScales = scales.filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY);
    const patch = {};
    for (const scale of activityScales) {
        const raw = body[scale.fieldName];
        if (raw === undefined) {
            continue;
        }
        if (raw !== null && typeof raw !== 'number') {
            return {
                patch: {},
                error: `${scale.fieldName} must be a number`,
            };
        }
        if (raw != null && (raw < scale.min || raw > scale.max)) {
            return {
                patch: {},
                error: `${scale.fieldName} must be between ${scale.min} and ${scale.max}`,
            };
        }
        patch[scale.fieldName] = raw;
    }
    return { patch, error: null };
};
//# sourceMappingURL=mobile_subjective_activity_payload.js.map