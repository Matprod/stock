import { DateTime } from 'luxon';
import axios from 'axios';
import env from '#start/env';
import Day from '#models_pg/day';
import Athlete from '#models_pg/athlete';
import SportActivity from '#models_pg/sport_activity';
import FeatureImportance from '#models_pg/feature_importance';
import Insight from '#models_pg/insight';
import { MetricService } from '#services/metric_service';
import { MetricDomain } from '#contracts/metric';
import InjuryHistoryService from './injury_history_service.js';
import InjuryTrainingLoadMetricsService from './injury_training_load_metrics_service.js';
import AthleteService from '#services/athlete_service';
import Injury from '#models_pg/injury';
import { shouldExcludeDateFromPrediction } from '../../../utils/injury.js';
import HealthRating from '#models_pg/health_rating';
import Sleep from '#models_pg/sleep';
import BodymetricsHistory from '#models_pg/bodymetrics_history';
export default class InjuryPredictionService {
    injuryHistoryService;
    injuryTrainingLoadMetricsService;
    dayMetricService;
    injuryPredictionBaseUrl = env.get('MACHINE_LEARNING_INJURY_PREDICTION_URL');
    athleteService;
    constructor() {
        this.injuryHistoryService = new InjuryHistoryService();
        this.injuryTrainingLoadMetricsService = new InjuryTrainingLoadMetricsService();
        this.dayMetricService = new MetricService(MetricDomain.DAY);
        this.athleteService = new AthleteService();
    }
    getSeasonForDate(athlete, date) {
        if (!athlete.club?.seasons || !date) {
            return null;
        }
        const season = athlete.club.seasons.find((s) => date.toJSDate() >= s.startDate && date.toJSDate() <= s.endDate);
        return season?.name || null;
    }
    async predictInjuryRisk(payload) {
        const token = env.get('MACHINE_LEARNING_API_TOKEN');
        try {
            const response = await axios.post(this.injuryPredictionBaseUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error predicting injury risk:', error);
            throw error;
        }
    }
    async preparePredictionDataForDays(athleteId, startDate, endDate) {
        const allInjuries = await Injury.query()
            .where('athleteId', athleteId)
            .whereNotNull('dateOfInjury')
            .orderBy('dateOfInjury', 'desc');
        const athlete = await Athlete.query()
            .where('id', athleteId)
            .preload('playerPosition')
            .preload('club', (clubQuery) => {
            clubQuery.preload('seasons', (seasonsQuery) => {
                seasonsQuery.orderBy('startDate', 'desc');
            });
        })
            .first();
        if (!athlete) {
            return { data: [] };
        }
        const dates = [];
        let currentDate = startDate;
        while (currentDate <= endDate) {
            dates.push(currentDate);
            currentDate = currentDate.plus({ days: 1 });
        }
        const allDaysInRange = await Day.query()
            .where('athleteId', athleteId)
            .whereBetween('dateOfDay', [startDate.toJSDate(), endDate.toJSDate()])
            .preload('health')
            .preload('sleeps')
            .preload('bodymetricsHistories')
            .preload('athlete')
            .preload('metricValues', (query) => {
            query.preload('metric');
        })
            .preload('sportActivities', (activityQuery) => {
            activityQuery.preload('periods', (periodQuery) => {
                periodQuery.preload('metricValues', (metricQuery) => {
                    metricQuery.preload('metric');
                });
            });
        })
            .orderBy('dateOfDay', 'asc');
        const daysMap = new Map();
        for (const day of allDaysInRange) {
            if (day.dateOfDay) {
                const dateKey = day.dateOfDay.toFormat('yyyy-MM-dd');
                daysMap.set(dateKey, day);
            }
        }
        const earliestDate = startDate.minus({ days: 28 });
        const allDaysForMetrics = await Day.query()
            .where('athleteId', athleteId)
            .whereBetween('dateOfDay', [earliestDate.toJSDate(), endDate.toJSDate()])
            .preload('metricValues', (query) => {
            query.preload('metric');
        })
            .preload('health')
            .preload('sleeps')
            .preload('bodymetricsHistories')
            .preload('athlete')
            .orderBy('dateOfDay', 'asc');
        const allActivities = await SportActivity.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .whereBetween('dateOfDay', [earliestDate.toJSDate(), endDate.toJSDate()]);
        })
            .preload('periods', (periodQuery) => {
            periodQuery.preload('metricValues', (metricQuery) => {
                metricQuery.preload('metric');
            });
        })
            .preload('day');
        let latestEnergy = await HealthRating.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', '<', startDate.toJSDate())
                .orderBy('dateOfDay', 'desc');
        })
            .first();
        let latestEnergyRating = latestEnergy?.energyRating ?? null;
        let latestSleepQuality = await Sleep.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', '<', startDate.toJSDate())
                .orderBy('dateOfDay', 'desc');
        })
            .first();
        let latestSleepQualityRating = latestSleepQuality?.qualityRating ?? null;
        let latestBodySoreness = await HealthRating.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', '<', startDate.toJSDate())
                .orderBy('dateOfDay', 'desc');
        })
            .first();
        let latestBodySorenessRating = latestBodySoreness?.bodySorenessRating ?? null;
        let latestBodyWeight = await BodymetricsHistory.query()
            .whereHas('day', (query) => {
            query
                .where('athleteId', athleteId)
                .where('dateOfDay', '<', startDate.toJSDate())
                .orderBy('dateOfDay', 'desc');
        })
            .first();
        let latestBodyWeightRating = latestBodyWeight?.weight ?? null;
        const playerPosition = athlete.playerPosition?.name || '';
        const allData = [];
        for (const dateOfDay of dates) {
            if (shouldExcludeDateFromPrediction(allInjuries, dateOfDay)) {
                continue;
            }
            const day = daysMap.get(dateOfDay.toFormat('yyyy-MM-dd'));
            const season = this.getSeasonForDate(athlete, dateOfDay);
            if (!season) {
                console.log(`No season found for date ${dateOfDay.toFormat('yyyy-MM-dd')}`);
                continue;
            }
            const injuryHistory = await this.injuryHistoryService.calculateInjuryHistoryVariables(athleteId, dateOfDay, season);
            const trainingLoadMetrics = await this.injuryTrainingLoadMetricsService.calculateTrainingLoadMetrics(athleteId, dateOfDay, allDaysForMetrics, allActivities, allInjuries);
            const currentTLMetrics = day
                ? this.dayMetricService.extractNumericMetrics(day, [
                    'TL_volume_F1',
                    'TL_volume_F2',
                    'TL_HI_F1',
                    'TL_HI_F2',
                    'TL_HI_F3',
                    'TL_NM_F1',
                    'TL_NM_F2',
                ])
                : new Map();
            const { energy, sleepQuality, bodySoreness, bodyWeight } = this.getMostRecentSubjectiveMetrics(day, allDaysForMetrics, dateOfDay);
            if (energy !== null) {
                latestEnergyRating = energy;
            }
            if (sleepQuality !== null) {
                latestSleepQualityRating = sleepQuality;
            }
            if (bodySoreness !== null) {
                latestBodySorenessRating = bodySoreness;
            }
            if (bodyWeight !== null) {
                latestBodyWeightRating = bodyWeight;
            }
            if (latestEnergyRating === null ||
                latestSleepQualityRating === null ||
                latestBodySorenessRating === null ||
                latestBodyWeightRating === null) {
                console.log(`Skipping day ${dateOfDay.toFormat('yyyy-MM-dd')} because of missing subjective metrics`);
                continue;
            }
            const data = {
                'username_lastname': athlete.name.replace(/\s+/g, ' ').trim(),
                'season': season,
                'date_of_day': dateOfDay.toFormat('yyyy-MM-dd'),
                'player_id': String(athleteId),
                'player_position': playerPosition,
                'age': athlete.birthDate ? Math.floor(dateOfDay.diff(athlete.birthDate, 'years').years) : 0,
                'Energy': latestEnergyRating,
                'EWMA_7d_Energy': trainingLoadMetrics.EWMA_7d_Energy,
                'Sleep quality': latestSleepQualityRating,
                'EWMA_7d_Sleep quality': trainingLoadMetrics.EWMA_7d_Sleep_quality,
                'Body Soreness': latestBodySorenessRating,
                'EWMA_7d_Body Soreness': trainingLoadMetrics.EWMA_7d_Body_Soreness,
                'Body Weight': latestBodyWeightRating,
                'TL_volume_F1': currentTLMetrics.get('TL_volume_F1') ?? 0,
                'TL_volume_F2': currentTLMetrics.get('TL_volume_F2') ?? 0,
                'EWMA_7d_TL_volume_F1': trainingLoadMetrics.EWMA_7d_TL_volume_F1,
                'EWMA_7d_TL_volume_F2': trainingLoadMetrics.EWMA_7d_TL_volume_F2,
                'EWMA_28d_TL_volume_F1': trainingLoadMetrics.EWMA_28d_TL_volume_F1,
                'EWMA_28d_TL_volume_F2': trainingLoadMetrics.EWMA_28d_TL_volume_F2,
                'ACWR_exp_TL_volume_F1': trainingLoadMetrics.ACWR_exp_TL_volume_F1,
                'ACWR_exp_TL_volume_F2': trainingLoadMetrics.ACWR_exp_TL_volume_F2,
                'monotony_TL_volume_F1': trainingLoadMetrics.monotony_TL_volume_F1,
                'monotony_TL_volume_F2': trainingLoadMetrics.monotony_TL_volume_F2,
                'strain_TL_volume_F1': trainingLoadMetrics.strain_TL_volume_F1,
                'strain_TL_volume_F2': trainingLoadMetrics.strain_TL_volume_F2,
                'spike_TL_volume_F1': trainingLoadMetrics.spike_TL_volume_F1,
                'spike_TL_volume_F2': trainingLoadMetrics.spike_TL_volume_F2,
                'TL_HI_F1': currentTLMetrics.get('TL_HI_F1') ?? 0,
                'TL_HI_F2': currentTLMetrics.get('TL_HI_F2') ?? 0,
                'TL_HI_F3': currentTLMetrics.get('TL_HI_F3') ?? 0,
                'EWMA_7d_TL_HI_F1': trainingLoadMetrics.EWMA_7d_TL_HI_F1,
                'EWMA_7d_TL_HI_F2': trainingLoadMetrics.EWMA_7d_TL_HI_F2,
                'EWMA_7d_TL_HI_F3': trainingLoadMetrics.EWMA_7d_TL_HI_F3,
                'EWMA_28d_TL_HI_F1': trainingLoadMetrics.EWMA_28d_TL_HI_F1,
                'EWMA_28d_TL_HI_F2': trainingLoadMetrics.EWMA_28d_TL_HI_F2,
                'EWMA_28d_TL_HI_F3': trainingLoadMetrics.EWMA_28d_TL_HI_F3,
                'ACWR_exp_TL_HI_F1': trainingLoadMetrics.ACWR_exp_TL_HI_F1,
                'ACWR_exp_TL_HI_F2': trainingLoadMetrics.ACWR_exp_TL_HI_F2,
                'ACWR_exp_TL_HI_F3': trainingLoadMetrics.ACWR_exp_TL_HI_F3,
                'monotony_TL_HI_F1': trainingLoadMetrics.monotony_TL_HI_F1,
                'monotony_TL_HI_F2': trainingLoadMetrics.monotony_TL_HI_F2,
                'strain_TL_HI_F1': trainingLoadMetrics.strain_TL_HI_F1,
                'strain_TL_HI_F2': trainingLoadMetrics.strain_TL_HI_F2,
                'spike_TL_HI_F1': trainingLoadMetrics.spike_TL_HI_F1,
                'spike_TL_HI_F2': trainingLoadMetrics.spike_TL_HI_F2,
                'spike_TL_HI_F3': trainingLoadMetrics.spike_TL_HI_F3,
                'TL_NM_F1': currentTLMetrics.get('TL_NM_F1') ?? 0,
                'TL_NM_F2': currentTLMetrics.get('TL_NM_F2') ?? 0,
                'EWMA_7d_TL_NM_F1': trainingLoadMetrics.EWMA_7d_TL_NM_F1,
                'EWMA_7d_TL_NM_F2': trainingLoadMetrics.EWMA_7d_TL_NM_F2,
                'EWMA_28d_TL_NM_F1': trainingLoadMetrics.EWMA_28d_TL_NM_F1,
                'EWMA_28d_TL_NM_F2': trainingLoadMetrics.EWMA_28d_TL_NM_F2,
                'ACWR_exp_TL_NM_F1': trainingLoadMetrics.ACWR_exp_TL_NM_F1,
                'ACWR_exp_TL_NM_F2': trainingLoadMetrics.ACWR_exp_TL_NM_F2,
                'monotony_TL_NM_F1': trainingLoadMetrics.monotony_TL_NM_F1,
                'monotony_TL_NM_F2': trainingLoadMetrics.monotony_TL_NM_F2,
                'strain_TL_NM_F1': trainingLoadMetrics.strain_TL_NM_F1,
                'strain_TL_NM_F2': trainingLoadMetrics.strain_TL_NM_F2,
                'spike_TL_NM_F1': trainingLoadMetrics.spike_TL_NM_F1,
                'spike_TL_NM_F2': trainingLoadMetrics.spike_TL_NM_F2,
                'std_7d_TL_HI_F3': trainingLoadMetrics.std_7d_TL_HI_F3,
                'std_7d_fmp_dynamic_high_duration_ratio': trainingLoadMetrics.std_7d_fmp_dynamic_high_duration_ratio,
                'monotony_fmp_dynamic_high_duration_ratio': trainingLoadMetrics.monotony_fmp_dynamic_high_duration_ratio,
                'rhie_max_effort_count': trainingLoadMetrics.rhie_max_effort_count,
                'games_last_7d': trainingLoadMetrics.games_last_7d,
                'sessions_last_7d': trainingLoadMetrics.sessions_last_7d,
                'match_minutes_last_7d': trainingLoadMetrics.match_minutes_last_7d,
                'HSR_sessions_last_7d': trainingLoadMetrics.HSR_sessions_last_7d,
                'days_since_last_injury': injuryHistory.days_since_last_injury,
                'frequency_injury_per_season': injuryHistory.frequency_injury_per_season,
                'injury_burden': injuryHistory.injury_burden,
                'count_light_injury_history': injuryHistory.count_light_injury_history,
                'count_medium_injury_history': injuryHistory.count_medium_injury_history,
                'count_serious_injury_history': injuryHistory.count_serious_injury_history,
                'count_very_serious_injury_history': injuryHistory.count_very_serious_injury_history,
                'injury_severe_past_seasons': injuryHistory.injury_severe_past_seasons,
                'injury_very_severe_past_seasons': injuryHistory.injury_very_severe_past_seasons,
            };
            allData.push(data);
        }
        return { data: allData };
    }
    async storePredictionResult(predictionResponse) {
        if (!predictionResponse.result || predictionResponse.result.length === 0) {
            return;
        }
        const insights = await Insight.all();
        const insightMap = new Map();
        for (const insight of insights) {
            insightMap.set(insight.variableName, insight.id);
        }
        const featureImportancesToCreate = new Map();
        for (const result of predictionResponse.result) {
            const athleteId = result.player_id;
            const dateOfDay = DateTime.fromISO(result.date_of_day).plus({ days: 1 });
            if (!athleteId || !dateOfDay.isValid) {
                console.warn(`Skipping result for invalid player_id or date_of_day: ${result.player_id}, ${result.date_of_day}`);
                continue;
            }
            const day = await this.athleteService.getOrCreateDay(athleteId, dateOfDay);
            if (!day) {
                console.warn(`Could not find day for athlete ${athleteId} on ${result.date_of_day}`);
                continue;
            }
            try {
                await day
                    .merge({
                    injuryRiskScore: Math.round(result.injury_risk_proba),
                })
                    .save();
                const featureImportancesForDay = result.feature_importances
                    .map((feature) => {
                    const insightId = insightMap.get(feature.name);
                    if (!insightId) {
                        console.warn(`Could not find insight for feature: ${feature.name}`);
                        return null;
                    }
                    return {
                        dayId: day.id,
                        type: feature.type,
                        contribPct: feature.contrib_pct ?? feature.conrib_pct ?? feature.pct_contrib ?? null,
                        category: 'injury',
                        value: feature.value ?? 0,
                        optimal: feature.optimal,
                        shapValue: feature.shap_value,
                        insightId: insightId,
                    };
                })
                    .filter((item) => item !== null);
                const optimalFeatures = result.optimal_features
                    .map((feature) => {
                    const insightId = insightMap.get(feature.feature);
                    if (!insightId) {
                        console.warn(`Could not find insight for optimal feature: ${feature.feature}`);
                        return null;
                    }
                    let finalValue = feature.value;
                    if (finalValue === null && feature.feature.toLowerCase().includes('std')) {
                        finalValue = 0;
                    }
                    return {
                        dayId: day.id,
                        type: feature.type,
                        contribPct: null,
                        category: 'injury',
                        value: finalValue ?? 1000,
                        optimal: finalValue ?? 1000,
                        shapValue: 0,
                        insightId,
                    };
                })
                    .filter((item) => item !== null);
                featureImportancesToCreate.set(day.id, [
                    ...featureImportancesForDay,
                    ...optimalFeatures,
                ]);
            }
            catch (error) {
                console.error(`Error storing injury prediction results for ${result.player_id} on ${result.date_of_day}:`, error);
            }
        }
        if (featureImportancesToCreate.size > 0) {
            await FeatureImportance.query()
                .whereIn('dayId', Array.from(featureImportancesToCreate.keys()))
                .where('category', 'injury')
                .delete();
            await Promise.all(Array.from(featureImportancesToCreate.keys()).map(async (dayId) => {
                await FeatureImportance.createMany(featureImportancesToCreate.get(dayId) ?? []);
            }));
        }
    }
    getMostRecentSubjectiveMetrics(currentDay, allDays, currentDate) {
        let energy = currentDay?.health?.energyRating ?? null;
        let sleepQuality = currentDay?.sleeps?.[0]?.qualityRating ?? null;
        let bodySoreness = currentDay?.health?.bodySorenessRating ?? null;
        let bodyWeight = null;
        if (currentDay?.bodymetricsHistories && currentDay.bodymetricsHistories.length > 0) {
            bodyWeight = currentDay.bodymetricsHistories[0].weight ?? null;
        }
        if (bodyWeight === null && currentDay?.athlete?.weightKg) {
            bodyWeight = currentDay.athlete.weightKg;
        }
        if (energy === null || sleepQuality === null || bodySoreness === null || bodyWeight === null) {
            const sortedDays = [...allDays]
                .filter((d) => d.dateOfDay && d.dateOfDay <= currentDate)
                .sort((a, b) => {
                const dateA = a.dateOfDay?.toMillis() ?? 0;
                const dateB = b.dateOfDay?.toMillis() ?? 0;
                return dateB - dateA;
            });
            for (const day of sortedDays) {
                if (energy === null &&
                    day.health?.energyRating !== null &&
                    day.health?.energyRating !== undefined) {
                    energy = day.health.energyRating;
                }
                if (sleepQuality === null &&
                    day.sleeps?.[0]?.qualityRating !== null &&
                    day.sleeps?.[0]?.qualityRating !== undefined) {
                    sleepQuality = day.sleeps[0].qualityRating;
                }
                if (bodySoreness === null &&
                    day.health?.bodySorenessRating !== null &&
                    day.health?.bodySorenessRating !== undefined) {
                    bodySoreness = day.health.bodySorenessRating;
                }
                if (bodyWeight === null) {
                    if (day.bodymetricsHistories && day.bodymetricsHistories.length > 0) {
                        const weight = day.bodymetricsHistories[0].weight;
                        if (weight !== null && weight !== undefined) {
                            bodyWeight = weight;
                        }
                    }
                    if (bodyWeight === null && day.athlete?.weightKg) {
                        bodyWeight = day.athlete.weightKg;
                    }
                }
                if (energy !== null &&
                    sleepQuality !== null &&
                    bodySoreness !== null &&
                    bodyWeight !== null) {
                    break;
                }
            }
        }
        return {
            energy,
            sleepQuality,
            bodySoreness,
            bodyWeight,
        };
    }
}
//# sourceMappingURL=injury_prediction_service.js.map