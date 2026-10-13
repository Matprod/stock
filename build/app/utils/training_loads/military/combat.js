import { SERIE_TYPE } from '#constants/serie.constants';
import { decodeSerieValues } from '../../series.js';
import { savitzkyGolay } from '../../statistics.js';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { BaseTrainingLoad } from '../base.js';
const periodMetricService = new MetricService(MetricDomain.PERIOD);
export class CombatTrainingLoad extends BaseTrainingLoad {
    type;
    constructor(sportActivity, type) {
        super(sportActivity);
        this.type = type;
    }
    getCombatVariables() {
        const { periods, day: { athlete: { weightKg: athleteWeight }, }, } = this.sportActivity;
        const period = periods?.[0];
        const { weapon_weight: weaponWeight, carried_weight: carriedWeight, burst_count: burstCount, } = period
            ? periodMetricService.extractNumericMetricsAsObject(period, [
                'weapon_weight',
                'carried_weight',
                'burst_count',
            ])
            : { weapon_weight: null, carried_weight: null, burst_count: null };
        if (!periods || periods.length === 0 || !periods[0].series) {
            return;
        }
        const series = periods[0].series;
        const speedMetersPerSecondSerie = series.find((s) => s.type === SERIE_TYPE.SPEED_METERS_PER_SECOND);
        const elevationSerie = series.find((s) => s.type === SERIE_TYPE.ELEVATION_IN_METERS);
        const distanceSerie = series.find((s) => s.type === SERIE_TYPE.TOTAL_DISTANCE_IN_METERS);
        if (!speedMetersPerSecondSerie || !elevationSerie || !distanceSerie) {
            return;
        }
        const decodedSpeedSerie = decodeSerieValues(speedMetersPerSecondSerie.dataEncoded, SERIE_TYPE.SPEED_METERS_PER_SECOND);
        const decodedElevationSerie = decodeSerieValues(elevationSerie.dataEncoded, SERIE_TYPE.ELEVATION_IN_METERS);
        const decodedDistanceSerie = decodeSerieValues(distanceSerie.dataEncoded, SERIE_TYPE.TOTAL_DISTANCE_IN_METERS);
        const deltaT = 1;
        const massTotal = (athleteWeight ?? 0) + (weaponWeight ?? 0) + (carriedWeight ?? 0);
        const g = 9.81;
        const beta = 0.8;
        const smoothedSpeed = savitzkyGolay(decodedSpeedSerie, 11, 3);
        const smoothedElevation = savitzkyGolay(decodedElevationSerie, 11, 3);
        const smoothedDistance = savitzkyGolay(decodedDistanceSerie, 11, 3);
        const longitudinalAccelerations = [];
        for (let i = 1; i < smoothedSpeed.length - 1; i++) {
            const acceleration = (smoothedSpeed[i + 1] - smoothedSpeed[i - 1]) / (2 * deltaT);
            longitudinalAccelerations.push(acceleration);
        }
        let totalAbsAcceleration = 0;
        let totalPosAcceleration = 0;
        let totalNegAcceleration = 0;
        for (const accel of longitudinalAccelerations) {
            totalAbsAcceleration += Math.abs(accel) * deltaT;
            if (accel > 0)
                totalPosAcceleration += accel * deltaT;
            else
                totalNegAcceleration += -accel * deltaT;
        }
        const absAccelerations = longitudinalAccelerations.map((a) => Math.abs(a)).sort((a, b) => a - b);
        const p95Index = 0.95 * (absAccelerations.length - 1);
        const lowerIndex = Math.floor(p95Index);
        const upperIndex = Math.ceil(p95Index);
        const weight = p95Index - lowerIndex;
        let aP95 = absAccelerations[lowerIndex] * (1 - weight) + absAccelerations[upperIndex] * weight;
        const windowSec = 1.5;
        const windowSamples = Math.round(windowSec / deltaT);
        const accelThreshold = 1.5;
        const decelThreshold = -1.5;
        let numAccBursts = 0;
        let numDecBursts = 0;
        for (let i = windowSamples; i < smoothedSpeed.length - windowSamples; i++) {
            const deltaV = smoothedSpeed[i + windowSamples] - smoothedSpeed[i - windowSamples];
            if (deltaV >= accelThreshold)
                numAccBursts++;
            if (deltaV <= decelThreshold)
                numDecBursts++;
        }
        let totalStaticTime = 0;
        for (const v of smoothedSpeed)
            if (v < 0.3)
                totalStaticTime += deltaT;
        let numStops = 0;
        for (let i = 1; i < smoothedSpeed.length; i++) {
            if (smoothedSpeed[i - 1] < 0.8 && smoothedSpeed[i] > 1.5)
                numStops++;
        }
        const totalDurationMin = (smoothedSpeed.length * deltaT) / 60;
        const stopsPerMin = numStops / totalDurationMin;
        let effectiveDistance = 0;
        for (let i = 1; i < smoothedDistance.length; i++) {
            const deltaD = smoothedDistance[i] - smoothedDistance[i - 1];
            const deltaH = smoothedElevation[i] - smoothedElevation[i - 1];
            const gradient = deltaD !== 0 ? deltaH / deltaD : 0;
            effectiveDistance += deltaD * Math.sqrt(1 + gradient ** 2);
        }
        let positiveElevationGain = 0;
        for (let i = 1; i < smoothedElevation.length; i++) {
            const deltaH = smoothedElevation[i] - smoothedElevation[i - 1];
            if (deltaH > 0)
                positiveElevationGain += deltaH;
        }
        const verticalWork = massTotal * g * positiveElevationGain;
        const massRatio = athleteWeight ? massTotal / athleteWeight : 0;
        const totalAbsAccelerationWeighted = totalAbsAcceleration * Math.pow(massRatio, beta);
        const numBurstsWeighted = (burstCount ?? 0) * Math.pow(massRatio, beta);
        return {
            effectiveDistance,
            totalAbsAcceleration,
            numBursts: burstCount ?? 0,
            verticalWork,
            stopsPerMin,
            massTotal,
            numBurstsWeighted,
            aP95,
            totalAbsAccelerationWeighted,
            totalStaticTime,
        };
    }
    calculateExternalTrainingLoad() {
        const combatVariables = this.getCombatVariables();
        if (!combatVariables) {
            return 0;
        }
        const { effectiveDistance, totalAbsAcceleration, numBursts, verticalWork, stopsPerMin, massTotal, numBurstsWeighted, aP95, totalAbsAccelerationWeighted, totalStaticTime, } = combatVariables;
        switch (this.type) {
            case 'Combat ouvert - configuration légère':
                return this.calculateOpenCombatLight({
                    effectiveDistance,
                    totalAbsAcceleration,
                    numBursts,
                    verticalWork,
                    stopsPerMin,
                });
            case 'Combat ouvert - configuration lourde':
                return this.calculateOpenCombatHeavy({
                    effectiveDistance,
                    massTotal,
                    verticalWork,
                    numBurstsWeighted,
                    stopsPerMin,
                });
            case 'Combat clos - configuration légère':
                return this.calculateClosedCombatLight({
                    numBursts,
                    aP95,
                    stopsPerMin,
                    effectiveDistance,
                });
            case 'Combat clos - configuration lourde':
                return this.calculateClosedCombatHeavy({
                    totalAbsAccelerationWeighted,
                    numBurstsWeighted,
                    verticalWork,
                    totalStaticTime,
                    effectiveDistance,
                });
            case 'Marche avec poids (TAP)':
                return this.calculateWeightedWalk({
                    verticalWork,
                    effectiveDistance,
                });
            case 'Course à pieds avec poids (TAP)':
                return this.calculateWeightedRun({
                    verticalWork,
                    effectiveDistance,
                    numBurstsWeighted,
                });
            default:
                throw new Error(`Invalid combat type: ${this.type}`);
        }
    }
    calculateOpenCombatLight({ effectiveDistance, totalAbsAcceleration, numBursts, verticalWork, stopsPerMin, }) {
        return ((3 * effectiveDistance +
            3 * totalAbsAcceleration +
            2 * numBursts +
            1.5 * verticalWork +
            0.5 * stopsPerMin) /
            10);
    }
    calculateOpenCombatHeavy({ effectiveDistance, massTotal, verticalWork, numBurstsWeighted, stopsPerMin, }) {
        const alpha = 0.9;
        return ((3 * effectiveDistance * Math.pow(massTotal, alpha) +
            2 * verticalWork +
            3 * numBurstsWeighted +
            1.5 * numBurstsWeighted +
            0.5 * stopsPerMin) /
            10);
    }
    calculateClosedCombatLight({ numBursts, aP95, stopsPerMin, effectiveDistance, }) {
        return (4 * numBursts + 3 * aP95 + 2 * stopsPerMin + 1 * effectiveDistance) / 10;
    }
    calculateClosedCombatHeavy({ totalAbsAccelerationWeighted, numBurstsWeighted, verticalWork, totalStaticTime, effectiveDistance, }) {
        return ((4.25 * totalAbsAccelerationWeighted +
            2.25 * numBurstsWeighted +
            1.75 * verticalWork +
            1.25 * totalStaticTime +
            1.25 * effectiveDistance) /
            10);
    }
    calculateWeightedWalk({ verticalWork, effectiveDistance, }) {
        return (5 * verticalWork + 5 * effectiveDistance) / 10;
    }
    calculateWeightedRun({ verticalWork, effectiveDistance, numBurstsWeighted, }) {
        return (3 * verticalWork + 3 * effectiveDistance + 4 * numBurstsWeighted) / 10;
    }
}
//# sourceMappingURL=combat.js.map