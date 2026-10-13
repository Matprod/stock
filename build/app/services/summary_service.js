import { DateTime } from 'luxon';
import AiSummary from '#models_pg/ai_summary';
import SportActivity from '#models_pg/sport_activity';
import Prompt from '#models_pg/prompt';
import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service';
import AthleteService from '#services/athlete_service';
import DayService from '#services/day_service';
import { SportActivityService } from '#services/sport_activity_service';
import Nutrition from '#models_pg/nutrition';
import Sleep from '#models_pg/sleep';
import { avg, avgMinutesToTime, formatHoursToHhMm, parseMicrosecondsToDuration, parseSecondsToDuration, } from '../utils/time.js';
import { APP_LANGUAGES, parseAppLanguage } from '#utils/localize';
import { encode } from '@toon-format/toon';
import HealthPain from '#models_pg/health_pain';
import SportActivityPain from '#models_pg/sport_activity_pain';
import { SUBJECTIVE_DISPLAY_CONTEXT, SUBJECTIVE_VARIABLE_DOMAIN, } from '#contracts/subjective_variable';
import { JOURNAL_MEAL_TYPES, NUTRITION_SUMMARY_MAX_GENERATIONS_PER_DAY, NUTRITION_SUMMARY_MIN_FILLED_MEALS, } from '#constants/nutrition.constants';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
export default class SummaryService {
    athleteService;
    claude35SonnetService;
    dayService;
    sportActivityService;
    subjectiveScaleService;
    constructor() {
        this.athleteService = new AthleteService();
        this.claude35SonnetService = new Claude35SonnetService();
        this.dayService = new DayService();
        this.sportActivityService = new SportActivityService();
        this.subjectiveScaleService = new SubjectiveScaleService();
    }
    async getSubjectiveScaleMap(clubId, language, filter) {
        return await this.subjectiveScaleService.getClubCatalogueMap(clubId, language, filter);
    }
    formatSubjectiveScore(value, scale) {
        if (value === null || value === undefined)
            return 'N/A';
        return scale ? `${value}/${scale.max}` : String(value);
    }
    async getPrompt(title) {
        const prompt = await Prompt.findByOrFail('title', title);
        return prompt.content;
    }
    async getAthleteWithLanguage(athleteId, date) {
        const athlete = await this.athleteService.getAthleteWithDetails({
            athleteId,
            days: 7,
            startDate: date,
        });
        if (!athlete) {
            throw new Error('Athlete not found');
        }
        return { athlete, language: athlete.appLanguageOrDefault };
    }
    fillPromptTemplate(template, values) {
        return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, value), template);
    }
    withScaleReference(reference, content) {
        return `${reference}\n\n${content}`;
    }
    normalizeEntityId(entityId) {
        if (!entityId || entityId === '0') {
            return null;
        }
        return entityId;
    }
    async findExistingSummary(params) {
        const { entityType, dayId, entityId } = params;
        const normalizedEntityId = this.normalizeEntityId(entityId);
        if (normalizedEntityId) {
            return AiSummary.query()
                .where('entityId', normalizedEntityId)
                .where('entityType', entityType)
                .where('dayId', dayId)
                .first();
        }
        return AiSummary.query()
            .whereNull('entityId')
            .where('entityType', entityType)
            .where('dayId', dayId)
            .first();
    }
    async saveOrUpdateSummary(summaryText, entityType, dayId, existingSummary, entityId) {
        const normalizedEntityId = this.normalizeEntityId(entityId);
        if (existingSummary) {
            existingSummary.summary = summaryText;
            existingSummary.entityId = normalizedEntityId;
            await existingSummary.save();
            return existingSummary;
        }
        return AiSummary.create({
            entityId: normalizedEntityId,
            entityType,
            dayId,
            summary: summaryText,
        });
    }
    async generateSummaryText(systemPromptTitle, dataPrompt, language, introText) {
        const promptWithLanguage = `Réponds en ${language}, ${dataPrompt}`;
        const systemPrompt = await this.getPrompt(systemPromptTitle);
        const finalPrompt = introText ? `${introText}${promptWithLanguage}` : promptWithLanguage;
        return this.claude35SonnetService.generateResponse({
            systemPrompt,
            dataPrompt,
            prompt: finalPrompt,
            history: [],
            responseFormat: 'text',
        });
    }
    formatActivityDetails(params) {
        const { activity, includeZones = false, includePain = false, includeExtendedMetrics = false, language = APP_LANGUAGES.EN, subjectiveScaleById, } = params;
        const activitySubjectiveLines = [...(subjectiveScaleById?.values() ?? [])]
            .filter((scale) => scale.domain === SUBJECTIVE_VARIABLE_DOMAIN.SPORT_ACTIVITY)
            .map((scale) => {
            const value = activity[scale.fieldName];
            const label = scale.label || scale.fieldName;
            const numericValue = typeof value === 'number' ? value : null;
            return `${label}: ${this.formatSubjectiveScore(numericValue, scale)}`;
        });
        const duration = parseSecondsToDuration(activity.durationSeconds);
        const zones = includeZones && activity.zones
            ? language === APP_LANGUAGES.FR
                ? `Zones de frequence cardiaque: ${parseMicrosecondsToDuration(activity.zones.zone1)} en zone1, ${parseMicrosecondsToDuration(activity.zones.zone2)} en zone2, ${parseMicrosecondsToDuration(activity.zones.zone3)} en zone3, ${parseMicrosecondsToDuration(activity.zones.zone4)} en zone4, ${parseMicrosecondsToDuration(activity.zones.zone5)} en zone5`
                : `Heart Rate Zones: ${parseMicrosecondsToDuration(activity.zones.zone1)} in zone1, ${parseMicrosecondsToDuration(activity.zones.zone2)} in zone2, ${parseMicrosecondsToDuration(activity.zones.zone3)} in zone3, ${parseMicrosecondsToDuration(activity.zones.zone4)} in zone4, ${parseMicrosecondsToDuration(activity.zones.zone5)} in zone5`
            : includeZones && !activity.zones
                ? language === APP_LANGUAGES.FR
                    ? 'Aucune zone'
                    : 'No zones'
                : '';
        const basketballInfo = this.extractBasketballInfo(activity);
        if (activity.dataSource === 'api_basket' && basketballInfo) {
            return `${activity.sport?.name || 'Basketball'} ${language === APP_LANGUAGES.FR ? 'Match' : 'Match'} - ${language === APP_LANGUAGES.FR ? 'Duree' : 'Duration'}: ${duration}${basketballInfo}`;
        }
        const details = [
            `${activity.sport?.name || (language === APP_LANGUAGES.FR ? 'Inconnu' : 'Unknown')}: ${duration} ${language === APP_LANGUAGES.FR ? 'de duree' : 'duration'}`,
            `${activity.distance || 'N/A'} distance`,
            ...activitySubjectiveLines,
            `Training Load: ${activity.trainingLoad || 'N/A'}`,
            `Fitness Level: ${activity.fitnessLevel || 'N/A'}`,
            includeZones && zones ? `Zones: ${zones}` : '',
            includeExtendedMetrics ? `Power: ${activity.power ?? 'N/A'} W` : '',
            includeExtendedMetrics ? `Elevation: ${activity.elevation ?? 'N/A'} m` : '',
            includeExtendedMetrics ? `Average BPM: ${activity.averagedBpm || 'N/A'}` : '',
            includeExtendedMetrics ? `Active Calories: ${activity.activeCalories || 'N/A'}` : '',
            includeExtendedMetrics ? `Average Pace: ${activity.speed || 'N/A'}` : '',
            includePain
                ? `Pain/Discomfort During Activity: ${this.formatPainInfo(activity.sportActivityPains ?? [], language)}`
                : '',
        ]
            .filter(Boolean)
            .join(', ');
        return details;
    }
    extractBasketballInfo(activity) {
        if (activity.dataSource !== 'api_basket' || !activity.periods?.length)
            return '';
        const period = activity.periods[0];
        const metricValues = (period.metricValues || []);
        const metrics = Object.fromEntries(metricValues.filter((mv) => mv.metric?.name).map((mv) => [mv.metric.name, mv.value]));
        const get = (key) => metrics[key] ?? 'N/A';
        const basketballStats = [
            `\n BASKETBALL MATCH STATISTICS:`,
            `  Match: ${period.name || 'N/A'}`,
            `  Result: ${get('basketball_match_result')}`,
            `  Performance Metrics:`,
            `    - Points Scored: ${get('basketball_points')} points`,
            `    - Minutes Played: ${get('basketball_minutes')} minutes`,
            `    - Field Goals: ${get('basketball_2pm')} two-pointers made, ${get('basketball_3pm')} three-pointers made`,
            `    - Free Throws: ${get('basketball_ftm')} made`,
            `    - Assists: ${get('basketball_assists')}`,
            `    - Rebounds: ${get('basketball_rebounds')}`,
            `    - Jumps: ${get('basketball_jumps')}`,
        ].join('\n');
        return basketballStats;
    }
    formatRecentActivities(athlete, includeZones = false, subjectiveScaleById) {
        return athlete
            .days.map((day) => {
            const activities = day
                .sportActivities.map((activity) => {
                const details = this.formatActivityDetails({
                    activity,
                    includeZones,
                    subjectiveScaleById,
                });
                return `- ${details}`;
            })
                .join('\n');
            return `Date: ${day.dateOfDay?.toISODate()}\nActivities: ${activities}`;
        })
            .join('\n\n');
    }
    formatExerciseSetLine(set) {
        const parts = [];
        if (set.reps !== null && set.reps !== undefined)
            parts.push(`${set.reps} reps`);
        if (set.weight !== null && set.weight !== undefined)
            parts.push(`${set.weight} kg`);
        if (set.durationSeconds)
            parts.push(parseSecondsToDuration(set.durationSeconds));
        return parts.length ? parts.join(', ') : 'N/A';
    }
    formatActivityExerciseSets(activity, _language) {
        const sets = [...(activity.exerciseSets ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.setOrder ?? 0) - (b.setOrder ?? 0));
        if (!sets.length)
            return 'No exercises logged.';
        const byExercise = new Map();
        for (const set of sets) {
            const exercise = set.exercise;
            const name = exercise?.name ?? `Exercise #${set.exerciseId}`;
            const key = name ?? `Exercise #${set.exerciseId}`;
            const exerciseSets = byExercise.get(key) ?? [];
            exerciseSets.push(set);
            byExercise.set(key, exerciseSets);
        }
        return [...byExercise.entries()]
            .map(([name, exerciseSets]) => {
            const setLines = exerciseSets.map((set, index) => `  Set ${index + 1}: ${this.formatExerciseSetLine(set)}`);
            return `${name}\n${setLines.join('\n')}`;
        })
            .join('\n');
    }
    async getStrengthExerciseContext(athleteId, date, activityId, language) {
        const todayActivity = await SportActivity.query()
            .where('id', activityId)
            .whereHas('sport', (sportQuery) => {
            sportQuery.whereILike('name', '%musculation%').orWhereILike('name', '%reinforcement%');
        })
            .preload('sport')
            .preload('exerciseSets', (query) => {
            query.preload('exercise').orderBy('order', 'asc').orderBy('setOrder', 'asc');
        })
            .first();
        if (!todayActivity) {
            return 'Not applicable for this activity type.';
        }
        const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd');
        const priorActivities = await SportActivity.query()
            .where('id', '!=', activityId)
            .whereHas('exerciseSets', (setsQuery) => setsQuery)
            .whereHas('sport', (sportQuery) => {
            sportQuery.whereILike('name', '%musculation%').orWhereILike('name', '%reinforcement%');
        })
            .whereHas('day', (dayQuery) => {
            dayQuery
                .where('athleteId', athleteId)
                .where('dateOfDay', '>=', targetDate.minus({ days: 7 }).toJSDate())
                .where('dateOfDay', '<=', targetDate.toJSDate());
        })
            .preload('sport')
            .preload('day')
            .preload('exerciseSets', (query) => {
            query.preload('exercise').orderBy('order', 'asc').orderBy('setOrder', 'asc');
        });
        priorActivities.sort((a, b) => {
            const dateA = a.day?.dateOfDay?.toMillis() ?? 0;
            const dateB = b.day?.dateOfDay?.toMillis() ?? 0;
            return dateB - dateA;
        });
        const todayBlock = `Today's session:\n${this.formatActivityExerciseSets(todayActivity, language)}`;
        if (!priorActivities.length) {
            return `${todayBlock}\n\nNo prior strength sessions with logged exercises in the last 7 days.`;
        }
        const priorBlock = priorActivities
            .map((activity) => {
            const sessionDate = activity.day?.dateOfDay?.toISODate() ?? 'Unknown date';
            return `Session on ${sessionDate}:\n${this.formatActivityExerciseSets(activity, language)}`;
        })
            .join('\n\n');
        return `${todayBlock}\n\nRecent prior strength sessions:\n${priorBlock}`;
    }
    async getLast7DaysSleepData(athleteId, date) {
        const targetDate = DateTime.fromFormat(date, 'yyyy-MM-dd');
        const sevenDaysAgo = targetDate.minus({ days: 7 }).toJSDate();
        const endDate = targetDate.toJSDate();
        const last7Days = await this.dayService.getDaysByDateRange(athleteId, sevenDaysAgo, endDate, ['sleeps'], { orderBy: 'desc' });
        return last7Days.flatMap((day) => {
            const sleep = day.sleeps?.[0];
            if (!sleep)
                return [];
            return [
                {
                    date: day.dateOfDay?.toISODate(),
                    qualityRating: sleep.qualityRating,
                    bedtimeDate: sleep.bedtimeDate,
                    wakeUpDate: sleep.wakeUpDate,
                    durationHours: sleep.durationHours,
                    sleepEfficiencyPercentage: sleep.sleepEfficiencyPercentage,
                    totalInBedTimeMilli: sleep.totalInBedTimeMilli
                        ? (sleep.totalInBedTimeMilli * 1000 -
                            (sleep.napAm ? sleep.napAm : 0) -
                            (sleep.napPm ? sleep.napPm : 0)) /
                            1000
                        : 0,
                    totalAwakeTimeMilli: sleep.totalAwakeTimeMilli,
                    baselineMili: sleep.baselineMili,
                    totalRemSleepTimeMilli: sleep.totalRemSleepTimeMilli,
                    totalSlowWaveSleepTimeMilli: sleep.totalSlowWaveSleepTimeMilli,
                    napAm: sleep.napAm,
                    napPm: sleep.napPm,
                },
            ];
        });
    }
    async getLast7DaysMealNames(athleteId, nutrition) {
        const mealNamesPromises = nutrition.dailyMacros.map(async (dayData) => {
            const dateKey = dayData.date;
            const mealNames = [];
            let dayRecord = null;
            try {
                dayRecord = await this.dayService.getDayByDate(dateKey, athleteId, ['nutrition']);
            }
            catch {
            }
            if (dayRecord && dayRecord.nutrition) {
                const dayMealNames = dayRecord.nutrition
                    .map((nutrition) => nutrition.mealName)
                    .filter((name) => Boolean(name));
                mealNames.push(...dayMealNames);
            }
            return { dateKey, mealNames };
        });
        const results = await Promise.all(mealNamesPromises);
        const last7DaysMeals = {};
        results.forEach(({ dateKey, mealNames }) => {
            last7DaysMeals[dateKey] = mealNames;
        });
        return last7DaysMeals;
    }
    formatPainInfo(pains, language = APP_LANGUAGES.EN) {
        const normalizedLanguage = parseAppLanguage(language) ?? APP_LANGUAGES.EN;
        if (!pains || pains.length === 0) {
            return normalizedLanguage === APP_LANGUAGES.FR ? 'Aucune' : 'None';
        }
        return pains
            .map((pain) => {
            const locationName = pain.location?.name ??
                (normalizedLanguage === APP_LANGUAGES.FR ? 'Localisation inconnue' : 'Unknown location');
            return `${locationName}: ${pain.rating}/5`;
        })
            .join(', ');
    }
    shouldRegenerateSummary(existingSummary, sourceUpdatedAt) {
        if (!existingSummary)
            return true;
        if (!sourceUpdatedAt || !existingSummary.updatedAt)
            return false;
        const sourceDate = sourceUpdatedAt instanceof DateTime ? sourceUpdatedAt.toJSDate() : sourceUpdatedAt;
        const summaryDate = existingSummary.updatedAt instanceof DateTime
            ? existingSummary.updatedAt.toJSDate()
            : existingSummary.updatedAt;
        return sourceDate > summaryDate;
    }
    async getDayNutritionEntries(dayId) {
        return Nutrition.query()
            .where('dayId', dayId)
            .preload('aliment')
            .preload('llmAliment')
            .preload('recipe', (recipeQuery) => {
            recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
                recipeAlimentsQuery.preload('meal');
            });
        });
    }
    countFilledJournalMeals(nutritionEntries) {
        const filledMealTypes = new Set();
        for (const entry of nutritionEntries) {
            if (!entry.mealType)
                continue;
            if (entry.mealType.trim().toLowerCase().includes('snack')) {
                filledMealTypes.add('Snack');
                continue;
            }
            if (JOURNAL_MEAL_TYPES.includes(entry.mealType)) {
                filledMealTypes.add(entry.mealType);
            }
        }
        return filledMealTypes.size;
    }
    getMostRecentNutritionUpdate(nutritionEntries) {
        return nutritionEntries.reduce((latest, entry) => {
            if (!entry.updatedAt)
                return latest;
            if (!latest)
                return entry.updatedAt;
            const latestTime = latest instanceof DateTime ? latest.toMillis() : new Date(latest).getTime();
            const entryTime = entry.updatedAt.toMillis();
            return entryTime > latestTime ? entry.updatedAt : latest;
        }, null);
    }
    async countNutritionSummariesForDay(dayId) {
        const [row] = await AiSummary.query()
            .where('dayId', dayId)
            .where('entityType', 'nutrition')
            .whereNull('entityId')
            .count('* as total');
        return Number(row?.$extras.total ?? 0);
    }
    async findLatestNutritionSummary(dayId) {
        return AiSummary.query()
            .where('dayId', dayId)
            .where('entityType', 'nutrition')
            .whereNull('entityId')
            .orderBy('createdAt', 'desc')
            .first();
    }
    buildNutritionSummaryMeta(nutritionEntries, latestSummary, generationCount) {
        const filledMealsCount = this.countFilledJournalMeals(nutritionEntries);
        const canGenerate = filledMealsCount >= NUTRITION_SUMMARY_MIN_FILLED_MEALS;
        const hasSummary = latestSummary != null;
        const nutritionChanged = this.shouldRegenerateSummary(latestSummary, this.getMostRecentNutritionUpdate(nutritionEntries));
        const underGenerationLimit = generationCount < NUTRITION_SUMMARY_MAX_GENERATIONS_PER_DAY;
        const canRegenerate = canGenerate && underGenerationLimit && (!hasSummary || nutritionChanged);
        return {
            filledMealsCount,
            generationCount,
            maxGenerations: NUTRITION_SUMMARY_MAX_GENERATIONS_PER_DAY,
            canGenerate,
            canRegenerate,
            hasSummary,
        };
    }
    async getNutritionSummaryMeta(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId);
        const nutritionEntries = await this.getDayNutritionEntries(day.id);
        const [latestSummary, generationCount] = await Promise.all([
            this.findLatestNutritionSummary(day.id),
            this.countNutritionSummariesForDay(day.id),
        ]);
        return this.buildNutritionSummaryMeta(nutritionEntries, latestSummary, generationCount);
    }
    async generateActivitySummary(params) {
        const { entityId, date, athleteId, is_delete } = params;
        let dayId;
        let existingSummary = null;
        if (entityId && entityId !== '0') {
            const sportActivity = await this.sportActivityService.getSportActivityById(entityId);
            dayId = sportActivity.dayId;
            existingSummary = await this.findExistingSummary({
                entityType: 'activity',
                dayId,
                entityId,
            });
        }
        else {
            const day = await this.dayService.getDayByDate(date, athleteId);
            dayId = day.id;
            existingSummary = await this.findExistingSummary({
                entityType: 'activity',
                dayId,
                entityId: null,
            });
        }
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const athleteWithZones = await this.athleteService.enrichActivitiesWithZones(athlete);
        const nutrition = await this.athleteService.getLastSevenDaysMacros(athleteId, date);
        let shouldRegenerate = true;
        if (is_delete) {
            shouldRegenerate = true;
        }
        else if (existingSummary) {
            if (entityId) {
                const sportActivity = await this.sportActivityService.getSportActivityById(entityId);
                const activityUpdatedAt = sportActivity.updatedAt || sportActivity.createdAt;
                shouldRegenerate = this.shouldRegenerateSummary(existingSummary, activityUpdatedAt);
            }
            else {
                const day = await this.dayService.getDayByDate(date, athleteId, ['sportActivities']);
                if (day && day.sportActivities && day.sportActivities.length > 0) {
                    const mostRecentActivity = day.sportActivities.reduce((latest, activity) => {
                        const activityTime = activity.updatedAt || activity.createdAt;
                        const latestTime = latest.updatedAt || latest.createdAt;
                        return activityTime && latestTime && activityTime > latestTime ? activity : latest;
                    });
                    const activityUpdatedAt = mostRecentActivity.updatedAt || mostRecentActivity.createdAt;
                    shouldRegenerate = this.shouldRegenerateSummary(existingSummary, activityUpdatedAt);
                    if (!shouldRegenerate) {
                        const activityIds = day.sportActivities.map((activity) => activity.id);
                        const mostRecentPain = await SportActivityPain.query()
                            .whereIn('sportActivityId', activityIds)
                            .orderBy('updatedAt', 'desc')
                            .first();
                        if (mostRecentPain) {
                            shouldRegenerate = this.shouldRegenerateSummary(existingSummary, mostRecentPain.updatedAt);
                        }
                    }
                }
                else {
                    shouldRegenerate = false;
                }
            }
        }
        if (!shouldRegenerate && existingSummary) {
            return existingSummary;
        }
        const prompt = entityId
            ? await this.buildSpecificActivitySummaryPrompt({
                athlete: athleteWithZones,
                nutrition,
                date,
                activityId: entityId,
            })
            : await this.buildDayLevelActivitySummaryPrompt({
                athlete: athleteWithZones,
                date,
                nutrition,
            });
        const summaryText = await this.generateSummaryText('activity_system_prompt', prompt, language);
        return this.saveOrUpdateSummary(summaryText, 'activity', dayId, existingSummary, entityId);
    }
    async generateNutritionSummary(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId);
        const nutritionEntries = await this.getDayNutritionEntries(day.id);
        const [latestSummary, generationCount] = await Promise.all([
            this.findLatestNutritionSummary(day.id),
            this.countNutritionSummariesForDay(day.id),
        ]);
        const meta = this.buildNutritionSummaryMeta(nutritionEntries, latestSummary, generationCount);
        if (!meta.canGenerate) {
            throw new Error(`Complete at least ${NUTRITION_SUMMARY_MIN_FILLED_MEALS} meals to generate AI insights.`);
        }
        if (latestSummary && !meta.canRegenerate) {
            return latestSummary;
        }
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const nutrition = await this.athleteService.getLastSevenDaysMacros(athleteId, date);
        const last7DaysMeals = await this.getLast7DaysMealNames(athleteId, nutrition);
        const prompt = await this.buildNutritionSummaryPrompt({
            athlete,
            nutrition,
            last7DaysMeals,
            date,
        });
        const summaryText = await this.generateSummaryText('nutrition_system_prompt', prompt, language, "Please provide a concise summary of this athlete's data. ");
        return AiSummary.create({
            entityId: null,
            entityType: 'nutrition',
            dayId: day.id,
            summary: summaryText,
        });
    }
    async generateHealthSummary(params) {
        const { date, athleteId, is_delete } = params;
        const day = await this.dayService.getDayByDate(date, athleteId, ['health']);
        await day.load('health', (healthQuery) => {
            healthQuery.preload('pains');
        });
        const existingSummary = await this.findExistingSummary({
            entityType: 'health',
            dayId: day.id,
            entityId: day.health?.id,
        });
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const healthData = day.health;
        const hasMandatoryFields = healthData &&
            healthData.moodRating !== null &&
            healthData.energyRating !== null &&
            healthData.stressRating !== null;
        if (!hasMandatoryFields) {
            throw new Error('Please complete all mandatory health fields (mood, energy, and stress) to generate AI insights.');
        }
        let shouldRegenerate = false;
        if (existingSummary && healthData && !is_delete) {
            const [mostRecentPain, mostRecentActivity] = await Promise.all([
                HealthPain.query().where('healthId', healthData.id).orderBy('updatedAt', 'desc').first(),
                SportActivity.query().where('dayId', healthData.dayId).orderBy('updatedAt', 'desc').first(),
            ]);
            const updateTimestamps = [mostRecentPain?.updatedAt, mostRecentActivity?.updatedAt].filter(Boolean);
            if (updateTimestamps.length > 0) {
                const mostRecentUpdate = updateTimestamps.reduce((latest, current) => {
                    if (!latest)
                        return current;
                    if (!current)
                        return latest;
                    const latestTime = latest instanceof Date ? latest.getTime() : latest.toMillis();
                    const currentTime = current instanceof Date ? current.getTime() : current.toMillis();
                    return currentTime > latestTime ? current : latest;
                });
                shouldRegenerate = this.shouldRegenerateSummary(existingSummary, mostRecentUpdate);
            }
        }
        else {
            shouldRegenerate = true;
        }
        if (!shouldRegenerate && existingSummary) {
            return existingSummary;
        }
        const last7DaysSleepData = await this.getLast7DaysSleepData(athleteId, date);
        const activityScales = await this.getSubjectiveScaleMap(athlete.clubId, athlete.appLanguageOrDefault, { context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY });
        const recentActivities = this.formatRecentActivities(athlete, false, activityScales);
        const prompt = await this.buildHealthSummaryPrompt({
            athlete,
            healthData,
            last7DaysSleepData,
            activityData: recentActivities,
            date,
        });
        const summaryText = await this.generateSummaryText('health_system_prompt', prompt, language, "Please provide a concise summary of this athlete's health data. ");
        return this.saveOrUpdateSummary(summaryText, 'health', day.id, existingSummary, healthData.id);
    }
    async generateSleepSummary(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId);
        const sleepData = await this.athleteService.getSleepData(athleteId, date);
        if (!sleepData ||
            !sleepData.bedtimeDate ||
            !sleepData.wakeUpDate ||
            sleepData.qualityRating === null) {
            throw new Error('Complete your sleep data (bedtime, wake time, and quality rating) to generate AI insights.');
        }
        const existingSummary = await this.findExistingSummary({
            entityType: 'sleep',
            dayId: day.id,
            entityId: sleepData.id,
        });
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const shouldRegenerate = this.shouldRegenerateSummary(existingSummary, sleepData.updatedAt || sleepData.createdAt);
        if (!shouldRegenerate && existingSummary) {
            return existingSummary;
        }
        const prompt = await this.buildSleepSummaryPrompt({
            athlete,
            sleepData,
            date,
            day,
        });
        const summaryText = await this.generateSummaryText('sleep_system_prompt', prompt, language, "Please provide a concise summary of this athlete's data. ");
        return this.saveOrUpdateSummary(summaryText, 'sleep', day.id, existingSummary, sleepData.id);
    }
    async getActivitySummary(params) {
        const { entityId, date, athleteId } = params;
        if (entityId) {
            const sportActivity = await this.sportActivityService.getSportActivityById(entityId);
            if (!sportActivity.durationSeconds || !sportActivity.rpe) {
                throw new Error('Complete activity data (duration and all RPE fields) to generate AI insights.');
            }
            let summary = await AiSummary.query()
                .where('entityId', entityId)
                .where('entityType', 'activity')
                .first();
            if (summary)
                return summary;
            const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
            const athleteWithZones = await this.athleteService.enrichActivitiesWithZones(athlete);
            const nutrition = await this.athleteService.getLastSevenDaysMacros(athleteId, date);
            const prompt = await this.buildSpecificActivitySummaryPrompt({
                athlete: athleteWithZones,
                nutrition,
                date,
                activityId: entityId,
            });
            const summaryText = await this.generateSummaryText('activity_system_prompt', prompt, language, "Please provide a concise summary of this athlete's activity data. ");
            return AiSummary.create({
                entityId,
                entityType: 'activity',
                dayId: sportActivity.dayId,
                summary: summaryText,
            });
        }
        else {
            const day = await this.dayService.getDayByDate(date, athleteId);
            const activities = await SportActivity.query()
                .where('dayId', day.id)
                .whereNotNull('durationSeconds')
                .whereNotNull('rpe')
                .preload('sport')
                .preload('periods', (periodsQuery) => {
                periodsQuery.preload('metricValues', (metricValuesQuery) => {
                    metricValuesQuery.preload('metric');
                });
            });
            if (activities.length === 0 || !activities.some((activity) => activity.rpe)) {
                throw new Error('Complete activity data (duration and all RPE fields) to generate AI insights.');
            }
            let summary = await this.findExistingSummary({
                entityType: 'activity',
                dayId: day.id,
                entityId: null,
            });
            if (summary)
                return summary;
            const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
            const nutrition = await this.athleteService.getLastSevenDaysMacros(athleteId, date);
            const prompt = await this.buildDayLevelActivitySummaryPrompt({ athlete, date, nutrition });
            const summaryText = await this.generateSummaryText('activity_system_prompt', prompt, language, "Please provide a concise summary of this athlete's activity data. ");
            return AiSummary.create({
                entityId: null,
                entityType: 'activity',
                dayId: day.id,
                summary: summaryText,
            });
        }
    }
    async getNutritionSummary(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId);
        const nutritionEntries = await this.getDayNutritionEntries(day.id);
        const latestSummary = await this.findLatestNutritionSummary(day.id);
        const generationCount = await this.countNutritionSummariesForDay(day.id);
        const meta = this.buildNutritionSummaryMeta(nutritionEntries, latestSummary, generationCount);
        if (!meta.canGenerate) {
            throw new Error(`Complete at least ${NUTRITION_SUMMARY_MIN_FILLED_MEALS} meals to generate AI insights.`);
        }
        if (!latestSummary) {
            throw new Error('Summary not found');
        }
        return latestSummary;
    }
    async getHealthSummary(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId, ['health']);
        await day.load('health', (healthQuery) => {
            healthQuery.preload('pains');
        });
        const healthData = day.health;
        if (!healthData ||
            healthData.moodRating === null ||
            healthData.energyRating === null ||
            healthData.stressRating === null) {
            throw new Error('Complete all mandatory health fields (mood, energy, and stress) to generate AI insights.');
        }
        let summary = await this.findExistingSummary({
            entityType: 'health',
            dayId: day.id,
            entityId: healthData.id,
        });
        if (summary)
            return summary;
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const last7DaysSleepData = await this.getLast7DaysSleepData(athleteId, date);
        const activityScales = await this.getSubjectiveScaleMap(athlete.clubId, athlete.appLanguageOrDefault, { context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY });
        const recentActivities = this.formatRecentActivities(athlete, false, activityScales);
        const prompt = await this.buildHealthSummaryPrompt({
            athlete,
            healthData,
            last7DaysSleepData,
            activityData: recentActivities,
            date,
        });
        const summaryText = await this.generateSummaryText('health_system_prompt', prompt, language, "Please provide a concise summary of this athlete's health data. ");
        return AiSummary.create({
            entityId: healthData.id,
            entityType: 'health',
            dayId: day.id,
            summary: summaryText,
        });
    }
    async getSleepSummary(params) {
        const { date, athleteId } = params;
        const day = await this.dayService.getDayByDate(date, athleteId);
        const sleepData = await Sleep.query().where('dayId', day.id).firstOrFail();
        if (!sleepData.bedtimeDate || !sleepData.wakeUpDate || sleepData.qualityRating === null) {
            throw new Error('Complete your sleep data (bedtime, wake time, and quality rating) to generate AI insights.');
        }
        let summary = await this.findExistingSummary({
            entityType: 'sleep',
            dayId: day.id,
            entityId: sleepData.id,
        });
        if (summary)
            return summary;
        const { athlete, language } = await this.getAthleteWithLanguage(athleteId, date);
        const prompt = await this.buildSleepSummaryPrompt({
            athlete,
            sleepData,
            date,
            day,
        });
        const summaryText = await this.generateSummaryText('sleep_system_prompt', prompt, language, "Please provide a concise summary of this athlete's sleep data. ");
        return AiSummary.create({
            entityId: sleepData.id,
            entityType: 'sleep',
            dayId: day.id,
            summary: summaryText,
        });
    }
    async buildSpecificActivitySummaryPrompt(params) {
        const { athlete, nutrition, date, activityId } = params;
        const foundDay = athlete.days?.find((day) => day?.dateOfDay?.toISODate() === date);
        const specificActivity = foundDay?.sportActivities?.find((activity) => activity.id === activityId);
        const promptTemplate = await this.getPrompt('specific-activity-summary');
        const language = athlete.appLanguageOrDefault;
        const activityScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY,
        });
        const sleepScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            domains: [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP],
        });
        const scales = new Map([...activityScalesMap, ...sleepScalesMap]);
        const activityScales = [...activityScalesMap.values()];
        const sleepScale = [...sleepScalesMap.values()][0];
        if (!sleepScale) {
            throw new Error('Sleep scale is not configured for this club');
        }
        const activityScalesRef = activityScales
            .map((scale) => this.subjectiveScaleService.formatFieldConfigReference(scale))
            .join('\n\n');
        const sleepScaleRef = this.subjectiveScaleService.formatFieldConfigReference(sleepScale);
        const activityDetails = specificActivity
            ? this.formatActivityDetails({
                activity: specificActivity,
                includeZones: true,
                includePain: true,
                includeExtendedMetrics: true,
                language,
                subjectiveScaleById: scales,
            })
            : 'Activity not found';
        const recentActivities = this.formatRecentActivities(athlete, true, scales);
        const sleep = foundDay?.sleeps?.[0];
        const sleepData = sleep
            ? [
                `quality: ${sleep.qualityRating == null ? 'N/A' : `${sleep.qualityRating}/${sleepScale.max}`}`,
                `duration: ${parseMicrosecondsToDuration(sleep.totalInBedTimeMilli
                    ? sleep.totalInBedTimeMilli * 1000 -
                        (sleep.napAm ? sleep.napAm : 0) -
                        (sleep.napPm ? sleep.napPm : 0)
                    : 0)}`,
                `bedtime: ${sleep.bedtimeDate?.toISO() ?? 'N/A'}`,
                `wakeUp: ${sleep.wakeUpDate?.toISO() ?? 'N/A'}`,
            ].join('\n')
            : 'No sleep data for this day';
        const exerciseData = await this.getStrengthExerciseContext(athlete.id, date, activityId, language);
        return this.fillPromptTemplate(promptTemplate, {
            athlete_name: athlete.name || 'Unknown',
            date,
            activity_id: activityId.toString(),
            activity_subjective_scales: activityScalesRef,
            activity_details: this.withScaleReference(activityScalesRef, activityDetails),
            recent_activities: recentActivities,
            nutrition_data: JSON.stringify(nutrition, null, 2),
            sleep_quality_scale: sleepScaleRef,
            sleep_data: this.withScaleReference(sleepScaleRef, sleepData),
            exercise_data: exerciseData,
        });
    }
    async buildDayLevelActivitySummaryPrompt(params) {
        const { athlete, date, nutrition } = params;
        const dayActivities = athlete.days?.find((day) => day.dateOfDay?.toISODate() === date)?.sportActivities || [];
        const promptTemplate = await this.getPrompt('day-level-activity-summary');
        const language = athlete.appLanguageOrDefault;
        const activityScales = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY,
        });
        const activityScalesRef = [...activityScales.values()]
            .map((scale) => this.subjectiveScaleService.formatFieldConfigReference(scale))
            .join('\n\n');
        const todaysActivities = dayActivities
            .map((activity, index) => {
            const details = this.formatActivityDetails({
                activity,
                includeZones: true,
                includePain: true,
                includeExtendedMetrics: true,
                language,
                subjectiveScaleById: activityScales,
            });
            return `${index + 1}. ${details}`;
        })
            .join('\n') || 'No activities today';
        const recentActivities = this.formatRecentActivities(athlete, true, activityScales);
        return this.fillPromptTemplate(promptTemplate, {
            athlete_name: athlete.name || 'Unknown',
            date,
            activities_count: dayActivities.length.toString(),
            activity_subjective_scales: activityScalesRef,
            todays_activities: this.withScaleReference(activityScalesRef, todaysActivities),
            recent_activities: recentActivities,
            nutrition_data: encode(nutrition),
        });
    }
    async buildNutritionSummaryPrompt(params) {
        const { athlete, nutrition, last7DaysMeals, date } = params;
        const promptTemplate = await this.getPrompt('nutrition-summary');
        return this.fillPromptTemplate(promptTemplate, {
            athlete_name: athlete.name || 'Unknown',
            date,
            nutrition_data: encode(nutrition),
            meal_data: encode(last7DaysMeals),
        });
    }
    async buildHealthSummaryPrompt(params) {
        const { athlete, healthData, last7DaysSleepData, activityData, date } = params;
        const language = athlete.appLanguageOrDefault;
        const healthScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            domains: [SUBJECTIVE_VARIABLE_DOMAIN.HEALTH_RATING],
        });
        const activityScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY,
        });
        const sleepScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            domains: [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP],
        });
        const healthScalesRef = [...healthScalesMap.values()]
            .map((scale) => this.subjectiveScaleService.formatFieldConfigReference(scale))
            .join('\n\n');
        const activityScalesRef = [...activityScalesMap.values()]
            .map((scale) => this.subjectiveScaleService.formatFieldConfigReference(scale))
            .join('\n\n');
        const sleepScale = [...sleepScalesMap.values()][0];
        if (!sleepScale) {
            throw new Error('Sleep scale is not configured for this club');
        }
        const sleepScaleRef = this.subjectiveScaleService.formatFieldConfigReference(sleepScale);
        const painInfo = this.formatPainInfo(healthData.pains ?? [], parseAppLanguage(athlete.appLanguage) ?? APP_LANGUAGES.EN);
        const healthRatingLines = [...healthScalesMap.values()].map((scale) => {
            const value = healthData[scale.fieldName];
            const label = scale.label || scale.fieldName;
            const numericValue = typeof value === 'number' ? value : null;
            return `- ${label}: ${this.formatSubjectiveScore(numericValue, scale)}`;
        });
        const healthDataBlock = [...healthRatingLines, `- Pain/Discomfort: ${painInfo}`].join('\n');
        const promptTemplate = await this.getPrompt('health-summary');
        return this.fillPromptTemplate(promptTemplate, {
            athlete_name: athlete.name || 'Unknown',
            date,
            wellness_scales: healthScalesRef,
            activity_subjective_scales: activityScalesRef,
            sleep_quality_scale: sleepScaleRef,
            sleep_data: this.withScaleReference(sleepScaleRef, JSON.stringify(last7DaysSleepData, null, 2)),
            activity_data: this.withScaleReference(activityScalesRef, JSON.stringify(activityData, null, 2)),
            health_data: this.withScaleReference(healthScalesRef, healthDataBlock),
        });
    }
    formatSleepBaseline(recentSleeps, todayDate, qualityScaleMax) {
        const priorNights = recentSleeps.filter((sleep) => sleep.date && sleep.date !== todayDate && sleep.qualityRating !== null);
        if (priorNights.length === 0) {
            return 'No prior sleep data available in the last 7 days for baseline comparison.';
        }
        const baseline = priorNights.reduce((acc, sleep) => {
            const durationHours = sleep.durationHours ??
                (sleep.totalInBedTimeMilli ? sleep.totalInBedTimeMilli / (1000 * 60 * 60) : null);
            if (durationHours !== null)
                acc.durationHours.push(durationHours);
            if (sleep.qualityRating !== null)
                acc.qualities.push(sleep.qualityRating);
            if (sleep.sleepEfficiencyPercentage !== null) {
                acc.efficiencies.push(sleep.sleepEfficiencyPercentage);
            }
            if (sleep.bedtimeDate) {
                acc.bedtimeMinutes.push(sleep.bedtimeDate.hour * 60 + sleep.bedtimeDate.minute);
            }
            if (sleep.wakeUpDate) {
                acc.wakeMinutes.push(sleep.wakeUpDate.hour * 60 + sleep.wakeUpDate.minute);
            }
            if (sleep.totalRemSleepTimeMilli) {
                acc.remMinutes.push(Math.round(sleep.totalRemSleepTimeMilli / (1000 * 60)));
            }
            if (sleep.totalSlowWaveSleepTimeMilli) {
                acc.deepMinutes.push(Math.round(sleep.totalSlowWaveSleepTimeMilli / (1000 * 60)));
            }
            return acc;
        }, {
            durationHours: [],
            qualities: [],
            efficiencies: [],
            bedtimeMinutes: [],
            wakeMinutes: [],
            remMinutes: [],
            deepMinutes: [],
        });
        const parts = [`Based on ${priorNights.length} prior night(s) in the last 7 days:`];
        const avgDuration = avg(baseline.durationHours);
        if (avgDuration !== null) {
            parts.push(`Average duration: ${formatHoursToHhMm(avgDuration)}`);
        }
        const avgQuality = avg(baseline.qualities);
        if (avgQuality !== null) {
            parts.push(`Average quality: ${avgQuality.toFixed(1)}/${qualityScaleMax}`);
        }
        const avgEfficiency = avg(baseline.efficiencies);
        if (avgEfficiency !== null) {
            parts.push(`Average sleep efficiency: ${avgEfficiency.toFixed(0)}%`);
        }
        const avgBedtime = avgMinutesToTime(baseline.bedtimeMinutes);
        if (avgBedtime) {
            parts.push(`Average bedtime: ${avgBedtime}`);
        }
        const avgWakeUp = avgMinutesToTime(baseline.wakeMinutes);
        if (avgWakeUp) {
            parts.push(`Average wake up: ${avgWakeUp}`);
        }
        const avgRem = avg(baseline.remMinutes);
        if (avgRem !== null) {
            parts.push(`Average REM sleep: ${Math.round(avgRem)} minutes`);
        }
        const avgDeep = avg(baseline.deepMinutes);
        if (avgDeep !== null) {
            parts.push(`Average deep sleep: ${Math.round(avgDeep)} minutes`);
        }
        const recentNights = priorNights
            .map((sleep) => {
            const duration = sleep.durationHours !== null && sleep.durationHours !== undefined
                ? formatHoursToHhMm(sleep.durationHours)
                : sleep.totalInBedTimeMilli
                    ? formatHoursToHhMm(sleep.totalInBedTimeMilli / (1000 * 60 * 60))
                    : 'N/A';
            return `${sleep.date}: duration ${duration}, quality ${sleep.qualityRating}/${qualityScaleMax}`;
        })
            .join('\n');
        parts.push(`Recent nights:\n${recentNights}`);
        return parts.join('\n');
    }
    formatTonightSleepBlock(sleepInfo) {
        return [
            `Bedtime: ${sleepInfo.bedtime}`,
            `Wake up: ${sleepInfo.wakeUp}`,
            `Duration: ${sleepInfo.duration}`,
            `Quality rating: ${sleepInfo.quality}`,
            `Sleep efficiency: ${sleepInfo.efficiency}`,
            `Awake time: ${sleepInfo.awakeTime}`,
            `REM sleep: ${sleepInfo.remSleep} minutes`,
            `Deep sleep: ${sleepInfo.deepSleep} minutes`,
            `Consistency: ${sleepInfo.consistency ?? 'N/A'}`,
            `Nap AM: ${sleepInfo.napAm}`,
            `Nap PM: ${sleepInfo.napPm}`,
        ].join('\n');
    }
    async buildSleepSummaryPrompt(params) {
        const { athlete, sleepData, date, day } = params;
        const language = athlete.appLanguageOrDefault;
        const sleepScalesMap = await this.getSubjectiveScaleMap(athlete.clubId, language, {
            domains: [SUBJECTIVE_VARIABLE_DOMAIN.SLEEP],
        });
        const sleepScale = [...sleepScalesMap.values()][0];
        if (!sleepScale) {
            throw new Error('Sleep scale is not configured for this club');
        }
        const scaleReference = this.subjectiveScaleService.formatFieldConfigReference(sleepScale);
        const formatSleepData = async (sleep) => {
            const bedtime = sleep.bedtimeDate ? sleep.bedtimeDate.toJSDate().toLocaleTimeString() : 'N/A';
            const wakeUp = sleep.wakeUpDate ? sleep.wakeUpDate.toJSDate().toLocaleTimeString() : 'N/A';
            const napAm = parseMicrosecondsToDuration(sleep.napAm);
            const napPm = parseMicrosecondsToDuration(sleep.napPm);
            const durationInMicroseconds = sleep.totalInBedTimeMilli
                ? sleep.totalInBedTimeMilli * 1000 -
                    (sleep.napAm ? sleep.napAm : 0) -
                    (sleep.napPm ? sleep.napPm : 0)
                : 0;
            const durationText = parseMicrosecondsToDuration(durationInMicroseconds);
            const quality = sleep.qualityRating == null ? 'N/A' : `${sleep.qualityRating}/${sleepScale.max}`;
            const efficiency = sleep.sleepEfficiencyPercentage
                ? `${sleep.sleepEfficiencyPercentage}%`
                : 'N/A';
            const awakeTime = sleep.totalAwakeTimeMilli
                ? Math.round(sleep.totalAwakeTimeMilli / (1000 * 60))
                : 'N/A';
            const consistency = day.sleeps?.[0]?.sleepConsistencyPercentage ?? null;
            return {
                bedtime,
                wakeUp,
                duration: durationText,
                quality,
                efficiency,
                consistency,
                awakeTime: `${awakeTime} minutes`,
                remSleep: sleep.totalRemSleepTimeMilli
                    ? Math.round(sleep.totalRemSleepTimeMilli / (1000 * 60))
                    : 'N/A',
                deepSleep: sleep.totalSlowWaveSleepTimeMilli
                    ? Math.round(sleep.totalSlowWaveSleepTimeMilli / (1000 * 60))
                    : 'N/A',
                napAm,
                napPm,
            };
        };
        const sleepInfo = sleepData ? await formatSleepData(sleepData) : null;
        const last7DaysSleepData = await this.getLast7DaysSleepData(athlete.id, date);
        const promptTemplate = await this.getPrompt('sleep-summary');
        const tonightSleepBlock = sleepInfo ? this.formatTonightSleepBlock(sleepInfo) : null;
        return this.fillPromptTemplate(promptTemplate, {
            athlete_name: athlete.name || 'Unknown',
            date,
            sleep_quality_scale: scaleReference,
            sleep_data: tonightSleepBlock
                ? this.withScaleReference(scaleReference, tonightSleepBlock)
                : 'No sleep data available',
            sleep_baseline: this.formatSleepBaseline(last7DaysSleepData, date, sleepScale.max),
        });
    }
}
//# sourceMappingURL=summary_service.js.map