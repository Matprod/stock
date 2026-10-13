import { PriorityService } from './priority_service.js';
import { parseMicrosecondsToDuration, parseSecondsToDuration } from '../utils/time.js';
import NutritionService from './nutrition_service.js';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { GPS_DISTANCE_BAND_LABELS, SPORT_ACTIVITY_PERIOD_METRICS, ZONE_TIME_PERIOD_METRICS, } from '#constants/sport_activity_period_metrics.constants';
import { SUBJECTIVE_VARIABLE_DOMAIN } from '#contracts/subjective_variable';
export default class FeatureFormatterService {
    priorityService;
    nutritionService;
    periodMetricService = new MetricService(MetricDomain.PERIOD);
    constructor() {
        this.priorityService = new PriorityService();
        this.nutritionService = new NutritionService();
    }
    getFinalDataPrompt({ date, athleteString, category, nutritionString, featuresString, insightsString, metricsString, reportString, subjectiveScalesString, }) {
        let finalDataPrompt = `Voici les données de l'athlète pour le ${date} :\n${athleteString}`;
        if (featuresString) {
            if (category === 'injury') {
                finalDataPrompt +=
                    "\nTu vas analyser les données de l'athlète pour réduire le risque de blessure.";
            }
            else {
                finalDataPrompt +=
                    "\nTu vas analyser les données de l'athlète pour améliorer sa performance.";
            }
            finalDataPrompt += `\nVoici les recommandations du modèle de machine learning :\n${featuresString}`;
            if (insightsString) {
                finalDataPrompt += `\nVoici les descriptions des variables :\n${insightsString}`;
            }
        }
        if (nutritionString) {
            finalDataPrompt += `\n\nVoici les données de la nutrition :\n${nutritionString}`;
        }
        if (metricsString) {
            finalDataPrompt += `\n\nVoici les données des métriques :\n${metricsString}`;
        }
        if (reportString) {
            finalDataPrompt += `\n\nVoici le rapport du jour pour la catégorie ${category} :\n${reportString}`;
        }
        if (subjectiveScalesString) {
            finalDataPrompt += `\n\n${subjectiveScalesString}`;
        }
        console.log('\n\n\n\nfinalDataPrompt', finalDataPrompt, '\n\n\n\n');
        return finalDataPrompt;
    }
    generateActivityDetail(label, value, unit, formatter) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const formattedValue = formatter ? formatter(value) : value;
        const unitStr = unit ? ` ${unit}` : '';
        return `\t- ${label} : ${formattedValue}${unitStr}`;
    }
    subjectiveRangeLabel(scale) {
        const name = scale.label || scale.fieldName;
        return `Note subjective (${scale.min}-${scale.max}) ${name}`;
    }
    subjectiveActivityDetailParams(activity, subjectiveScaleById) {
        if (!subjectiveScaleById)
            return [];
        return [...subjectiveScaleById.values()]
            .filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY)
            .map((scale) => {
            const value = activity[scale.fieldName];
            const numericValue = typeof value === 'number' ? value : null;
            return [this.subjectiveRangeLabel(scale), numericValue];
        });
    }
    generateActivityDetails(activity, periods, subjectiveScaleById) {
        const details = [];
        const periodsToUse = periods ?? activity.periods ?? [];
        const metricsMap = new Map();
        for (const period of periodsToUse) {
            const periodMetrics = this.periodMetricService.extractNumericMetricsAsObject(period, SPORT_ACTIVITY_PERIOD_METRICS);
            for (const metricName of SPORT_ACTIVITY_PERIOD_METRICS) {
                const value = periodMetrics[metricName];
                if (value !== null && !metricsMap.has(metricName)) {
                    metricsMap.set(metricName, value);
                }
            }
        }
        const getMetric = (name) => metricsMap.get(name) ?? null;
        const formatDistance = (value) => value.toFixed(2);
        const firstbeatLabels = {
            energy_consumption_carbs: 'Calories consommées en glucides',
            energy_consumption_fats: 'Calories consommées en lipides',
            epoc_final: 'Époc final',
            epoc_peak: 'Époc pic',
            hf_average: 'HF moyen',
            lf_average: 'LF moyen',
            lf_hf_ratio: 'LF/HF ratio',
            rmssd: 'Root Mean Square of Successive Differences on the RR interval series, value that indicates quality of recovery.',
            trimp: 'Training impulse',
        };
        const detailsParams = [
            [
                "Durée de l'activité",
                activity.durationSeconds,
                'minutes',
                (val) => Math.round(val / 60).toString(),
            ],
            ['BPM moyen', activity.averagedBpm],
            ...this.subjectiveActivityDetailParams(activity, subjectiveScaleById),
            ['Note subjective de forme et de feeling', activity.fitnessLevel],
            ['Calories actives', activity.activeCalories],
            ...Object.entries(firstbeatLabels).map(([metric, label]) => [label, getMetric(metric)]),
            ["Charge d'entraînement", activity.trainingLoad],
            ['FC max', activity.fcMax],
            ["Type d'activité", activity.sport.name],
        ];
        if (!periods || periods.length === 0) {
            detailsParams.push(...GPS_DISTANCE_BAND_LABELS.map(({ label, metric }) => [label, getMetric(metric), 'm', formatDistance]), ['Distance Totale Parcourue', activity.distance, 'm', formatDistance], ['Efforts Très Haute Vitesse (>19.8 km/h)', getMetric('nb_efforts_above_19_8_kmh')], ['Efforts de Sprint (>25 km/h)', getMetric('nb_efforts_above_25_kmh')], ['Vitesse Maximale', getMetric('top_speed'), 'km/h', formatDistance], ['Accélération Maximale', getMetric('vmax_acceleration'), 'm/s²', formatDistance], ['Décélération Maximale', getMetric('vmax_deceleration'), 'm/s²', formatDistance], ['Accélérations (>3.0 m/s²)', getMetric('nb_accelerations_above_3ms2')], ['Décélérations (>3.0 m/s²)', getMetric('nb_decelerations_above_3ms2')]);
        }
        detailsParams.forEach(([label, value, unit, formatter]) => {
            details.push(this.generateActivityDetail(label, value, unit, formatter));
        });
        const activityWithZones = activity;
        if (activityWithZones.zones) {
            const zones = activityWithZones.zones;
            if (Object.values(zones).some((time) => time > 0)) {
                for (let i = 1; i <= 5; i++) {
                    const zoneKey = `zone${i}`;
                    details.push(`\t- Zone ${i} temps : ${parseMicrosecondsToDuration(zones[zoneKey] ?? 0)}`);
                }
            }
        }
        else if (ZONE_TIME_PERIOD_METRICS.some((metric) => getMetric(metric) !== null)) {
            ZONE_TIME_PERIOD_METRICS.forEach((metric, index) => {
                const zoneTimeInSeconds = getMetric(metric) ?? 0;
                details.push(`\t- Zone ${index + 1} temps : ${parseSecondsToDuration(zoneTimeInSeconds)}`);
            });
        }
        if (periodsToUse && periodsToUse.length > 0) {
            details.push('\t- Détails des périodes :');
            periodsToUse.forEach((period) => {
                details.push(`\t\t* Période : ${period.name}`);
                if (period.metricValues && period.metricValues.length > 0) {
                    period.metricValues.forEach((mv) => {
                        const metricName = mv.metric?.name;
                        details.push(`\t\t\t- ${metricName} : ${mv.value}`);
                    });
                }
            });
        }
        return details.filter((detail) => detail !== null);
    }
    cleanAthleteForLLM(athlete, selectedPeriods, referenceDate, subjectiveScaleById) {
        const playerInfo = `
- Prénom : ${athlete.firstName}
- Nom : ${athlete.lastName}
- Âge : ${athlete.age} ans
- Sexe : ${athlete.gender}
- Taille : ${athlete.heightCm} cm
- Poids : ${athlete.weightKg} kg
${athlete.fatPercentage ? `- Masse graisseuse : ${athlete.fatPercentage} %` : ''}
- Position : ${athlete.playerPosition?.name}`;
        const activitiesInfo = athlete.days
            .map((day) => {
            if (referenceDate && day.dateOfDay?.toFormat('yyyy-MM-dd') === referenceDate) {
                return null;
            }
            if (!day.dateOfDay || day.sportActivities.length === 0)
                return null;
            const activitiesDetails = day.sportActivities
                .map((activity, index) => {
                const periodsForActivity = selectedPeriods
                    ? selectedPeriods.filter((p) => p.sportActivityId == activity.id)
                    : undefined;
                const details = [
                    `Activité ${index + 1} :`,
                    ...this.generateActivityDetails(activity, periodsForActivity, subjectiveScaleById),
                ].join('\n');
                return details;
            })
                .join('\n\n');
            return `Date : ${day.dateOfDay.toFormat('dd MMMM yyyy')}\n${activitiesDetails}`;
        })
            .filter(Boolean)
            .join('\n\n');
        return `${playerInfo}\n\n${activitiesInfo}`;
    }
    cleanInsightsForLLM(insights, featuresMap) {
        const uniqueFeatures = new Set([
            ...featuresMap,
        ]);
        return insights
            .filter((insight) => uniqueFeatures.has(insight.variableName))
            .map((insight) => {
            let insightStr = `- ${insight.name}: ${insight.description}`;
            if (insight.tresholdTooHigh === null && insight.tresholdHigh === null) {
                insightStr += ' Cette valeur ne peut pas être trop élevée.';
            }
            if (insight.tresholdTooLow === null && insight.tresholdLow === null) {
                insightStr += ' Cette valeur ne peut pas être trop basse.';
            }
            return insightStr;
        })
            .join('\n');
    }
    convertToNewInsights(features, insights) {
        return features.map((feature) => {
            const insight = insights.find((ins) => ins.id === feature.insightId) || feature.insight;
            const isAnalytic = insight.maximum !== null &&
                (insight.tresholdHigh !== null ||
                    insight.tresholdTooHigh !== null ||
                    insight.tresholdLow !== null ||
                    insight.tresholdTooLow !== null);
            let calculatedValue;
            if (Math.abs(feature.optimal ?? 0) === 0) {
                calculatedValue = 100;
            }
            else {
                calculatedValue = Math.min(Math.max((feature.value / Math.abs(feature.optimal ?? 0)) * 100, 0), 200);
            }
            return {
                label: insight.name,
                description: insight.description,
                value: isAnalytic ? feature.value : calculatedValue,
                optimalValue: isAnalytic ? null : feature.optimal,
                maximum: insight.maximum ?? 200,
                tresholdHigh: insight.tresholdHigh,
                tresholdTooHigh: insight.tresholdTooHigh,
                tresholdLow: insight.tresholdLow,
                tresholdTooLow: insight.tresholdTooLow,
                tresholdType: insight.tresholdType,
                type: feature.type,
                fb: null,
                fh: null,
                shapValue: feature.shapValue,
            };
        });
    }
    async cleanFeaturesDayForLLM(insights, athlete, category, referenceDate) {
        const formatDay = async (dateLabel, features, day) => {
            let summary = '';
            summary += `Date: ${dateLabel} \n`;
            if (category === 'performance') {
                if (day.performanceScore) {
                    summary += `Performance: ${Math.round(day.performanceScore || 0)} \n\n`;
                }
            }
            else {
                summary += `Risque de blessure: ${Math.round(day.injuryRiskScore || 0)} \n\n`;
            }
            const categoryFeatures = features.filter((feature) => feature.category === category);
            if (categoryFeatures.length === 0) {
                return summary;
            }
            const featuresToImprove = categoryFeatures.filter((feature) => feature.value !== feature.optimal);
            const featuresOptimal = categoryFeatures.filter((feature) => feature.value === feature.optimal);
            const dayKey = day.dateOfDay?.toFormat('yyyy-MM-dd');
            const isReferenceDay = referenceDate && dayKey === referenceDate;
            const priorityMap = new Map();
            if (featuresToImprove.length > 0) {
                const newInsights = this.convertToNewInsights(featuresToImprove, insights);
                const shapValueMap = new Map();
                categoryFeatures.forEach((feature) => {
                    shapValueMap.set(feature.insightId, feature.shapValue ?? null);
                });
                const insightsWithPriority = await this.priorityService.calculatePriorityRanking({
                    insights: newInsights,
                    featureImportances: featuresToImprove.map((f) => ({ insightId: f.insightId })),
                    shapValueMap,
                    clubId: athlete.clubId,
                    type: category,
                });
                insightsWithPriority.forEach((insight, index) => {
                    const feature = featuresToImprove[index];
                    if (feature) {
                        const priority = insight.priority;
                        priorityMap.set(feature.insightId, priority);
                    }
                });
            }
            const featuresWithPriority = featuresToImprove
                .map((feature) => {
                const priority = priorityMap.get(feature.insightId);
                if (priority === null || priority === undefined) {
                    return null;
                }
                return {
                    id: feature.id,
                    insightId: feature.insightId,
                    type: feature.type,
                    value: feature.value,
                    optimal: feature.optimal,
                    shapValue: feature.shapValue,
                    insight: feature.insight,
                    priority,
                };
            })
                .filter((feature) => feature !== null)
                .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
            const categorizedToImprove = {
                Activité: featuresWithPriority.filter((item) => item.type === 'activity'),
                Sommeil: featuresWithPriority.filter((item) => item.type === 'sleep'),
                Santé: featuresWithPriority.filter((item) => item.type === 'health'),
            };
            const formatSection = (title, items) => {
                if (items.length > 0) {
                    summary += `\n${title} \n`;
                    items.forEach((item) => {
                        const insight = insights.find((insight) => insight.id === item.insightId);
                        summary += `${insight?.name || item.insight.variableName}: valeur = ${Math.round(item.value * 100) / 100} | `;
                        let advice = 'Optimal';
                        if (item.optimal !== null) {
                            const diff = item.value - item.optimal;
                            if (diff < 0) {
                                advice = 'Augmenter';
                            }
                            else if (diff > 0) {
                                advice = 'Diminuer';
                            }
                            summary += `optimal = ${Math.round(item.optimal * 100) / 100} | `;
                        }
                        else if (item.shapValue === null) {
                            const { tresholdLow, tresholdTooLow, tresholdHigh, tresholdTooHigh } = item.insight;
                            if ((tresholdLow && item.value < tresholdLow) ||
                                (tresholdTooLow && item.value < tresholdTooLow)) {
                                advice = 'Augmenter';
                                summary += `optimal > ${tresholdLow ? tresholdLow : tresholdTooLow} | `;
                            }
                            else if ((tresholdHigh && item.value > tresholdHigh) ||
                                (tresholdTooHigh && item.value > tresholdTooHigh)) {
                                advice = 'Diminuer';
                                summary += `optimal < ${tresholdHigh ? tresholdHigh : tresholdTooHigh} | `;
                            }
                        }
                        summary += `conseil = ${advice} | `;
                        summary += `priorité = ${item.priority} \n`;
                    });
                }
            };
            const categorizedOptimal = {
                Activité: featuresOptimal.filter((item) => item.type === 'activity'),
                Sommeil: featuresOptimal.filter((item) => item.type === 'sleep'),
                Santé: featuresOptimal.filter((item) => item.type === 'health'),
            };
            const formatOptimalSection = (title, items) => {
                if (items.length > 0) {
                    summary += `\n${title} \n`;
                    items.forEach((item) => {
                        const insight = insights.find((currentInsight) => currentInsight.id === item.insightId);
                        summary += `${insight?.name || item.insight.variableName}: optimal = ${Math.round((item.optimal ?? item.value) * 100) / 100} \n`;
                    });
                }
            };
            if (!isReferenceDay) {
                formatSection('🔍 Activité – Points à améliorer', categorizedToImprove['Activité']);
                formatSection('🛌 Sommeil – Points à améliorer', categorizedToImprove['Sommeil']);
                formatSection('🩺 Santé – Points à améliorer', categorizedToImprove['Santé']);
            }
            else {
                summary += '\nFeatures importances to improve:\n';
                formatSection('🔍 Activité – Points à améliorer', categorizedToImprove['Activité']);
                formatSection('🛌 Sommeil – Points à améliorer', categorizedToImprove['Sommeil']);
                formatSection('🩺 Santé – Points à améliorer', categorizedToImprove['Santé']);
                summary += '\nFeatures importances optimal:\n';
                formatOptimalSection('🔍 Activité – Points optimaux', categorizedOptimal['Activité']);
                formatOptimalSection('🛌 Sommeil – Points optimaux', categorizedOptimal['Sommeil']);
                formatOptimalSection('🩺 Santé – Points optimaux', categorizedOptimal['Santé']);
            }
            return summary;
        };
        const separator = '================\n';
        const summaries = await Promise.all(athlete.days.map((day) => {
            return formatDay(day.dateOfDay?.toFormat('dd MMMM yyyy') || '', day.featureImportances, day);
        }));
        return summaries.join(separator);
    }
    async cleanNutritionForLLM(athlete, date, nutrition, scoresOnlyOnReferenceDay = false) {
        const today = athlete.days.find((day) => day.dateOfDay?.toFormat('yyyy-MM-dd') === date);
        const todayMacros = nutrition.dailyMacros.find((macro) => macro.date === date);
        const skippedMeals = scoresOnlyOnReferenceDay || !today
            ? {}
            : await this.nutritionService.getSkippedMeals(today.id);
        const skippedMealNames = this.nutritionService.getSkippedMealNames(skippedMeals);
        const getRangeText = (min, max, value) => {
            if (value < min) {
                return `It should be between ${min} and ${max}, so it is below recommendations.`;
            }
            else if (value > max) {
                return `It should be between ${min} and ${max}, so it is above recommendations.`;
            }
            else {
                return `It should be between ${min} and ${max}, so it is in recommendations.`;
            }
        };
        const skippedMealsSection = !scoresOnlyOnReferenceDay && skippedMealNames.length > 0
            ? `### Skipped Meals:
The following meals were intentionally skipped today: ${skippedMealNames.join(', ')}. These meals were skipped by choice (e.g., intermittent fasting) and should not be considered as missing data.
`
            : '';
        const todayCarbDetail = scoresOnlyOnReferenceDay
            ? ''
            : `Today's carbohydrate intake is ${todayMacros?.carbohydrates} grams.
${getRangeText(todayMacros?.ranges.carbohydrates.min ?? 0, todayMacros?.ranges.carbohydrates.max ?? 0, todayMacros?.carbohydrates ?? 0)}
`;
        const todayFatDetail = scoresOnlyOnReferenceDay
            ? ''
            : `Today's fat intake is ${todayMacros?.fats} grams.
${getRangeText(todayMacros?.ranges.fats.min ?? 0, todayMacros?.ranges.fats.max ?? 0, todayMacros?.fats ?? 0)}
`;
        const todayProteinDetail = scoresOnlyOnReferenceDay
            ? ''
            : `Today's protein intake is ${todayMacros?.proteins} grams.
${getRangeText(todayMacros?.ranges.proteins.min ?? 0, todayMacros?.ranges.proteins.max ?? 0, todayMacros?.proteins ?? 0)}
`;
        const nutritionSummary = `## Nutrition Summary: We don't have nutrition score for today
### Macronutrient Summary:
Carbohydrate intake score(between 0 - 100): Score: N/A out of 100
The average carbohydrate intake during the last seven days is ${nutrition.averages.carbohydrates} grams.
        ${getRangeText(nutrition.averagesRanges.carbohydrates.min, nutrition.averagesRanges.carbohydrates.max, nutrition.averages.carbohydrates)}
${todayCarbDetail}Fat intake score(between 0 - 100): Score: N/A out of 100
The average fat intake during the last seven days is ${nutrition.averages.fats} grams.
        ${getRangeText(nutrition.averagesRanges.fats.min, nutrition.averagesRanges.fats.max, nutrition.averages.fats)}
${todayFatDetail}Protein intake score(between 0 - 100): Score: N/A out of 100
The average protein intake during the last seven days is ${nutrition.averages.proteins} grams.
        ${getRangeText(nutrition.averagesRanges.proteins.min, nutrition.averagesRanges.proteins.max, nutrition.averages.proteins)}
${todayProteinDetail}${skippedMealsSection}### Weekly Micronutrient Summary:
Vitamin C intake: ${nutrition.weeklyMicronutrients.vitaminC} mg. Goal: ≥ 100 mg
Vitamin E intake: ${nutrition.weeklyMicronutrients.vitaminE} mg. Goal: ≥ 12 mg
Vitamin D intake: ${nutrition.weeklyMicronutrients.vitaminD} µg. Goal: ≥ 15 μg and ≤ 100 μg
Magnesium intake: ${nutrition.weeklyMicronutrients.magnesium} mg. Goal: ≥ 300 mg and ≤ 350 mg
Potassium intake: ${nutrition.weeklyMicronutrients.potassium} mg. Goal: ≥ 3500 mg and ≤ 5000 mg
Calcium intake: ${nutrition.weeklyMicronutrients.calcium} mg. Goal: ≥ 1200 mg and ≤ 2500 mg
Chloride intake: ${nutrition.weeklyMicronutrients.chloride} mg. Goal: ≥ 2300 mg
Sodium intake: ${nutrition.weeklyMicronutrients.sodium} mg. Goal: ≤ 2300 mg
Zinc intake: ${nutrition.weeklyMicronutrients.zinc} mg. Goal: ≥ 10 mg and ≤ 25 mg
Iron intake: ${nutrition.weeklyMicronutrients.iron} mg. Goal: ≥ 15 mg and ≤ 20 mg`;
        return nutritionSummary;
    }
}
//# sourceMappingURL=feature_formatter_service.js.map