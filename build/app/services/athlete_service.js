import Athlete from '#models_pg/athlete';
import { DateTime } from 'luxon';
import Day from '#models_pg/day';
import Season from '#models_pg/season';
import FeatureImportance from '#models_pg/feature_importance';
import Insight from '#models_pg/insight';
import { TranslationService } from '#services/translation_service';
import { TRANSLATABLE_TYPES, TRANSLATION_KEYS } from '#constants/translation.constants';
import SportActivity from '#models_pg/sport_activity';
import HealthRating from '#models_pg/health_rating';
import Sleep from '#models_pg/sleep';
import BodymetricsHistory from '#models_pg/bodymetrics_history';
import { decodeJsonPayload } from '../utils/statistics.js';
import { parsedPointSeries } from '../utils/series.js';
import Period from '#models_pg/period';
import { SERIE_TYPE, DEFAULT_HEART_RATE_SAMPLES_PER_MINUTE } from '#constants/serie.constants';
import { PriorityService } from '#services/priority_service';
import ChatbotReportService from '#services/chatbot_report_service';
import { MetricDomain } from '#contracts/metric';
import { MetricService } from '#services/metric_service';
import { IMPUTATION_GPS_METRIC_BINDINGS, ZONE_TIME_PERIOD_METRICS, } from '#constants/sport_activity_period_metrics.constants';
import Event from '#models_pg/event';
import { buildMacroTargets, classifyDayFromCalendar, classifyDayFromEee, computeBmr, computeDailyEnergy, computeSessionEee, estimateFfmKg, estimateMetFromRpe, estimateMetFromZones, getDefaultMetForActivity, isCompetitionEvent, isStrengthActivity, missingNutritionProfileDataError, roundMacro, } from '#utils/nutrition_energy';
export default class AthleteService {
    translationService;
    priorityService;
    periodMetricService = new MetricService(MetricDomain.PERIOD);
    dayMetricService = new MetricService(MetricDomain.DAY);
    constructor() {
        this.translationService = new TranslationService();
        this.priorityService = new PriorityService();
    }
    async getInsights(athleteId, date, type, language) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const day = await Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', date)
            .preload('sportActivities')
            .first();
        if (!day) {
            throw new Error('Day not found');
        }
        const featureImportances = await FeatureImportance.query()
            .preload('insight')
            .where('dayId', day.id)
            .where('category', type);
        const insightIds = featureImportances.map((feature) => feature.insightId);
        const nameTranslationMap = await this.translationService.getTranslations(TRANSLATABLE_TYPES.INSIGHT, TRANSLATION_KEYS.INSIGHT_NAME, insightIds, language);
        const descriptionTranslationMap = await this.translationService.getTranslations(TRANSLATABLE_TYPES.INSIGHT, TRANSLATION_KEYS.INSIGHT_DESCRIPTION, insightIds, language);
        const shapValueMap = new Map();
        featureImportances.forEach((feature) => {
            shapValueMap.set(feature.insightId, feature.shapValue ?? null);
        });
        const formattedInsights = featureImportances.map((feature) => {
            const { insightId, optimal, value, shapValue, contribPct, insight: { tresholdType, maximum, tresholdHigh, tresholdTooHigh, tresholdLow, tresholdTooLow, name, description, }, } = feature;
            const isAnalytic = maximum !== null &&
                (tresholdHigh !== null ||
                    tresholdTooHigh !== null ||
                    tresholdLow !== null ||
                    tresholdTooLow !== null);
            const baseInsight = {
                label: nameTranslationMap.get(insightId) ?? name,
                description: descriptionTranslationMap.get(insightId) ?? description,
                value,
                optimalValue: isAnalytic ? null : optimal,
                maximum: maximum ?? 100,
                tresholdHigh: tresholdHigh,
                tresholdTooHigh: tresholdTooHigh,
                tresholdLow: tresholdLow,
                tresholdTooLow: tresholdTooLow,
                tresholdType: tresholdType,
                type: feature.type,
                fb: null,
                fh: null,
                shapValue: shapValue ?? null,
                contribPct: contribPct ?? null,
            };
            return baseInsight;
        });
        return this.priorityService.calculatePriorityRanking({
            insights: formattedInsights,
            featureImportances,
            shapValueMap,
            clubId: athlete.clubId,
            type,
        });
    }
    async getSleepData(athleteId, date) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const day = await Day.query().where('athleteId', athleteId).where('dateOfDay', date).first();
        if (!day) {
            throw new Error('Day not found');
        }
        const sleepData = await Sleep.query()
            .where('dayId', day.id)
            .orderBy('createdAt', 'desc')
            .first();
        return sleepData;
    }
    async getDayByAthleteAndDate(athleteId, date) {
        return Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', DateTime.fromFormat(date, 'yyyy-MM-dd').toJSDate())
            .first();
    }
    async getLastSevenDaysMacros(athleteId, date) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd');
        const sevenDaysAgo = targetDate.minus({ days: 7 }).toJSDate();
        const endDate = targetDate.toJSDate();
        const days = await Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', '>=', sevenDaysAgo)
            .where('dateOfDay', '<=', endDate)
            .preload('nutrition', (nutritionQuery) => {
            nutritionQuery.preload('aliment');
            nutritionQuery.preload('llmAliment');
            nutritionQuery.preload('recipe', (recipeQuery) => {
                recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
                    recipeAlimentsQuery.preload('meal');
                });
            });
        })
            .preload('sportActivities', (sportActivitiesQuery) => {
            sportActivitiesQuery.preload('sport');
            sportActivitiesQuery.preload('activityFoodIntakes', (foodIntakesQuery) => {
                foodIntakesQuery.preload('aliment');
            });
        })
            .orderBy('dateOfDay', 'asc');
        const dailyMacros = [];
        for (const day of days) {
            if (!day.dateOfDay)
                continue;
            const nutrientFields = [
                'carbohydrateG',
                'fatG',
                'proteinsG',
                'vitaminCMg',
                'vitaminEMg',
                'vitaminDMicrog',
                'magnesiumMg',
                'potassiumMg',
                'calciumMg',
                'chlorideMg',
                'sodiumMg',
                'zincMg',
                'ironMg',
            ];
            const totalMeal = {
                carbohydrateG: 0,
                fatG: 0,
                proteinsG: 0,
                vitaminCMg: 0,
                vitaminEMg: 0,
                vitaminDMicrog: 0,
                magnesiumMg: 0,
                potassiumMg: 0,
                calciumMg: 0,
                chlorideMg: 0,
                sodiumMg: 0,
                zincMg: 0,
                ironMg: 0,
            };
            const totalRecipe = {
                carbohydrateG: 0,
                fatG: 0,
                proteinsG: 0,
                vitaminCMg: 0,
                vitaminEMg: 0,
                vitaminDMicrog: 0,
                magnesiumMg: 0,
                potassiumMg: 0,
                calciumMg: 0,
                chlorideMg: 0,
                sodiumMg: 0,
                zincMg: 0,
                ironMg: 0,
            };
            const totalIntake = {
                carbohydrateG: 0,
                fatG: 0,
                proteinsG: 0,
                vitaminCMg: 0,
                vitaminEMg: 0,
                vitaminDMicrog: 0,
                magnesiumMg: 0,
                potassiumMg: 0,
                calciumMg: 0,
                chlorideMg: 0,
                sodiumMg: 0,
                zincMg: 0,
                ironMg: 0,
            };
            for (const field of nutrientFields) {
                totalMeal[field] = day.nutrition.reduce((sum, nutrition) => {
                    if (!nutrition.portion || !nutrition.quantity)
                        return sum;
                    let mealData = nutrition.aliment;
                    if (nutrition.llmAliment) {
                        mealData = this.mergeLlmNutritionWithAliment(nutrition.llmAliment);
                    }
                    if (mealData) {
                        const mealValue = this.getNutrientValue(mealData, field);
                        return sum + (mealValue * nutrition.portion * nutrition.quantity) / 100;
                    }
                    return sum;
                }, 0);
                totalRecipe[field] = day.nutrition.reduce((sum, nutrition) => {
                    if (!nutrition.recipe?.recipeAliments)
                        return sum;
                    return (sum +
                        nutrition.recipe.recipeAliments.reduce((recipeSum, recipeAliment) => {
                            if (!recipeAliment.meal || !recipeAliment.portion || !recipeAliment.quantity)
                                return recipeSum;
                            const mealValue = this.getNutrientValue(recipeAliment.meal, field);
                            return recipeSum + (mealValue * recipeAliment.portion * recipeAliment.quantity) / 100;
                        }, 0));
                }, 0);
                totalIntake[field] = day.sportActivities.reduce((sum, activity) => {
                    return (sum +
                        activity.activityFoodIntakes.reduce((activitySum, foodIntake) => {
                            if (!foodIntake.aliment || !foodIntake.portion || !foodIntake.quantity)
                                return activitySum;
                            const foodValue = this.getNutrientValue(foodIntake.aliment, field);
                            return activitySum + (foodValue * foodIntake.portion * foodIntake.quantity) / 100;
                        }, 0));
                }, 0);
            }
            const total = {
                carbohydrateG: (totalMeal.carbohydrateG || 0) +
                    (totalRecipe.carbohydrateG || 0) +
                    (totalIntake.carbohydrateG || 0),
                fatG: (totalMeal.fatG || 0) + (totalRecipe.fatG || 0) + (totalIntake.fatG || 0),
                proteinsG: (totalMeal.proteinsG || 0) + (totalRecipe.proteinsG || 0) + (totalIntake.proteinsG || 0),
                vitaminCMg: (totalMeal.vitaminCMg || 0) +
                    (totalRecipe.vitaminCMg || 0) +
                    (totalIntake.vitaminCMg || 0),
                vitaminEMg: (totalMeal.vitaminEMg || 0) +
                    (totalRecipe.vitaminEMg || 0) +
                    (totalIntake.vitaminEMg || 0),
                vitaminDMicrog: (totalMeal.vitaminDMicrog || 0) +
                    (totalRecipe.vitaminDMicrog || 0) +
                    (totalIntake.vitaminDMicrog || 0),
                magnesiumMg: (totalMeal.magnesiumMg || 0) +
                    (totalRecipe.magnesiumMg || 0) +
                    (totalIntake.magnesiumMg || 0),
                potassiumMg: (totalMeal.potassiumMg || 0) +
                    (totalRecipe.potassiumMg || 0) +
                    (totalIntake.potassiumMg || 0),
                calciumMg: (totalMeal.calciumMg || 0) + (totalRecipe.calciumMg || 0) + (totalIntake.calciumMg || 0),
                chlorideMg: (totalMeal.chlorideMg || 0) +
                    (totalRecipe.chlorideMg || 0) +
                    (totalIntake.chlorideMg || 0),
                sodiumMg: (totalMeal.sodiumMg || 0) + (totalRecipe.sodiumMg || 0) + (totalIntake.sodiumMg || 0),
                zincMg: (totalMeal.zincMg || 0) + (totalRecipe.zincMg || 0) + (totalIntake.zincMg || 0),
                ironMg: (totalMeal.ironMg || 0) + (totalRecipe.ironMg || 0) + (totalIntake.ironMg || 0),
            };
            const macroInsights = await this.calculateMacronutrientInsights(athlete, athlete.fcMax, day, days);
            dailyMacros.push({
                date: day.dateOfDay.toFormat('yyyy-MM-dd'),
                proteins: Math.round(total.proteinsG * 100) / 100,
                carbohydrates: Math.round(total.carbohydrateG * 100) / 100,
                fats: Math.round(total.fatG * 100) / 100,
                consumption: {
                    carbohydrates: macroInsights.nutri_score.glucides_consommes_total,
                },
                ranges: {
                    proteins: {
                        min: Math.round(macroInsights.proteines.min * 100) / 100,
                        max: Math.round(macroInsights.proteines.max * 100) / 100,
                    },
                    carbohydrates: {
                        min: Math.round(macroInsights.glucides.min * 100) / 100,
                        max: Math.round(macroInsights.glucides.max * 100) / 100,
                    },
                    fats: {
                        min: Math.round(macroInsights.lipides.min * 100) / 100,
                        max: Math.round(macroInsights.lipides.max * 100) / 100,
                    },
                },
                micronutrients: {
                    vitaminC: Math.round(total.vitaminCMg * 100) / 100,
                    vitaminE: Math.round(total.vitaminEMg * 100) / 100,
                    vitaminD: Math.round(total.vitaminDMicrog * 100) / 100,
                    magnesium: Math.round(total.magnesiumMg * 100) / 100,
                    potassium: Math.round(total.potassiumMg * 100) / 100,
                    calcium: Math.round(total.calciumMg * 100) / 100,
                    chloride: Math.round(total.chlorideMg * 100) / 100,
                    sodium: Math.round(total.sodiumMg * 100) / 100,
                    zinc: Math.round(total.zincMg * 100) / 100,
                    iron: Math.round(total.ironMg * 100) / 100,
                },
            });
        }
        const daysWithFood = dailyMacros.filter((day) => day.proteins > 0 || day.carbohydrates > 0 || day.fats > 0);
        const daysWithFoodCount = daysWithFood?.length || 1;
        const totalProteins = dailyMacros.reduce((sum, day) => sum + day.proteins, 0);
        const totalCarbohydrates = dailyMacros.reduce((sum, day) => sum + day.carbohydrates, 0);
        const totalFats = dailyMacros.reduce((sum, day) => sum + day.fats, 0);
        const totalVitaminC = dailyMacros.reduce((sum, day) => sum + day.micronutrients.vitaminC, 0);
        const totalVitaminE = dailyMacros.reduce((sum, day) => sum + day.micronutrients.vitaminE, 0);
        const totalVitaminD = dailyMacros.reduce((sum, day) => sum + day.micronutrients.vitaminD, 0);
        const totalMagnesium = dailyMacros.reduce((sum, day) => sum + day.micronutrients.magnesium, 0);
        const totalPotassium = dailyMacros.reduce((sum, day) => sum + day.micronutrients.potassium, 0);
        const totalCalcium = dailyMacros.reduce((sum, day) => sum + day.micronutrients.calcium, 0);
        const totalChloride = dailyMacros.reduce((sum, day) => sum + day.micronutrients.chloride, 0);
        const totalSodium = dailyMacros.reduce((sum, day) => sum + day.micronutrients.sodium, 0);
        const totalZinc = dailyMacros.reduce((sum, day) => sum + day.micronutrients.zinc, 0);
        const totalIron = dailyMacros.reduce((sum, day) => sum + day.micronutrients.iron, 0);
        const avgProteinMin = daysWithFood.reduce((sum, day) => sum + day.ranges.proteins.min, 0) / daysWithFoodCount;
        const avgProteinMax = daysWithFood.reduce((sum, day) => sum + day.ranges.proteins.max, 0) / daysWithFoodCount;
        const avgCarbMin = daysWithFood.reduce((sum, day) => sum + day.ranges.carbohydrates.min, 0) / daysWithFoodCount;
        const avgCarbMax = daysWithFood.reduce((sum, day) => sum + day.ranges.carbohydrates.max, 0) / daysWithFoodCount;
        const avgFatMin = daysWithFood.reduce((sum, day) => sum + day.ranges.fats.min, 0) / daysWithFoodCount;
        const avgFatMax = daysWithFood.reduce((sum, day) => sum + day.ranges.fats.max, 0) / daysWithFoodCount;
        return {
            dailyMacros,
            averages: {
                proteins: Math.round((totalProteins / daysWithFoodCount) * 100) / 100,
                carbohydrates: Math.round((totalCarbohydrates / daysWithFoodCount) * 100) / 100,
                fats: Math.round((totalFats / daysWithFoodCount) * 100) / 100,
            },
            averagesRanges: {
                proteins: {
                    min: Math.round(avgProteinMin * 100) / 100,
                    max: Math.round(avgProteinMax * 100) / 100,
                },
                carbohydrates: {
                    min: Math.round(avgCarbMin * 100) / 100,
                    max: Math.round(avgCarbMax * 100) / 100,
                },
                fats: {
                    min: Math.round(avgFatMin * 100) / 100,
                    max: Math.round(avgFatMax * 100) / 100,
                },
            },
            totals: {
                proteins: Math.round(totalProteins * 100) / 100,
                carbohydrates: Math.round(totalCarbohydrates * 100) / 100,
                fats: Math.round(totalFats * 100) / 100,
            },
            weeklyMicronutrients: {
                vitaminC: Math.round(totalVitaminC * 100) / 100,
                vitaminE: Math.round(totalVitaminE * 100) / 100,
                vitaminD: Math.round(totalVitaminD * 100) / 100,
                magnesium: Math.round(totalMagnesium * 100) / 100,
                potassium: Math.round(totalPotassium * 100) / 100,
                calcium: Math.round(totalCalcium * 100) / 100,
                chloride: Math.round(totalChloride * 100) / 100,
                sodium: Math.round(totalSodium * 100) / 100,
                zinc: Math.round(totalZinc * 100) / 100,
                iron: Math.round(totalIron * 100) / 100,
            },
        };
    }
    async getActiveAthleteIds(clubId, date) {
        const rows = await Athlete.query()
            .where('clubId', clubId)
            .where('startDate', '<=', date)
            .where((query) => {
            query.whereNull('endDate').orWhere('endDate', '>=', date);
        })
            .select('id');
        return rows.map((row) => row.id);
    }
    async getAthleteListByClub({ clubId, isDemoUser, language, seasonStartDate = null, seasonEndDate = null, }) {
        const startDate = !isDemoUser
            ? DateTime.now().minus({ months: 2 }).toJSDate()
            : DateTime.now().minus({ months: 12 }).toJSDate();
        const athletesQuery = Athlete.query()
            .select('id', 'firstName', 'lastName', 'playerPositionId', 'startDate', 'endDate')
            .where('clubId', clubId);
        let daysStartDate = startDate;
        let daysEndDate = null;
        if (seasonStartDate && seasonEndDate) {
            const seasonStartJSDate = seasonStartDate.toJSDate();
            const seasonEndJSDate = seasonEndDate.toJSDate();
            athletesQuery
                .where((q) => {
                q.whereNull('startDate').orWhere('startDate', '<=', seasonEndJSDate);
            })
                .where((q) => {
                q.where('endDate', '>=', seasonStartJSDate).orWhereNull('endDate');
            });
            daysStartDate = seasonStartJSDate;
            daysEndDate = seasonEndJSDate;
        }
        const athletes = await athletesQuery
            .preload('days', (daysQuery) => {
            daysQuery.where('dateOfDay', '>=', daysStartDate);
            if (daysEndDate) {
                daysQuery.where('dateOfDay', '<=', daysEndDate);
            }
        })
            .preload('injuries', (injuriesQuery) => {
            if (seasonStartDate && seasonEndDate) {
                injuriesQuery.where((query) => {
                    query.where('dateOfInjury', '<=', seasonEndDate.toJSDate()).where((q) => {
                        q.whereNull('recoveryDate').orWhere('recoveryDate', '>=', seasonStartDate.toJSDate());
                    });
                });
            }
            else {
                const currentDate = DateTime.now().toJSDate();
                injuriesQuery.where('dateOfInjury', '<=', currentDate);
                injuriesQuery.where((query) => {
                    query.where('recoveryDate', '>=', currentDate).orWhereNull('recoveryDate');
                });
            }
        })
            .preload('profilePicture')
            .preload('playerPosition');
        const playerPositions = athletes
            .map((athlete) => athlete.playerPosition)
            .filter((position) => position != null);
        await this.translationService.applyTranslatedNames(playerPositions, TRANSLATABLE_TYPES.PLAYER_POSITION, TRANSLATION_KEYS.PLAYER_POSITION_NAME, language);
        return athletes;
    }
    async getAthlete({ athleteId, language, seasonStartDate, seasonEndDate, allTime = false, }) {
        const athleteForDate = await Athlete.query()
            .select('startDate', 'endDate')
            .where('id', athleteId)
            .first();
        if (!athleteForDate) {
            return null;
        }
        const athlete = await Athlete.query()
            .where('id', athleteId)
            .preload('days', (daysQuery) => {
            daysQuery.orderBy('dateOfDay', 'desc');
            if (seasonStartDate && seasonEndDate && !allTime) {
                daysQuery
                    .where('dateOfDay', '>=', seasonStartDate.toJSDate())
                    .where('dateOfDay', '<=', seasonEndDate.toJSDate());
            }
            if (athleteForDate.startDate) {
                daysQuery.where('dateOfDay', '>=', athleteForDate.startDate.toJSDate());
            }
            if (athleteForDate.endDate) {
                daysQuery.where('dateOfDay', '<=', athleteForDate.endDate.toJSDate());
            }
            daysQuery.preload('sportActivities', (sportActivitiesQuery) => {
                sportActivitiesQuery.preload('sport').preload('sportActivityPains', (painsQuery) => {
                    painsQuery.preload('location', (locationQuery) => {
                        locationQuery.preload('zone');
                    });
                });
            });
            daysQuery.preload('health', (healthQuery) => {
                healthQuery
                    .preload('pains', (painsQuery) => {
                    painsQuery
                        .whereHas('location', (locationQuery) => {
                        locationQuery.whereNotNull('id');
                    })
                        .preload('location', (locationQuery) => {
                        locationQuery.preload('zone');
                    });
                })
                    .preload('travels')
                    .preload('metricValues', (metricValuesQuery) => {
                    metricValuesQuery.preload('metric');
                });
            });
            daysQuery.preload('bodymetricsHistories');
        })
            .preload('profilePicture')
            .preload('club', (clubQuery) => {
            clubQuery.preload('seasons');
        })
            .preload('playerPosition')
            .preload('injuries', (injuriesQuery) => {
            if (athleteForDate.startDate) {
                injuriesQuery.where('dateOfInjury', '>=', athleteForDate.startDate.toJSDate());
            }
            if (athleteForDate.endDate) {
                injuriesQuery.where('dateOfInjury', '<=', athleteForDate.endDate.toJSDate());
            }
            injuriesQuery.preload('injuryType', (injuryTypeQuery) => {
                injuryTypeQuery.preload('section');
            });
        })
            .first();
        if (!athlete) {
            return null;
        }
        if (athlete.playerPosition) {
            await this.translationService.applyTranslatedNames([athlete.playerPosition], TRANSLATABLE_TYPES.PLAYER_POSITION, TRANSLATION_KEYS.PLAYER_POSITION_NAME, language);
        }
        return athlete;
    }
    async getAthleteById(athleteId) {
        const athlete = await Athlete.query().where('id', athleteId).preload('club').first();
        return athlete;
    }
    async getAthletePositionName(athleteId, language) {
        const athlete = await Athlete.query().where('id', athleteId).preload('playerPosition').first();
        if (!athlete || !athlete.playerPosition) {
            return null;
        }
        await this.translationService.applyTranslatedNames([athlete.playerPosition], TRANSLATABLE_TYPES.PLAYER_POSITION, TRANSLATION_KEYS.PLAYER_POSITION_NAME, language);
        return athlete.playerPosition.name;
    }
    async getAthleteWithDetails({ athleteId, days, startDate }) {
        const startDateObject = startDate
            ? DateTime.fromFormat(startDate, 'yyyy-MM-dd').toJSDate()
            : DateTime.now().toJSDate();
        const endDateObject = DateTime.fromJSDate(startDateObject).toJSDate();
        return Athlete.query()
            .where('id', athleteId)
            .preload('days', (daysQuery) => {
            daysQuery
                .orderBy('dateOfDay', 'desc')
                .preload('metricValues', (metricValuesQuery) => {
                metricValuesQuery.preload('metric');
            })
                .preload('featureImportances', (featureImportancesQuery) => {
                featureImportancesQuery.preload('insight');
            })
                .preload('sportActivities', (sportActivitiesQuery) => {
                sportActivitiesQuery
                    .preload('sport')
                    .preload('sportActivityPains', (painsQuery) => {
                    painsQuery.preload('location', (locationQuery) => {
                        locationQuery.preload('zone');
                    });
                })
                    .preload('periods', (periodsQuery) => {
                    periodsQuery.preload('metricValues', (metricValuesQuery) => {
                        metricValuesQuery.preload('metric');
                    });
                });
            })
                .preload('nutrition', (nutritionQuery) => {
                nutritionQuery.preload('aliment');
                nutritionQuery.preload('llmAliment');
                nutritionQuery.preload('recipe', (recipeQuery) => {
                    recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
                        recipeAlimentsQuery.preload('meal');
                    });
                });
            })
                .preload('sleeps', (sleepsQuery) => {
                sleepsQuery.orderBy('createdAt', 'desc');
            })
                .preload('health', (healthQuery) => {
                healthQuery
                    .preload('pains', (painsQuery) => {
                    painsQuery.preload('location', (locationQuery) => {
                        locationQuery.preload('zone');
                    });
                })
                    .preload('travels')
                    .preload('metricValues', (metricValuesQuery) => {
                    metricValuesQuery.preload('metric');
                });
            })
                .preload('bodymetricsHistories')
                .where('dateOfDay', '>=', days
                ? DateTime.fromJSDate(startDateObject).minus({ days }).toJSDate()
                : DateTime.fromJSDate(startDateObject).minus({ months: 6 }).toJSDate())
                .where('dateOfDay', '<=', endDateObject);
        })
            .preload('notes')
            .preload('injuries', (injuriesQuery) => {
            injuriesQuery.preload('injuryType', (injuryTypeQuery) => {
                injuryTypeQuery.preload('section');
            });
        })
            .preload('club', (clubQuery) => {
            clubQuery.preload('seasons');
        })
            .preload('playerPosition')
            .first();
    }
    async getAthletesByClub({ clubId, isDemoUser, seasonStartDate = null, seasonEndDate = null, }) {
        const query = Athlete.query().where('clubId', clubId);
        if (seasonStartDate && seasonEndDate) {
            const seasonStart = seasonStartDate.toJSDate();
            const seasonEnd = seasonEndDate.toJSDate();
            query
                .where((q) => {
                q.whereNull('startDate').orWhere('startDate', '<=', seasonEnd);
            })
                .where((q) => {
                q.whereNull('endDate').orWhere('endDate', '>=', seasonStart);
            });
        }
        query
            .preload('days', (daysQuery) => {
            daysQuery.orderBy('dateOfDay', 'desc');
            if (seasonStartDate && seasonEndDate) {
                daysQuery
                    .where('dateOfDay', '>=', seasonStartDate.toJSDate())
                    .where('dateOfDay', '<=', seasonEndDate.toJSDate());
            }
            else if (isDemoUser) {
                daysQuery.where('dateOfDay', '<=', DateTime.fromFormat('2025-07-07', 'yyyy-MM-dd').toJSDate());
            }
            else {
                daysQuery
                    .where('dateOfDay', '>=', DateTime.now().minus({ months: 6 }).toJSDate())
                    .where('dateOfDay', '<=', DateTime.now().toJSDate());
            }
        })
            .preload('injuries', (injuriesQuery) => {
            injuriesQuery.preload('injuryType', (injuryTypeQuery) => {
                injuryTypeQuery.preload('section');
            });
        })
            .preload('profilePicture')
            .preload('club', (clubQuery) => {
            clubQuery.preload('seasons');
        })
            .preload('playerPosition');
        return query;
    }
    async getSeasonsByClub(clubId) {
        return Season.query().where('clubId', clubId).orderBy('startDate', 'desc').preload('club');
    }
    async getStartAndEndDate(athleteId, startDate, endDate) {
        const athlete = await this.getAthleteById(athleteId);
        const club = athlete?.club;
        if (!athlete) {
            return null;
        }
        let finalStartDate = startDate;
        let finalEndDate = endDate;
        if (!finalStartDate || (athlete.startDate && athlete.startDate > finalStartDate)) {
            finalStartDate = athlete.startDate || undefined;
        }
        else if (!finalStartDate || (club?.startDate && club.startDate > finalStartDate)) {
            finalStartDate = club?.startDate || undefined;
        }
        if (!athlete.startDate && !finalStartDate && club?.startDate) {
            finalStartDate = club.startDate || undefined;
        }
        if (!finalEndDate || (athlete.endDate && athlete.endDate < finalEndDate)) {
            finalEndDate = athlete.endDate || undefined;
        }
        else if (!finalEndDate || (club?.endDate && club.endDate < finalEndDate)) {
            finalEndDate = club?.endDate || undefined;
        }
        if (!athlete.endDate && !finalEndDate && club?.endDate) {
            finalEndDate = club?.endDate || undefined;
        }
        if (!finalStartDate) {
            finalStartDate = athlete.startDate;
        }
        if (!finalEndDate) {
            finalEndDate = DateTime.now();
        }
        if (!finalStartDate) {
            throw new Error(`No valid start date found for athlete ${athleteId}`);
        }
        return {
            startDate: finalStartDate,
            endDate: finalEndDate,
        };
    }
    async getDayWithAverage(athleteId, date) {
        return Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', date)
            .preload('metricValues', (metricValuesQuery) => {
            metricValuesQuery.preload('metric');
        })
            .first();
    }
    async getOrCreateDay(athleteId, activityDate, trx) {
        const dateOfDay = activityDate.toFormat('yyyy-MM-dd');
        const existing = await Day.query({ client: trx ?? undefined })
            .where('athleteId', athleteId)
            .where('dateOfDay', dateOfDay)
            .first();
        if (existing)
            return existing;
        try {
            return await Day.create({ athleteId, dateOfDay: activityDate }, { client: trx ?? undefined });
        }
        catch (error) {
            const isDuplicate = error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062 || error?.code === '23505';
            if (isDuplicate) {
                const day = await Day.query({ client: trx ?? undefined })
                    .where('athleteId', athleteId)
                    .where('dateOfDay', dateOfDay)
                    .first();
                if (day)
                    return day;
            }
            throw error;
        }
    }
    async resolveNutritionWeightKg(athlete, date) {
        const metrics = await this.getLastWeightAndBodyFatBeforeDate(athlete.id, date);
        const weightKg = metrics.weight ?? athlete.weightKg;
        if (!weightKg) {
            throw missingNutritionProfileDataError('Missing athlete weight');
        }
        return {
            weightKg,
            bodyFatPct: metrics.fatPercentage ?? athlete.fatPercentage ?? null,
        };
    }
    async getCalendarEventsForDay(athlete, date) {
        if (!athlete.clubId) {
            return [];
        }
        const start = date.startOf('day');
        const end = date.endOf('day');
        const eventTable = Event.table;
        return Event.query()
            .join('athlete_events', `${eventTable}.id`, 'athlete_events.event_id')
            .where(`${eventTable}.club_id`, athlete.clubId)
            .where('athlete_events.athlete_id', athlete.id)
            .whereBetween(`${eventTable}.start_time`, [start.toJSDate(), end.toJSDate()])
            .select(`${eventTable}.*`)
            .preload('eventType');
    }
    async hasCompetitionTomorrow(athlete, date) {
        const tomorrowEvents = await this.getCalendarEventsForDay(athlete, date.plus({ days: 1 }));
        return tomorrowEvents.some((event) => isCompetitionEvent(event));
    }
    async estimateMetForSession(activity, athlete, day, isCompetitionSession) {
        if (activity.rpe !== null && activity.rpe !== undefined) {
            return estimateMetFromRpe(activity.rpe);
        }
        const fcMax = await this.getFcMax(athlete, day);
        const zones = await this.calculateActivityZones(activity, athlete, day, fcMax, null);
        if (zones) {
            const zoneMet = estimateMetFromZones(zones);
            if (zoneMet !== null) {
                return zoneMet;
            }
        }
        return getDefaultMetForActivity(activity, isCompetitionSession);
    }
    async computeTotalSessionEEE(athlete, activities, day, weightKg, isCompetitionDay) {
        let totalEee = 0;
        for (const activity of activities) {
            const met = await this.estimateMetForSession(activity, athlete, day, isCompetitionDay);
            totalEee += computeSessionEee(activity, weightKg, met);
        }
        return totalEee;
    }
    async calculateDailyEnergyBreakdown(athlete, activities, day) {
        const referenceDate = day.dateOfDay ?? DateTime.now();
        const { weightKg, bodyFatPct } = await this.resolveNutritionWeightKg(athlete, referenceDate);
        const { ffmKg, estimated } = estimateFfmKg(athlete, weightKg, bodyFatPct);
        const bmr = computeBmr(athlete, weightKg, ffmKg, referenceDate);
        const calendarEvents = await this.getCalendarEventsForDay(athlete, referenceDate);
        const isCompetitionDay = calendarEvents.some((event) => isCompetitionEvent(event));
        const eee = await this.computeTotalSessionEEE(athlete, activities, day, weightKg, isCompetitionDay);
        const energy = computeDailyEnergy(bmr, eee, ffmKg, activities.length > 0);
        return {
            ...energy,
            ffmKg,
            ffmEstimated: estimated,
        };
    }
    async calculateTDEEstatic(athlete, activities) {
        const referenceDate = DateTime.now();
        const { weightKg, bodyFatPct } = await this.resolveNutritionWeightKg(athlete, referenceDate);
        const { ffmKg } = estimateFfmKg(athlete, weightKg, bodyFatPct);
        const bmr = computeBmr(athlete, weightKg, ffmKg, referenceDate);
        const day = new Day();
        const eee = await this.computeTotalSessionEEE(athlete, activities, day, weightKg, false);
        return computeDailyEnergy(bmr, eee, ffmKg, activities.length > 0).kcalTarget;
    }
    async calculateTDEE(athlete, activities, day) {
        const breakdown = await this.calculateDailyEnergyBreakdown(athlete, activities, day);
        return breakdown.kcalTarget;
    }
    getNutrientValue(meal, field) {
        const fieldMap = {
            vitaminCMg: 'vitamin_C_mg',
            vitaminEMg: 'vitamin_E_mg',
            vitaminDMicrog: 'vitamin_D_microg',
        };
        const dbField = fieldMap[field] || field;
        const value = Number(meal.$extras?.[dbField] || meal[field] || 0);
        return value;
    }
    mergeLlmNutritionWithAliment(llmAliment) {
        return {
            id: llmAliment.id,
            alimCode: null,
            alimNomFr: llmAliment.name,
            alimNomEng: llmAliment.name,
            portion: llmAliment.portion,
            portionUnit: llmAliment.portionUnit || 'g',
            referenceDatabase: 'llm',
            modificated: null,
            energyKcal: llmAliment.energyKcal,
            waterG: llmAliment.waterG,
            proteinsG: llmAliment.proteinsG,
            carbohydrateG: llmAliment.carbohydrateG,
            fatG: llmAliment.fatG,
            glutenG: llmAliment.glutenG,
            sugarsG: llmAliment.sugarsG,
            fructoseG: llmAliment.fructoseG,
            galactoseG: null,
            glucoseG: llmAliment.glucoseG,
            lactoseG: llmAliment.lactoseG,
            maltoseG: llmAliment.maltoseG,
            sucroseG: llmAliment.sucroseG,
            starchG: llmAliment.starchG,
            fibresG: llmAliment.fibresG,
            alcoholG: llmAliment.alcoholG,
            faSaturatedG: llmAliment.faSaturatedG,
            faMonoG: llmAliment.faMonoG,
            faPolyG: llmAliment.faPolyG,
            fa181G: llmAliment.fa181G,
            fa182G: llmAliment.fa182G,
            cholesterolMg: llmAliment.cholesterolMg,
            saltG: llmAliment.saltG,
            calciumMg: llmAliment.calciumMg,
            chlorideMg: llmAliment.chlorideMg,
            copperMg: llmAliment.copperMg,
            ironMg: llmAliment.ironMg,
            iodineMicrog: llmAliment.iodineMicrog,
            magnesiumMg: llmAliment.magnesiumMg,
            manganeseMg: llmAliment.manganeseMg,
            phosphorusMg: llmAliment.phosphorusMg,
            potassiumMg: llmAliment.potassiumMg,
            seleniumMicrog: llmAliment.seleniumMicrog,
            sodiumMg: llmAliment.sodiumMg,
            zincMg: llmAliment.zincMg,
            vitaminDMicrog: llmAliment.vitaminDMicrog,
            vitaminEMg: llmAliment.vitaminEMg,
            vitaminCMg: llmAliment.vitaminCMg,
            vitaminB1Mg: llmAliment.vitaminB1Mg,
            vitaminB2Mg: llmAliment.vitaminB2Mg,
            vitaminB3Mg: llmAliment.vitaminB3Mg,
            vitaminB5Mg: llmAliment.vitaminB5Mg,
            vitaminB6Mg: llmAliment.vitaminB6Mg,
            vitaminB9Microg: llmAliment.vitaminB9Microg,
            vitaminB12Microg: llmAliment.vitaminB12Microg,
            barcode: null,
            position: null,
            subgroupId: null,
            addedById: null,
        };
    }
    async updateActivityFromImputation(athleteId, activitiesMap, imputationDatas) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const activitiesArray = Array.from(activitiesMap.entries());
        if (activitiesArray.length !== imputationDatas.length) {
            throw new Error('Activities map and imputation data lengths do not match');
        }
        const dayDataMap = new Map();
        activitiesArray.forEach(([key], index) => {
            const imputationData = imputationDatas[index];
            const dayId = key.dayId;
            if (!dayDataMap.has(dayId)) {
                dayDataMap.set(dayId, {
                    healthData: {},
                    sleepData: {},
                    activities: [],
                });
            }
            const dayData = dayDataMap.get(dayId);
            if (imputationData.Stress !== undefined) {
                dayData.healthData.stressRating = 5 - imputationData.Stress;
            }
            if (imputationData['Fatigue__pre_event_'] !== undefined) {
                dayData.healthData.energyRating = 5 - imputationData['Fatigue__pre_event_'];
            }
            if (imputationData.Sleep !== undefined) {
                dayData.sleepData.qualityRating = imputationData.Sleep;
            }
            dayData.activities.push({
                activityId: key.activityId,
                imputationData,
            });
        });
        const updatePromises = Array.from(dayDataMap.entries()).map(async ([dayId, dayData]) => {
            for (const { activityId, imputationData } of dayData.activities) {
                if (activityId) {
                    const activity = await SportActivity.query()
                        .where('id', activityId)
                        .preload('day')
                        .first();
                    if (activity) {
                        const updateData = {};
                        const periodMetrics = Object.fromEntries(IMPUTATION_GPS_METRIC_BINDINGS.map(([sourceKey, metricName]) => [
                            metricName,
                            imputationData[sourceKey],
                        ]));
                        if (imputationData.Calories !== undefined) {
                            updateData.activeCalories = imputationData.Calories;
                        }
                        if (imputationData.Total_distance !== undefined) {
                            updateData.distance = imputationData.Total_distance;
                        }
                        if (imputationData.Session_duration !== undefined) {
                            updateData.durationSeconds = imputationData.Session_duration;
                        }
                        if (imputationData.RPE !== undefined) {
                            updateData.rpe = imputationData.RPE;
                        }
                        if (Object.keys(updateData).length > 0) {
                            await activity.merge(updateData).save();
                        }
                        let period = await Period.query().where('sportActivityId', activity.id).first();
                        if (!period &&
                            IMPUTATION_GPS_METRIC_BINDINGS.some(([sourceKey]) => {
                                const value = imputationData[sourceKey];
                                return value !== null && value !== undefined;
                            })) {
                            period = await Period.create({
                                sportActivityId: activity.id,
                                name: 'Imputation Activity',
                            });
                        }
                        if (period) {
                            await this.periodMetricService.updateMetrics(period.id, periodMetrics);
                        }
                    }
                }
            }
            if (Object.keys(dayData.healthData).length > 0) {
                const health = await HealthRating.query().where('dayId', dayId).first();
                if (health) {
                    await health.merge(dayData.healthData).save();
                }
                else {
                    await HealthRating.create({
                        dayId: dayId,
                        ...dayData.healthData,
                    });
                }
            }
            if (Object.keys(dayData.sleepData).length > 0) {
                const sleep = await Sleep.query().where('dayId', dayId).first();
                if (sleep) {
                    await sleep.merge(dayData.sleepData).save();
                }
                else {
                    await Sleep.create({
                        dayId: dayId,
                        dataSource: 'my_coach',
                        ...dayData.sleepData,
                    });
                }
            }
        });
        await Promise.all(updatePromises);
    }
    async updateTrainingLoadScoresFromMachineLearning(athleteId, daysMap, MLDatas) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const daysArray = Array.from(daysMap.entries());
        if (daysArray.length !== MLDatas.TL_load.length ||
            daysArray.length !== MLDatas.TL_high_intensity.length) {
            throw new Error('Days and MLDatas lengths do not match');
        }
        const daysRecords = await Day.query()
            .where('athleteId', athleteId)
            .whereIn('dateOfDay', daysArray.map(([date]) => date));
        const updatePromises = daysRecords.map(async (day, index) => {
            await this.dayMetricService.updateMetrics(day.id, {
                training_load: MLDatas.TL_load[index],
                training_load_high_intensity: MLDatas.TL_high_intensity[index],
            });
        });
        await Promise.all(updatePromises);
    }
    async addFeatureImportancesForDay(day, dayData, category) {
        const { top_features_activity_improve, top_features_health_improve, top_features_sleep_improve, optimal_features_activity, optimal_features_health, optimal_features_sleep, } = dayData;
        const allInsights = await Insight.all();
        const transformOptimalIntoFeatureImportance = (features, type, category) => {
            return features
                .map((feature) => {
                const insight = allInsights.find((insight) => insight.variableName === feature);
                if (!insight) {
                    return null;
                }
                return {
                    value: 100,
                    optimal: 100,
                    shapValue: 0,
                    dayId: day.id,
                    insightId: insight.id,
                    type,
                    category,
                };
            })
                .filter((feature) => feature !== null);
        };
        const transformTopIntoFeatureImportance = (features, type, category) => {
            return Object.entries(features)
                .map(([featureName, feature]) => {
                const insight = allInsights.find((insight) => insight.variableName === featureName);
                if (!insight || feature.value === null || feature.optimal === null) {
                    return null;
                }
                return {
                    value: feature.value,
                    optimal: feature.optimal,
                    shapValue: feature.shap_value,
                    dayId: day.id,
                    insightId: insight.id,
                    type,
                    category,
                };
            })
                .filter((feature) => feature !== null);
        };
        const optimalFeaturesActivity = transformOptimalIntoFeatureImportance(optimal_features_activity, 'activity', category);
        const optimalFeaturesHealth = transformOptimalIntoFeatureImportance(optimal_features_health, 'health', category);
        const optimalFeaturesSleep = transformOptimalIntoFeatureImportance(optimal_features_sleep, 'sleep', category);
        const topFeaturesActivity = transformTopIntoFeatureImportance(top_features_activity_improve, 'activity', category);
        const topFeaturesHealth = transformTopIntoFeatureImportance(top_features_health_improve, 'health', category);
        const topFeaturesSleep = transformTopIntoFeatureImportance(top_features_sleep_improve, 'sleep', category);
        await FeatureImportance.createMany([
            ...optimalFeaturesActivity,
            ...optimalFeaturesHealth,
            ...optimalFeaturesSleep,
            ...topFeaturesActivity,
            ...topFeaturesHealth,
            ...topFeaturesSleep,
        ]);
    }
    async updatePerformanceScoresFromMachineLearning(athleteId, daysMap, MLDatas) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const daysArray = Array.from(daysMap.entries());
        const daysRecords = await Day.query()
            .where('athleteId', athleteId)
            .whereIn('dateOfDay', daysArray.map(([date]) => date));
        const sanitizedMLDatas = typeof MLDatas === 'string'
            ? MLDatas.replace(/:\s*NaN\s*([,}])/g, ': null$1')
            : MLDatas;
        const parsedMLDatas = typeof sanitizedMLDatas === 'string' ? JSON.parse(sanitizedMLDatas) : sanitizedMLDatas;
        const updatePromises = daysRecords.map(async (day, index) => {
            const mlData = parsedMLDatas[index];
            await this.addFeatureImportancesForDay(day, mlData, 'performance');
            const updatedDay = await day
                .merge({
                performanceScore: mlData.performance_score,
            })
                .save();
            const chatbotReportService = new ChatbotReportService();
            await chatbotReportService.generateReportIfNeeded(athleteId, updatedDay, updatedDay.performanceScore, 'performance');
            return updatedDay;
        });
        await Promise.all(updatePromises);
    }
    async updateInjuryScoresFromMachineLearning(athleteId, daysMap, MLDatas) {
        const athlete = await Athlete.query().where('id', athleteId).first();
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        const daysArray = Array.from(daysMap.entries());
        const daysRecords = await Day.query()
            .where('athleteId', athleteId)
            .whereIn('dateOfDay', daysArray.map(([date]) => date));
        const sanitizedMLDatas = typeof MLDatas === 'string'
            ? MLDatas.replace(/:\s*NaN\s*([,}])/g, ': null$1')
            : MLDatas;
        const parsedMLDatas = typeof sanitizedMLDatas === 'string' ? JSON.parse(sanitizedMLDatas) : sanitizedMLDatas;
        const updatePromises = daysRecords.map(async (day, index) => {
            const mlData = parsedMLDatas[index];
            await this.addFeatureImportancesForDay(day, mlData, 'injury');
            const updatedDay = await day
                .merge({
                injuryRiskScore: mlData.Injury_score * 100,
            })
                .save();
            const chatbotReportService = new ChatbotReportService();
            await chatbotReportService.generateReportIfNeeded(athleteId, updatedDay, updatedDay.injuryRiskScore, 'injury');
            return updatedDay;
        });
        await Promise.all(updatePromises);
    }
    async getLastWeightAndBodyFatBeforeDate(athleteId, date) {
        const bodymetrics = await BodymetricsHistory.query()
            .where('athleteId', athleteId)
            .whereHas('day', (dayQuery) => {
            dayQuery.where('dateOfDay', '<=', date.toJSDate());
        })
            .preload('day');
        const orderedBodymetrics = bodymetrics.sort((a, b) => {
            return (b.day.dateOfDay?.toMillis() ?? 0) - (a.day.dateOfDay?.toMillis() ?? 0);
        });
        let lastWeight = null;
        let lastFatPercentage = null;
        for (const entry of orderedBodymetrics) {
            if (lastWeight === null && entry.weight !== null) {
                lastWeight = entry.weight;
            }
            if (lastFatPercentage === null && entry.fatPercentage !== null) {
                lastFatPercentage = entry.fatPercentage;
            }
            if (lastWeight !== null && lastFatPercentage !== null) {
                break;
            }
        }
        if (lastWeight === null || lastFatPercentage === null) {
            const athlete = await Athlete.find(athleteId);
            return {
                weight: lastWeight ?? athlete?.weightKg ?? null,
                fatPercentage: lastFatPercentage ?? athlete?.fatPercentage ?? null,
            };
        }
        return {
            weight: lastWeight,
            fatPercentage: lastFatPercentage,
        };
    }
    async buildMacroTargetsForDay(athlete, day, activities, weightliftingToday) {
        const referenceDate = day.dateOfDay ?? DateTime.now();
        const { weightKg } = await this.resolveNutritionWeightKg(athlete, referenceDate);
        const energy = await this.calculateDailyEnergyBreakdown(athlete, activities, day);
        const calendarEvents = await this.getCalendarEventsForDay(athlete, referenceDate);
        const isCompetitionDay = calendarEvents.some((event) => isCompetitionEvent(event));
        const competitionTomorrow = await this.hasCompetitionTomorrow(athlete, referenceDate);
        const dayType = activities.length > 0
            ? classifyDayFromEee(energy.eee, isCompetitionDay)
            : classifyDayFromCalendar(calendarEvents);
        return {
            energy,
            macroTargets: buildMacroTargets({
                weightKg,
                tdee: energy.tdee,
                dayType,
                competitionTomorrow,
                hasStrengthSession: weightliftingToday,
                isCompetitionDay,
            }),
        };
    }
    async getTodayActivities(athleteId, targetDate) {
        const athleteDay = await Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', targetDate)
            .preload('sportActivities', (sportActivitiesQuery) => {
            sportActivitiesQuery.preload('sport');
        })
            .first();
        if (!athleteDay) {
            return {
                activities: [],
                weightliftingToday: false,
                activityTypes: [],
            };
        }
        const activities = athleteDay.sportActivities;
        const activityTypes = activities.map((activity) => activity.sport?.name?.toLowerCase() || 'unknown');
        const weightliftingToday = activities.some(isStrengthActivity);
        return {
            activities,
            weightliftingToday,
            activityTypes,
        };
    }
    async calculateMacronutrientInsights(athlete, _fcMax, day, _days) {
        const activityData = await this.getTodayActivities(athlete.id, day.dateOfDay?.toFormat('yyyy-MM-dd') || '');
        const { macroTargets } = await this.buildMacroTargetsForDay(athlete, day, activityData.activities, activityData.weightliftingToday);
        return {
            glucides: {
                min: roundMacro(macroTargets.carbs.min),
                max: roundMacro(macroTargets.carbs.max),
            },
            lipides: {
                min: roundMacro(macroTargets.fat.min),
                max: roundMacro(macroTargets.fat.max),
            },
            proteines: {
                min: roundMacro(macroTargets.protein.min),
                max: roundMacro(macroTargets.protein.max),
            },
            nutri_score: {
                min_necessary: 0,
                glucides_consommes_total: 0,
            },
        };
    }
    async getLatestFCMax(_athleteId, _targetDate) {
        return null;
    }
    async getLatestFCMin(_athleteId, _targetDate) {
        return null;
    }
    async getFcMax(athlete, day) {
        const athleteId = athlete.id;
        const targetDate = day?.dateOfDay?.toJSDate() || DateTime.now().toJSDate();
        const latestFcMax = await this.getLatestFCMax(athleteId, targetDate);
        if (latestFcMax && latestFcMax !== 0) {
            return latestFcMax;
        }
        if (athlete.fcMax && athlete.fcMax !== 0) {
            return athlete.fcMax;
        }
        if (athlete.birthDate) {
            const birthDate = athlete.birthDate instanceof Date
                ? DateTime.fromJSDate(athlete.birthDate)
                : athlete.birthDate;
            const age = Math.floor(DateTime.now().diff(birthDate, 'years').years);
            return 220 - age;
        }
        return 200;
    }
    async getFcMin(athlete, day) {
        const athleteId = athlete.id;
        const targetDate = day?.dateOfDay?.toJSDate() || DateTime.now().toJSDate();
        const latestFcMin = await this.getLatestFCMin(athleteId, targetDate);
        if (latestFcMin && latestFcMin !== 0) {
            return latestFcMin;
        }
        if (athlete.fcMin && athlete.fcMin !== 0) {
            return athlete.fcMin;
        }
        return null;
    }
    getZone(heartRate, hrMax, hrMin) {
        const percentageOfHRMax = heartRate / hrMax;
        const percentageOfHRR = hrMin !== null ? (heartRate - hrMin) / (hrMax - hrMin) : percentageOfHRMax;
        const useHRR = hrMin !== null;
        if (useHRR) {
            if (percentageOfHRR < 0.6)
                return 1;
            if (percentageOfHRR < 0.75)
                return 2;
            if (percentageOfHRR < 0.85)
                return 3;
            if (percentageOfHRR < 0.92)
                return 4;
            return 5;
        }
        else {
            if (percentageOfHRMax < 0.6)
                return 1;
            if (percentageOfHRMax < 0.75)
                return 2;
            if (percentageOfHRMax < 0.85)
                return 3;
            if (percentageOfHRMax < 0.92)
                return 4;
            return 5;
        }
    }
    async calculateZoneDistributions(heartRateData, athlete, day, fcMax, fcMin) {
        const zoneTimes = [0, 0, 0, 0, 0];
        const max = fcMax ?? (await this.getFcMax(athlete, day));
        const min = fcMin ?? (await this.getFcMin(athlete, day));
        for (const heartRate of heartRateData) {
            if (heartRate && heartRate > 0) {
                const zone = this.getZone(heartRate, max, min);
                if (zone >= 1 && zone <= 5) {
                    zoneTimes[zone - 1]++;
                }
            }
        }
        return {
            zone1: zoneTimes[0],
            zone2: zoneTimes[1],
            zone3: zoneTimes[2],
            zone4: zoneTimes[3],
            zone5: zoneTimes[4],
        };
    }
    async calculateActivityZones(activity, athlete, day, fcMax, fcMin) {
        const period = activity.periods?.[0];
        if (period) {
            const zoneMetrics = this.periodMetricService.extractNumericMetricsAsObject(period, ZONE_TIME_PERIOD_METRICS);
            if (ZONE_TIME_PERIOD_METRICS.some((metric) => zoneMetrics[metric] !== null)) {
                return Object.fromEntries(ZONE_TIME_PERIOD_METRICS.map((metric, index) => [
                    `zone${index + 1}`,
                    (zoneMetrics[metric] ?? 0) * 1_000_000,
                ]));
            }
        }
        let heartRateData = null;
        let secondsPerSample = 60 / DEFAULT_HEART_RATE_SAMPLES_PER_MINUTE;
        try {
            let periods = activity.periods;
            if (!periods || periods.length === 0 || !periods[0]?.series) {
                const activityWithPeriods = await SportActivity.query()
                    .where('id', activity.id)
                    .preload('periods', (query) => {
                    query
                        .preload('series')
                        .preload('metricValues', (metricValuesQuery) => metricValuesQuery.preload('metric'));
                })
                    .first();
                if (activityWithPeriods) {
                    periods = activityWithPeriods.periods;
                }
            }
            if (periods && periods.length > 0) {
                for (const period of periods) {
                    if (!period.series || period.series.length === 0)
                        continue;
                    for (const serie of period.series) {
                        if (serie.type !== SERIE_TYPE.HEART_RATE) {
                            continue;
                        }
                        try {
                            const payload = decodeJsonPayload(serie.dataEncoded);
                            const points = parsedPointSeries(payload.points ?? [], 'hr').filter((point) => point.value > 0);
                            if (points.length === 0)
                                continue;
                            heartRateData = points.map((point) => point.value);
                            if (points.length >= 2) {
                                const intervals = points
                                    .slice(1)
                                    .map((point, index) => point.ts - points[index].ts)
                                    .filter((delta) => delta > 0);
                                if (intervals.length > 0) {
                                    secondsPerSample =
                                        intervals.reduce((sum, delta) => sum + delta, 0) / intervals.length;
                                }
                            }
                            break;
                        }
                        catch (error) {
                            console.error(`Error decoding series ${serie.id} of type ${serie.type}:`, error);
                        }
                    }
                    if (heartRateData) {
                        break;
                    }
                }
            }
        }
        catch (error) {
            console.error('Error extracting heart rate data from periods:', error);
        }
        if (!heartRateData || heartRateData.length === 0) {
            return null;
        }
        try {
            const zoneCounts = await this.calculateZoneDistributions(heartRateData, athlete, day, fcMax, fcMin);
            const zoneTimes = {
                zone1: zoneCounts.zone1 * secondsPerSample * 1_000_000,
                zone2: zoneCounts.zone2 * secondsPerSample * 1_000_000,
                zone3: zoneCounts.zone3 * secondsPerSample * 1_000_000,
                zone4: zoneCounts.zone4 * secondsPerSample * 1_000_000,
                zone5: zoneCounts.zone5 * secondsPerSample * 1_000_000,
            };
            return zoneTimes;
        }
        catch (error) {
            console.error('Error calculating activity zones:', error);
            return null;
        }
    }
    async enrichActivitiesWithZones(athlete) {
        if (!athlete.days)
            return athlete;
        const zonePromises = athlete.days.map(async (day) => {
            if (!day.sportActivities)
                return;
            const fcMax = await this.getFcMax(athlete, day);
            const fcMin = await this.getFcMin(athlete, day);
            const activityPromises = day.sportActivities.map(async (activity) => {
                const zones = await this.calculateActivityZones(activity, athlete, day, fcMax, fcMin);
                if (zones) {
                    Object.assign(activity, { zones });
                }
            });
            await Promise.all(activityPromises);
        });
        await Promise.all(zonePromises);
        return athlete;
    }
}
//# sourceMappingURL=athlete_service.js.map