import SportActivity from '#models_pg/sport_activity';
import { decodeJsonPayload, standardDeviation, median } from '../utils/statistics.js';
import { FLOAT_PRECISION_SERIE_TYPES, SERIE_TYPE } from '#constants/serie.constants';
import { EXERCISE_DIFFICULTY_TO_INTENSITY_COEFFICIENT, EXERCISE_TYPE, } from '#constants/workout.constants';
import { getMilitaryActivityType } from '../utils/military.js';
import { CombatTrainingLoad } from '../utils/training_loads/military/combat.js';
import { DynamicShootingTrainingLoad } from '../utils/training_loads/military/dynamic_shooting.js';
import { StaticShootingTrainingLoad } from '../utils/training_loads/military/static_shooting.js';
import { BasketballTrainingLoad } from '../utils/training_loads/basketball/training_load.js';
import Event from '#models_pg/event';
import ActivityDisplayVariable from '#models_pg/activity_display_variable';
import { resolveActivityDisplayVariables } from '../utils/get_activity_variable.js';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { SubjectiveScaleValuesService } from '#services/subjective_scale_values_service';
import { parsedPointSeries } from '#utils/series';
export class SportActivityService {
    periodMetricService = new MetricService(MetricDomain.PERIOD);
    subjectiveScaleValuesService = new SubjectiveScaleValuesService();
    REP_COEFFICIENTS = {
        1: 1.0,
        2: 1.05,
        3: 1.08,
        4: 1.11,
        5: 1.15,
        6: 1.18,
        7: 1.22,
        8: 1.25,
        9: 1.29,
        10: 1.33,
    };
    weights = {
        rpe_muscular: 0.3,
        rpe_cardio: 0.3,
        rpe_pleasure: 0.3,
        fatigue: 0.1,
    };
    HEART_RATE_BPM_MIN = 25;
    HEART_RATE_BPM_MAX = 240;
    async calculateTrainingLoad(activityId, update) {
        const activity = await SportActivity.query()
            .where('id', activityId)
            .preload('exerciseSets', (query) => {
            query.preload('exercise');
        })
            .preload('sport')
            .preload('day', (query) => {
            query.preload('athlete');
        })
            .preload('periods', (query) => {
            query
                .preload('series')
                .preload('metricValues', (metricValuesQuery) => metricValuesQuery.preload('metric'));
        })
            .first();
        if (!activity || !activity.day?.dateOfDay) {
            throw new Error('Activity not found');
        }
        const activitiesLast30Days = await SportActivity.query()
            .whereHas('day', (query) => {
            if (!activity.day.dateOfDay) {
                return false;
            }
            query
                .where('athleteId', activity.day.athleteId)
                .where('dateOfDay', '>=', activity.day.dateOfDay.minus({ days: 30 }).toJSDate())
                .where('dateOfDay', '<=', activity.day.dateOfDay.toJSDate());
        })
            .preload('sport');
        const { rpe, muscularDifficulty, cardioRespiratory, pleasureLevel, fatigueLevel, durationSeconds, exerciseSets, } = activity;
        const { strain } = activity.periods?.[0]
            ? this.periodMetricService.extractNumericMetricsAsObject(activity.periods[0], ['strain'])
            : { strain: null };
        const heartRateSeries = activity.periods
            ?.flatMap((period) => period.series ?? [])
            .find((serie) => serie.type === SERIE_TYPE.HEART_RATE)?.dataEncoded ?? null;
        let internalTrainingLoad = null;
        let resistanceTrainingLoad = null;
        const durationMinutes = durationSeconds ? Math.round(durationSeconds / 60) : 0;
        const isAllExercise = (exerciseSets?.length ?? 0) > 0;
        const availableComponents = {};
        if (muscularDifficulty !== null) {
            availableComponents['rpe_muscular'] = this.weights.rpe_muscular;
        }
        if (cardioRespiratory !== null) {
            availableComponents['rpe_cardio'] = this.weights.rpe_cardio;
        }
        if (rpe !== null || pleasureLevel !== null) {
            availableComponents['rpe_pleasure'] = this.weights.rpe_pleasure;
        }
        if (fatigueLevel !== null) {
            availableComponents['fatigue'] = this.weights.fatigue;
        }
        const totalWeight = Object.values(availableComponents).reduce((sum, weight) => sum + weight, 0);
        const normalizedWeights = {};
        for (const [key, weight] of Object.entries(availableComponents)) {
            normalizedWeights[key] = weight / totalWeight;
        }
        let rpePleasureValue = 0;
        if (rpe !== null && pleasureLevel !== null) {
            rpePleasureValue = (rpe - pleasureLevel + 11) / 2;
        }
        else if (rpe !== null && pleasureLevel === null) {
            rpePleasureValue = rpe;
        }
        else if (rpe === null && pleasureLevel !== null) {
            rpePleasureValue = (11 - pleasureLevel) / 2;
        }
        const rpeComponent = (normalizedWeights['rpe_muscular'] || 0) * (muscularDifficulty || 0) +
            (normalizedWeights['rpe_cardio'] || 0) * (cardioRespiratory || 0) +
            (normalizedWeights['rpe_pleasure'] || 0) * rpePleasureValue +
            (normalizedWeights['fatigue'] || 0) * (fatigueLevel || 0);
        const strainComponent = strain ? (strain * 10) / 21 : 0;
        let totalComponents = 0;
        let totalWeights = 0;
        if (rpeComponent > 0) {
            totalComponents += rpeComponent * 0.4;
            totalWeights += 0.4;
        }
        if (strainComponent > 0) {
            totalComponents += strainComponent * 0.6;
            totalWeights += 0.6;
        }
        if (heartRateSeries) {
            const tlhrv = this.calculateHeartRateVariabilityLoad(heartRateSeries, durationMinutes);
            if (tlhrv !== null) {
                totalComponents += tlhrv * 0.6;
                totalWeights += 0.6;
            }
        }
        const externalTrainingLoad = await this.calculateExternalTrainingLoad(activity, activitiesLast30Days);
        internalTrainingLoad = totalWeights > 0 ? 10 * (totalComponents / totalWeights) : null;
        if (isAllExercise) {
            resistanceTrainingLoad = Math.min(this.calculateResistanceTrainingLoad(exerciseSets, activity.day.athlete.weightKg ?? 0), 100);
            if (resistanceTrainingLoad > 0) {
                if (internalTrainingLoad !== null && internalTrainingLoad > 0) {
                    internalTrainingLoad = 0.5 * internalTrainingLoad + 0.5 * resistanceTrainingLoad;
                }
                else {
                    internalTrainingLoad = resistanceTrainingLoad;
                }
            }
        }
        const trainingLoad = this.getFinalTrainingLoad(internalTrainingLoad, externalTrainingLoad || null);
        const dbTrainingLoad = trainingLoad !== null ? Math.round(Math.max(Math.min(trainingLoad, 100), 0)) : null;
        if (update) {
            await SportActivity.query().where('id', activityId).update({ trainingLoad: dbTrainingLoad });
        }
        return dbTrainingLoad;
    }
    async computeBasketballExternalLoad(activityId, options) {
        let historicalActivities = options?.historicalActivities;
        if (options?.useHistorical && !historicalActivities) {
            const tempActivity = await SportActivity.query()
                .where('id', activityId)
                .preload('day')
                .first();
            if (tempActivity) {
                historicalActivities = await SportActivity.query()
                    .whereHas('day', (q) => q.where('athleteId', tempActivity.day.athleteId))
                    .where('dataSource', 'api_basket')
                    .where('gameActivity', true)
                    .where('id', '!=', activityId)
                    .preload('periods', (q) => q.preload('metricValues', (q) => q.preload('metric')))
                    .orderBy('createdAt', 'desc');
            }
        }
        const activity = await SportActivity.query()
            .where('id', activityId)
            .preload('day', (q) => q.preload('athlete', (a) => a.preload('playerPosition')))
            .preload('periods', (q) => q.preload('metricValues', (q) => q.preload('metric')))
            .first();
        if (!activity?.periods?.length)
            return null;
        if (activity.dataSource !== 'api_basket')
            return null;
        if (activity.durationSeconds === null || activity.durationSeconds === 0) {
            return null;
        }
        let normalizedPrimaryMetric = null;
        let normalizedSecondaryMetric = null;
        if (options?.useHistorical && historicalActivities?.length) {
            const period = activity.periods[0];
            const rawMetrics = BasketballTrainingLoad.extractRawMetricsFromPeriodStatic(period);
            const positionName = options?.positionName ||
                activity.day?.athlete?.playerPosition?.name ||
                BasketballTrainingLoad.DEFAULT_POSITION;
            const calculatedMetrics = BasketballTrainingLoad.calculatePositionMetrics(positionName, rawMetrics);
            const config = BasketballTrainingLoad.getTrainingLoadConfigStatic(positionName);
            if (config) {
                const primaryMetric = calculatedMetrics[config.metric1] ?? 0;
                const secondaryMetric = calculatedMetrics[config.metric2] ?? 0;
                const [historical1, historical2] = await Promise.all([
                    BasketballTrainingLoad.getHistoricalMetricValuesStatic(config.metric1, historicalActivities, period.id, period.providerId ?? undefined),
                    BasketballTrainingLoad.getHistoricalMetricValuesStatic(config.metric2, historicalActivities, period.id, period.providerId ?? undefined),
                ]);
                normalizedPrimaryMetric = BasketballTrainingLoad.normalizeHistoricalStatic(primaryMetric, historical1);
                normalizedSecondaryMetric = BasketballTrainingLoad.normalizeHistoricalStatic(secondaryMetric, historical2);
            }
        }
        const basketballTrainingLoad = new BasketballTrainingLoad(activity, {
            positionName: options?.positionName,
            normalizedPrimaryMetric,
            normalizedSecondaryMetric,
        });
        const externalLoad = basketballTrainingLoad.calculateExternalTrainingLoad();
        if (options?.updateTrainingLoad) {
            await this.calculateTrainingLoad(activityId, true);
        }
        return externalLoad;
    }
    getFinalTrainingLoad(trainingLoad, externalTrainingLoad) {
        if (trainingLoad !== null && trainingLoad > 0 && externalTrainingLoad !== null) {
            return 0.5 * trainingLoad + 0.5 * externalTrainingLoad;
        }
        else if (trainingLoad !== null && trainingLoad > 0) {
            return trainingLoad;
        }
        else if (externalTrainingLoad !== null) {
            return externalTrainingLoad;
        }
        else {
            return null;
        }
    }
    async calculateExternalTrainingLoad(activity, activitiesLast30Days) {
        if (activity.dataSource === 'api_basket') {
            return await this.computeBasketballExternalLoad(activity.id);
        }
        const epsilon = 1e-6;
        const activityName = activity.sport?.name || 'Unknown';
        if (activityName.toLowerCase().includes('muscu')) {
            return 0;
        }
        const militaryActivity = getMilitaryActivityType(activityName);
        if (militaryActivity) {
            switch (militaryActivity) {
                case 'Combat ouvert - configuration légère':
                case 'Combat ouvert - configuration lourde':
                case 'Combat clos - configuration légère':
                case 'Combat clos - configuration lourde':
                case 'Marche avec poids (TAP)':
                case 'Course à pieds avec poids (TAP)':
                    const combatTrainingLoad = new CombatTrainingLoad(activity, militaryActivity);
                    return combatTrainingLoad.calculateExternalTrainingLoad();
                case 'Tir statique - configuration légère':
                case 'Tir statique - configuration lourde':
                    const staticShootingTrainingLoad = new StaticShootingTrainingLoad(activity, militaryActivity);
                    return staticShootingTrainingLoad.calculateExternalTrainingLoad();
                case 'Tir dynamique - configuration légère':
                case 'Tir dynamique - configuration lourde':
                    const dynamicShootingTrainingLoad = new DynamicShootingTrainingLoad(activity, militaryActivity);
                    return dynamicShootingTrainingLoad.calculateExternalTrainingLoad();
            }
        }
        const distance = activity.distance;
        const elevation = activity.elevation;
        const validDistance = distance !== null && distance > 0;
        const validElevation = elevation !== null && elevation >= 0;
        const referenceActivities = activitiesLast30Days.filter((a) => a.sport?.name === activityName && a.id !== activity.id);
        if (referenceActivities.length === 0 || (!validDistance && !validElevation)) {
            return 0;
        }
        const lnDistance = validDistance ? Math.log(1 + distance + epsilon) : null;
        const lnElevation = validElevation ? Math.log(1 + elevation + epsilon) : null;
        let X1 = null;
        let X5 = null;
        if (validDistance) {
            const refDistances = referenceActivities
                .map((a) => a.distance)
                .filter((d) => d !== null && d > 0)
                .map((d) => Math.log(1 + d + epsilon));
            if (refDistances.length > 7) {
                const medianLnDist = median(refDistances);
                const stdLnDist = standardDeviation(refDistances) || epsilon;
                X1 = 0.5 + ((lnDistance - medianLnDist) / stdLnDist) * 0.25;
            }
        }
        if (validElevation) {
            const refElevations = referenceActivities
                .map((a) => a.elevation)
                .filter((e) => e !== null && e > 0)
                .map((e) => Math.log(1 + e + epsilon));
            if (refElevations.length > 7) {
                const medianLnElev = median(refElevations);
                const stdLnElev = standardDeviation(refElevations) || epsilon;
                X5 = 0.5 + ((lnElevation - medianLnElev) / stdLnElev) * 0.25;
            }
        }
        let cexterne;
        if (X1 !== null && X5 !== null && (activityName === 'Trail' || activityName === 'Run')) {
            cexterne = 6.7 * Math.pow(10, X1) + 3.3 * Math.pow(10, X5);
        }
        else if (X1 !== null) {
            cexterne = 10 * Math.pow(10, X1);
        }
        else if (X5 !== null) {
            cexterne = 10 * Math.pow(10, X5);
        }
        else {
            cexterne = 0;
        }
        return Math.round(cexterne * 100) / 100;
    }
    calculateHeartRateVariabilityLoad(heartRateSeries, activityDuration) {
        try {
            const payload = decodeJsonPayload(heartRateSeries);
            const heartRateData = parsedPointSeries(payload.points ?? [], 'hr').map((point) => point.value);
            if (heartRateData.length < 60) {
                return null;
            }
            const pre5 = heartRateData.slice(0, 5 * 12);
            const post15 = heartRateData.slice(-15 * 12);
            const post5 = post15.slice(0, 5 * 12);
            const pre5Std = standardDeviation(pre5);
            const post5Std = standardDeviation(post5);
            const post15Std = standardDeviation(post15);
            const numerator = pre5Std !== null && post5Std !== null ? Math.abs(pre5Std - post5Std) : null;
            const denominator = post15Std !== null && post5Std !== null ? Math.abs(post15Std - post5Std) : null;
            if (denominator === null || denominator === 0 || numerator === null) {
                return null;
            }
            return Math.log((activityDuration * numerator) / denominator + 1);
        }
        catch (error) {
            console.error('Error calculating heart rate variability load:', error);
            return null;
        }
    }
    calculateResistanceTrainingLoad(exerciseSets, bodyweight) {
        let resistanceTrainingLoad = 0;
        const getIntensity = ({ reps, estimatedReps, estimatedDuration, time, exerciseType, difficulty, }) => {
            if (exerciseType === null || exerciseType === EXERCISE_TYPE.WEIGHTED_REPS) {
                return null;
            }
            if (exerciseType === EXERCISE_TYPE.BODYWEIGHT_REPS &&
                estimatedReps !== null &&
                reps !== null) {
                return reps / estimatedReps;
            }
            if (exerciseType === EXERCISE_TYPE.BODYWEIGHT_TIME &&
                estimatedDuration !== null &&
                time !== null &&
                difficulty) {
                return Math.pow(time / estimatedDuration, EXERCISE_DIFFICULTY_TO_INTENSITY_COEFFICIENT[difficulty]);
            }
            return null;
        };
        for (const exerciseSet of exerciseSets) {
            if (exerciseSet.exercise === null ||
                (exerciseSet.weight === null && exerciseSet.exercise.type === EXERCISE_TYPE.WEIGHTED_REPS)) {
                continue;
            }
            if (exerciseSet.exercise.type === EXERCISE_TYPE.WEIGHTED_REPS) {
                const reps = exerciseSet.reps ?? 5;
                const weight = exerciseSet.weight ?? 0;
                const oneRmEq = weight * (36 / (37 - reps));
                const coeff = this.REP_COEFFICIENTS[reps] ?? 1.5;
                const oneRmMax = weight * coeff;
                const gamma = 0.8;
                if (oneRmMax > 0) {
                    resistanceTrainingLoad +=
                        (weight * reps * Math.pow(oneRmEq / oneRmMax, gamma)) / (20 * 10);
                }
            }
            else {
                const reps = EXERCISE_TYPE.BODYWEIGHT_REPS ? exerciseSet.reps : null;
                const weight = bodyweight * ((exerciseSet.exercise.bodyweightPercentage ?? 100) / 100);
                const timeInSeconds = exerciseSet.durationSeconds;
                const intensity = getIntensity({
                    reps,
                    estimatedReps: exerciseSet.exercise.estimatedReps,
                    estimatedDuration: exerciseSet.exercise.estimatedDuration,
                    time: timeInSeconds,
                    exerciseType: exerciseSet.exercise.type,
                    difficulty: exerciseSet.exercise.difficulty,
                });
                if (intensity !== null) {
                    if (exerciseSet.exercise.type === EXERCISE_TYPE.BODYWEIGHT_REPS && reps !== null) {
                        resistanceTrainingLoad += (weight * intensity * reps) / (bodyweight * 10);
                    }
                    else if (exerciseSet.exercise.type === EXERCISE_TYPE.BODYWEIGHT_TIME) {
                        resistanceTrainingLoad += (weight * intensity) / bodyweight;
                    }
                }
            }
        }
        return resistanceTrainingLoad;
    }
    async getFitDataFromSeries(sportActivityId) {
        const heartRatePoints = await this.getTimestampedSeriesPoints(sportActivityId, SERIE_TYPE.HEART_RATE, 'hr');
        const distancePoints = await this.getTimestampedSeriesPoints(sportActivityId, SERIE_TYPE.TOTAL_DISTANCE_IN_METERS, 'distance');
        if (heartRatePoints.length === 0) {
            return [];
        }
        const distanceByTimestamp = new Map(distancePoints.map((point) => [point.ts, point.value]));
        return heartRatePoints.map((point) => ({
            power: 0,
            speed: 0,
            cadence: null,
            distance: distanceByTimestamp.get(point.ts) ?? 0,
            elevation: 0,
            timestamp: point.ts,
            heart_rate: point.value > 0 ? Math.round(point.value) : null,
            watts_calc: 0,
        }));
    }
    async getTimestampedSeriesPoints(sportActivityId, serieType, valueKey) {
        const sportActivity = await SportActivity.query()
            .where('id', sportActivityId)
            .preload('periods', (query) => {
            query.orderBy('startTime', 'asc');
            query.preload('series', (seriesQuery) => {
                seriesQuery.where('type', serieType).orderBy('id', 'asc');
            });
        })
            .first();
        if (!sportActivity || !sportActivity.periods || sportActivity.periods.length === 0) {
            return [];
        }
        const points = [];
        for (const period of sportActivity.periods) {
            const series = period.series ?? [];
            if (series.length === 0)
                continue;
            for (const serie of series) {
                try {
                    const payload = decodeJsonPayload(serie.dataEncoded);
                    const payloadPoints = payload.points;
                    if (!payloadPoints || payloadPoints.length === 0)
                        continue;
                    const parsedPoints = parsedPointSeries(payloadPoints, valueKey, {
                        roundValues: !FLOAT_PRECISION_SERIE_TYPES.has(serieType),
                    });
                    const finalParsedPoints = serieType === SERIE_TYPE.HEART_RATE
                        ? parsedPoints.filter((point) => point.value >= this.HEART_RATE_BPM_MIN && point.value <= this.HEART_RATE_BPM_MAX)
                        : parsedPoints;
                    if (finalParsedPoints.length > 0) {
                        points.push(...finalParsedPoints);
                    }
                }
                catch {
                    continue;
                }
            }
        }
        if (points.length === 0) {
            return [];
        }
        points.sort((a, b) => a.ts - b.ts);
        const firstTimestamp = points[0].ts;
        const normalizedPoints = points.map((point) => ({
            ts: Math.max(0, point.ts - firstTimestamp),
            value: point.value,
        }));
        return normalizedPoints;
    }
    async getActivityByTimeOfActivity(athleteId, dateOfDay, timeOfActivity) {
        return SportActivity.query()
            .whereHas('day', (query) => {
            query.where('athleteId', athleteId).where('dateOfDay', dateOfDay);
        })
            .where('timeOfActivity', timeOfActivity)
            .first();
    }
    async getSportActivityById(id) {
        return SportActivity.query().where('id', id).preload('day').firstOrFail();
    }
    async getActivityDetails(id) {
        return SportActivity.query().where('id', id).preload('day').firstOrFail();
    }
    async updateSubjectiveFields(id, payload, activityScales) {
        const patch = Object.fromEntries(payload.map((entry) => [entry.id, entry.value]));
        const activity = await SportActivity.findOrFail(id);
        await this.subjectiveScaleValuesService.applyActivity(activity, activityScales, patch);
        await this.calculateTrainingLoad(activity.id, true);
        return activity;
    }
    async getActivityTypeDisplayVariables(activityTypeId, clubId) {
        const variables = await ActivityDisplayVariable.query()
            .where('activityId', activityTypeId)
            .where((query) => {
            query.whereNull('clubId');
            if (clubId) {
                query.orWhere('clubId', clubId);
            }
        })
            .preload('displayVariable');
        return resolveActivityDisplayVariables(variables, clubId);
    }
    async ohPutainJeSaisPasCommentAppelerLaFonction({ dateTime, activityId, athleteId, }) {
        const event = await Event.query()
            .where('startTime', '>=', dateTime.startOf('day').toJSDate())
            .where('endTime', '<=', dateTime.endOf('day').toJSDate())
            .whereHas('eventType', (query) => {
            query.where('activityId', activityId);
        })
            .whereHas('sportActivities', (query) => {
            query.where('dataSource', 'manual');
        })
            .whereHas('athletes', (query) => {
            query.where('athletes.id', athleteId);
        })
            .orderBy('startTime', 'asc')
            .preload('sportActivities', (query) => {
            query
                .where('dataSource', 'manual')
                .whereHas('day', (query) => {
                query.where('athleteId', athleteId);
            })
                .preload('periods', (periodsQuery) => {
                periodsQuery.preload('metricValues', (metricValuesQuery) => {
                    metricValuesQuery.preload('metric');
                });
            });
        })
            .first();
        if (!event || event.sportActivities.length === 0) {
            return null;
        }
        return event.sportActivities[0];
    }
}
//# sourceMappingURL=sport_activity_service.js.map