import { addNutritionQuerySchema, addNutritionSchema, addAlimentSchema, deleteNutritionParamsSchema, getNutritionQuerySchema, getNutritionSummaryQuerySchema, getNutritionRecentsQuerySchema, updateNutritionParamsSchema, updateNutritionSchema, searchNutritionSchema, getMacroIntervalsQuerySchema, } from '#schemas/nutrition';
import NutritionService from '#services/mobile/nutrition/nutrition_service';
import AthleteService from '#services/athlete_service';
import NutritionSearchService from '#services/mobile/nutrition/nutrition_search_service';
import { DateTime } from 'luxon';
import CoreNutritionService from '#services/nutrition_service';
import { MetricService } from '#services/metric_service';
import { MetricDomain } from '#contracts/metric';
import { nutritionDateSchema, updateSkippedMealsSchema } from '#schemas/nutrition';
import { getTdeeQuerySchema } from '#schemas/mobile/tdee';
import { getLanguageFromRequest } from '#utils/language';
export default class NutritionController {
    nutritionService;
    athleteService;
    nutritionSearchService;
    coreNutritionService;
    metricService;
    constructor() {
        this.nutritionService = new NutritionService();
        this.athleteService = new AthleteService();
        this.nutritionSearchService = new NutritionSearchService();
        this.coreNutritionService = new CoreNutritionService();
        this.metricService = new MetricService(MetricDomain.DAY);
    }
    async validateDate(request) {
        const validatedDate = await nutritionDateSchema.validate(request.qs());
        return DateTime.fromJSDate(validatedDate.date);
    }
    async getRecents({ response, athlete, request }) {
        const { mealType } = await getNutritionRecentsQuerySchema.validate(request.qs());
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const recents = await this.nutritionService.getRecents(athleteRecord.id, mealType);
        await this.nutritionService.translateNutritionEntries(recents, language);
        return response.json(recents.map((recent) => recent.serialize()));
    }
    async addNutrition({ response, athlete, request }) {
        const payload = await addNutritionSchema.validate(request.body());
        const query = await addNutritionQuerySchema.validate(request.qs());
        await this.nutritionService.addNutrition(athlete.athleteid, {
            ...payload,
            ...query,
        });
        return response.json({ success: true });
    }
    async deleteNutrition({ response, athlete, request }) {
        const { id } = await deleteNutritionParamsSchema.validate(request.params());
        await this.nutritionService.deleteNutrition(athlete.athleteid, id);
        return response.json({ success: true });
    }
    async getNutrition({ response, athlete, request }) {
        const payload = await getNutritionQuerySchema.validate(request.qs());
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const nutrition = await this.nutritionService.getNutrition(athleteRecord.id, payload);
        await this.nutritionService.translateNutritionEntries(nutrition, language);
        return response.json(nutrition.map((entry) => entry.serialize()));
    }
    async getNutritionSummary({ response, athlete, request }) {
        const payload = await getNutritionSummaryQuerySchema.validate(request.qs());
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const summary = await this.nutritionService.getNutritionSummaryByMealType(athleteRecord.id, payload);
        return response.json(summary);
    }
    async updateNutrition({ response, athlete, request }) {
        const { id } = await updateNutritionParamsSchema.validate(request.params());
        const payload = await updateNutritionSchema.validate(request.body());
        await this.nutritionService.updateNutrition(athlete.athleteid, id, payload);
        return response.json({ success: true });
    }
    async getMacroIntervals({ response, athlete, request }) {
        try {
            const { dateOfDay } = await getMacroIntervalsQuerySchema.validate(request.qs());
            const date = DateTime.fromJSDate(dateOfDay);
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const day = await this.athleteService.getOrCreateDay(athleteRecord.id, date);
            const macroInsights = await this.athleteService.calculateMacronutrientInsights(athleteRecord, athleteRecord.effectiveFcMax, day, []);
            return response.json(macroInsights);
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({ message: 'An error occurred.' });
        }
    }
    async getTdee({ response, athlete, request }) {
        try {
            const { date } = await getTdeeQuerySchema.validate(request.qs());
            const targetDate = date ? DateTime.fromJSDate(date) : DateTime.now();
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const day = await this.athleteService.getOrCreateDay(athleteRecord.id, targetDate);
            await day.load('sportActivities', (sportActivitiesQuery) => {
                sportActivitiesQuery.preload('sport');
            });
            const breakdown = await this.athleteService.calculateDailyEnergyBreakdown(athleteRecord, day.sportActivities, day);
            const energyBreakdown = {
                bmr: breakdown.bmr,
                nep: breakdown.nep,
                eee: breakdown.eee,
                tdee: breakdown.tdee,
                kcalFloor: breakdown.kcalTarget,
            };
            return response.json({
                breakdown: energyBreakdown,
                tdee: energyBreakdown.kcalFloor,
                activityKcal: energyBreakdown.eee,
            });
        }
        catch (e) {
            console.error('NutritionController.getTdee error', e);
            if (e?.messages) {
                return response.badRequest({ message: 'Invalid parameters', errors: e.messages });
            }
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
    async getSkippedMeals({ response, athlete, request }) {
        try {
            const date = await this.validateDate(request);
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const day = await this.athleteService.getOrCreateDay(athleteRecord.id, date);
            const skippedMeals = await this.coreNutritionService.getSkippedMeals(day.id);
            return response.json({ skippedMeals });
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({ message: 'An error occurred.' });
        }
    }
    async updateSkippedMeals({ response, athlete, request }) {
        try {
            const date = await this.validateDate(request);
            const body = await updateSkippedMealsSchema.validate(request.body());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const day = await this.athleteService.getOrCreateDay(athleteRecord.id, date);
            const metrics = {};
            if (body.meal_type !== undefined) {
                const metricName = this.coreNutritionService.getSkippedMetricNameForMealType(body.meal_type);
                if (metricName)
                    metrics[metricName] = 0;
            }
            for (const key of ['breakfast_skipped', 'lunch_skipped', 'dinner_skipped']) {
                if (body[key] !== undefined) {
                    metrics[key] = body[key] ? 1 : 0;
                }
            }
            if (Object.keys(metrics).length > 0) {
                await this.metricService.updateMetrics(day.id, metrics);
            }
            const skippedMeals = await this.coreNutritionService.getSkippedMeals(day.id);
            return response.json({ skippedMeals });
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({ message: 'An error occurred.' });
        }
    }
    async searchAliments({ response, athlete, request }) {
        try {
            const payload = await searchNutritionSchema.validate(request.qs());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const language = getLanguageFromRequest(request);
            const result = await this.nutritionSearchService.searchAliments(athleteRecord, payload, language);
            return response.json(result);
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({ message: 'An error occurred.' });
        }
    }
    async addAliment({ response, athlete, request }) {
        try {
            const payload = await addAlimentSchema.validate(request.body());
            await this.nutritionService.addAliment(athlete.athleteid, payload);
            return response.json({ success: true });
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({ message: 'An error occurred.' });
        }
    }
    async getOpenFoodFactsByBarcode({ response, athlete, request }) {
        try {
            const barcode = request.param('barcode');
            if (!barcode) {
                return response.badRequest({ message: 'Barcode is required' });
            }
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord) {
                return response.notFound({ message: 'Athlete not found' });
            }
            const aliment = await this.nutritionService.getOrCreateAlimentFromOpenFoodFacts(String(barcode), athleteRecord.id);
            return response.json(aliment.serialize());
        }
        catch (e) {
            console.error(e);
            return response.internalServerError({
                message: 'An error occurred while fetching product data.',
            });
        }
    }
}
//# sourceMappingURL=nutrition_controller.js.map