import PeriodMetric from '#models_pg/period_metric';
import { BaseTrainingLoad } from '../base.js';
import { TYPICAL_METRIC_MAXES, POSITION_FORWARD, POSITION_CENTER, TRAINING_LOAD_CONFIGS, } from '#constants/basketball.constants';
import { calculateTrueShootingPercentage, extractPositionStats } from './basketball.js';
import { standardDeviation, median } from '../../statistics.js';
import { parseMinutesToSeconds } from '../../time.js';
export class BasketballTrainingLoad extends BaseTrainingLoad {
    static DEFAULT_POSITION = 'Guard (G)';
    options;
    constructor(sportActivity, options = {}) {
        super(sportActivity);
        this.options = options;
    }
    calculateExternalTrainingLoad() {
        if (!this.sportActivity.periods ||
            this.sportActivity.periods.length === 0 ||
            this.sportActivity.dataSource !== 'api_basket') {
            return 0;
        }
        const period = this.sportActivity.periods[0];
        const rawMetrics = BasketballTrainingLoad.extractRawMetricsFromPeriodStatic(period);
        const positionName = this.options.positionName ||
            this.sportActivity.day?.athlete?.playerPosition?.name ||
            BasketballTrainingLoad.DEFAULT_POSITION;
        const calculatedMetrics = BasketballTrainingLoad.calculatePositionMetrics(positionName, rawMetrics);
        const config = BasketballTrainingLoad.getTrainingLoadConfigStatic(positionName);
        if (!config) {
            return 0;
        }
        const primaryMetric = calculatedMetrics[config.metric1] ?? 0;
        const secondaryMetric = calculatedMetrics[config.metric2] ?? 0;
        if (primaryMetric === 0 && secondaryMetric === 0) {
            return 0;
        }
        const normalizedPrimaryMetric = this.options.normalizedPrimaryMetric ?? null;
        const normalizedSecondaryMetric = this.options.normalizedSecondaryMetric ?? null;
        let finalValue;
        if (normalizedPrimaryMetric === null || normalizedSecondaryMetric === null) {
            const component1 = config.coeff1 * primaryMetric;
            const component2 = config.coeff2 * secondaryMetric;
            const rawSum = component1 + component2;
            const max1 = TYPICAL_METRIC_MAXES[config.metric1] ?? 20;
            const max2 = TYPICAL_METRIC_MAXES[config.metric2] ?? 20;
            const maxSum = config.coeff1 * max1 + config.coeff2 * max2;
            const normalizedSum = rawSum / Math.max(maxSum, rawSum);
            finalValue = Math.min(Math.max(100 * normalizedSum, 0), 100);
        }
        else {
            const power1 = Math.pow(10, normalizedPrimaryMetric);
            const power2 = Math.pow(10, normalizedSecondaryMetric);
            const adjusted1 = config.coeff1 * power1;
            const adjusted2 = config.coeff2 * power2;
            const sum = adjusted1 + adjusted2;
            finalValue = Math.min(Math.max(sum * 10, 0), 100);
        }
        return finalValue;
    }
    static extractRawMetricsFromPeriodStatic(period) {
        return period.metricValues.reduce((acc, mv) => {
            const value = parseFloat(mv.value);
            acc[mv.metric.name] = isNaN(value) ? null : value;
            return acc;
        }, {});
    }
    static getPositionType(playerPositionName) {
        if (POSITION_FORWARD.some((pos) => playerPositionName === pos)) {
            return 'forward';
        }
        if (POSITION_CENTER.some((pos) => playerPositionName === pos)) {
            return 'center';
        }
        return 'guard';
    }
    static calculatePositionMetrics(playerPositionName, rawStats) {
        const stats = extractPositionStats(rawStats);
        const positionType = BasketballTrainingLoad.getPositionType(playerPositionName);
        switch (positionType) {
            case 'forward':
                return {
                    basketball_player_load: 0.5 * stats.ftm + 0.5 * stats.fta,
                    basketball_jumps: stats.fga,
                    basketball_high_intensity_pl: null,
                    basketball_hsr: null,
                };
            case 'center':
                return {
                    basketball_player_load: null,
                    basketball_jumps: 0.5 * stats.twoPM + 0.5 * stats.twoPA,
                    basketball_high_intensity_pl: 0.5 * stats.assists + 0.5 * stats.rebounds,
                    basketball_hsr: null,
                };
            case 'guard':
            default: {
                const trueShootingPercentage = calculateTrueShootingPercentage(stats.points, stats.fga, stats.fta);
                return {
                    basketball_player_load: 0.4 * stats.assists + 0.6 * stats.rebounds,
                    basketball_jumps: null,
                    basketball_high_intensity_pl: null,
                    basketball_hsr: 0.4 * stats.threePM + 0.6 * trueShootingPercentage,
                };
            }
        }
    }
    static getTrainingLoadConfigStatic(playerPositionName) {
        const positionType = BasketballTrainingLoad.getPositionType(playerPositionName);
        switch (positionType) {
            case 'forward':
                return TRAINING_LOAD_CONFIGS.forward;
            case 'center':
                return TRAINING_LOAD_CONFIGS.center;
            case 'guard':
            default:
                return TRAINING_LOAD_CONFIGS.guard;
        }
    }
    static async getHistoricalMetricValuesStatic(metricName, activities, excludePeriodId, excludeProviderId) {
        const metric = await PeriodMetric.query().where('name', metricName).first();
        if (!metric)
            return [];
        if (activities.length === 0)
            return [];
        return activities.flatMap((activity) => activity.periods
            .filter((p) => p && String(p.id) !== excludePeriodId && p.providerId !== excludeProviderId)
            .flatMap((period) => period.metricValues
            .filter((mv) => String(mv.metricId) === String(metric.id))
            .map((mv) => parseFloat(mv.value))
            .filter((v) => !isNaN(v) && v >= 0)));
    }
    static extractRawStats(stats) {
        const fgm = stats.field_goals?.total ?? null;
        const fga = stats.field_goals?.attempts ?? null;
        const threePM = stats.threepoint_goals?.total ?? null;
        const threePA = stats.threepoint_goals?.attempts ?? null;
        const ftm = stats.freethrows_goals?.total ?? null;
        const fta = stats.freethrows_goals?.attempts ?? null;
        const twoPM = fgm === null ? null : Math.max(0, fgm - (threePM ?? 0));
        const twoPA = fga === null ? null : Math.max(0, fga - (threePA ?? 0));
        const secondsOnCourt = stats.minutes ? parseMinutesToSeconds(stats.minutes) : null;
        return {
            basketball_ftm: ftm,
            basketball_fta: fta,
            basketball_2pm: twoPM,
            basketball_2pa: twoPA,
            basketball_3pm: threePM,
            basketball_3pa: threePA,
            basketball_3p_percentage: threePA !== null && threePA > 0 && threePM !== null ? threePM / threePA : null,
            basketball_assists: stats.assists ?? null,
            basketball_rebounds: stats.rebounds?.total ?? null,
            basketball_points: stats.points ?? null,
            basketball_minutes: secondsOnCourt !== null ? Math.round(secondsOnCourt / 60) : null,
            basketball_plus_minus: stats.plus_minus ?? null,
        };
    }
    static normalizeHistoricalStatic(currentValue, historicalValues) {
        const epsilon = 1e-6;
        if (historicalValues.length < 2 || currentValue <= 0)
            return null;
        const positiveHistorical = historicalValues.filter((v) => v > 0);
        if (positiveHistorical.length < 2)
            return null;
        const logHistorical = positiveHistorical.map((v) => Math.log(1 + v + epsilon));
        const medianLog = median(logHistorical);
        const stdDevLog = standardDeviation(logHistorical);
        if (stdDevLog === 0 || stdDevLog === null)
            return null;
        const logCurrent = Math.log(1 + currentValue + epsilon);
        const x = 0.5 + ((logCurrent - medianLog) / stdDevLog) * 0.25;
        return Math.max(0, Math.min(1, x));
    }
}
//# sourceMappingURL=training_load.js.map