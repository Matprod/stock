import { SERIE_TYPE } from '#constants/serie.constants';
import { decodeSerieValues } from '../../series.js';
import { savitzkyGolay } from '../../statistics.js';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { BaseTrainingLoad } from '../base.js';
const periodMetricService = new MetricService(MetricDomain.PERIOD);
export class DynamicShootingTrainingLoad extends BaseTrainingLoad {
    type;
    constructor(sportActivity, type) {
        super(sportActivity);
        this.type = type;
    }
    getDynamicShootingVariables() {
        const { periods, day: { athlete: { weightKg: athleteWeight }, }, } = this.sportActivity;
        const period = periods?.[0];
        const { weapon_weight: weaponWeight, carried_weight: carriedWeight } = period
            ? periodMetricService.extractNumericMetricsAsObject(period, [
                'weapon_weight',
                'carried_weight',
            ])
            : { weapon_weight: null, carried_weight: null };
        if (!periods || periods.length === 0 || !periods[0].series) {
            return;
        }
        const series = periods[0].series;
        const elevationSerie = series.find((s) => s.type === SERIE_TYPE.ELEVATION_IN_METERS);
        const distanceSerie = series.find((s) => s.type === SERIE_TYPE.TOTAL_DISTANCE_IN_METERS);
        if (!elevationSerie || !distanceSerie) {
            return;
        }
        const decodedElevationSerie = decodeSerieValues(elevationSerie.dataEncoded, SERIE_TYPE.ELEVATION_IN_METERS);
        const decodedDistanceSerie = decodeSerieValues(distanceSerie.dataEncoded, SERIE_TYPE.TOTAL_DISTANCE_IN_METERS);
        const smoothedElevation = savitzkyGolay(decodedElevationSerie, 11, 3);
        const smoothedDistance = savitzkyGolay(decodedDistanceSerie, 11, 3);
        const massTotal = (athleteWeight ?? 0) + (weaponWeight ?? 0) + (carriedWeight ?? 0);
        const massRatio = athleteWeight ? massTotal / athleteWeight : 0;
        const loadPercentage = athleteWeight ? (carriedWeight ?? 0) / athleteWeight : 0;
        let beta;
        if (loadPercentage > 0.3) {
            beta = 1.0;
        }
        else if (this.type === 'Tir dynamique - configuration lourde') {
            beta = 0.9;
        }
        else {
            beta = 0.7;
        }
        let massWeightedEffectiveDistance = 0;
        for (let i = 1; i < smoothedDistance.length; i++) {
            const deltaD = smoothedDistance[i] - smoothedDistance[i - 1];
            const deltaH = smoothedElevation[i] - smoothedElevation[i - 1];
            const gradient = deltaD !== 0 ? deltaH / deltaD : 0;
            const effectiveDistanceSegment = deltaD * Math.sqrt(1 + gradient ** 2);
            massWeightedEffectiveDistance += effectiveDistanceSegment * Math.pow(massRatio, beta);
        }
        const g = 9.81;
        let positiveElevationGain = 0;
        for (let i = 1; i < smoothedElevation.length; i++) {
            const deltaH = smoothedElevation[i] - smoothedElevation[i - 1];
            if (deltaH > 0)
                positiveElevationGain += deltaH;
        }
        const verticalWork = massTotal * g * positiveElevationGain;
        return {
            massWeightedEffectiveDistance,
            verticalWork,
        };
    }
    calculateExternalTrainingLoad() {
        const variables = this.getDynamicShootingVariables();
        if (!variables) {
            return 0;
        }
        const { massWeightedEffectiveDistance, verticalWork } = variables;
        switch (this.type) {
            case 'Tir dynamique - configuration légère':
                return this.calculateDynamicShootingLight({
                    massWeightedEffectiveDistance,
                    verticalWork,
                });
            case 'Tir dynamique - configuration lourde':
                return this.calculateDynamicShootingHeavy({
                    massWeightedEffectiveDistance,
                    verticalWork,
                });
            default:
                throw new Error(`Invalid dynamic shooting type: ${this.type}`);
        }
    }
    calculateDynamicShootingLight({ massWeightedEffectiveDistance, verticalWork, }) {
        return (6 * massWeightedEffectiveDistance + 4 * verticalWork) / 10;
    }
    calculateDynamicShootingHeavy({ massWeightedEffectiveDistance, verticalWork, }) {
        return (6 * massWeightedEffectiveDistance + 4 * verticalWork) / 10;
    }
}
//# sourceMappingURL=dynamic_shooting.js.map