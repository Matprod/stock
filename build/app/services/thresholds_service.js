import ClubSetting from '#models_pg/club_settings';
const FALLBACK_THRESHOLDS = {
    performance: { high: 70, medium: 40 },
    injury: { high: 20, medium: 10 },
    availability: { high: 70, medium: 40 },
};
export default class ThresholdsService {
    static getThresholdLevelValidationError(level, label) {
        if (level.medium < 0 || level.medium > 100 || level.high < 0 || level.high > 100) {
            return `${label} thresholds must be between 0 and 100`;
        }
        if (level.medium >= level.high) {
            return `${label} medium threshold must be strictly lower than high threshold`;
        }
        return null;
    }
    static getThresholdsPayloadValidationError(payload) {
        const checks = [
            { level: payload.performance, label: 'Performance' },
            { level: payload.injury, label: 'Injury' },
            { level: payload.availability, label: 'Availability' },
        ];
        for (const check of checks) {
            const error = this.getThresholdLevelValidationError(check.level, check.label);
            if (error)
                return error;
        }
        return null;
    }
    mapThresholdRow(row) {
        return {
            performance: {
                high: row.performanceHigh,
                medium: row.performanceMedium,
            },
            injury: {
                high: row.injuryHigh,
                medium: row.injuryMedium,
            },
            availability: {
                high: row.availabilityHigh,
                medium: row.availabilityMedium,
            },
        };
    }
    async getThresholdsByClubId(clubId) {
        const fallbackResponse = {
            clubId,
            thresholds: FALLBACK_THRESHOLDS,
        };
        if (clubId === null) {
            return fallbackResponse;
        }
        const thresholdCandidate = await ClubSetting.query().where('club_id', clubId).first();
        if (thresholdCandidate) {
            return {
                clubId,
                thresholds: this.mapThresholdRow(thresholdCandidate),
            };
        }
        return fallbackResponse;
    }
}
//# sourceMappingURL=thresholds_service.js.map