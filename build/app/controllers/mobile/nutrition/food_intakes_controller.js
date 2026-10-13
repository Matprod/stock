import AthleteService from '#services/athlete_service';
import NutritionService from '#services/mobile/nutrition/nutrition_service';
import SportActivity from '#models_pg/sport_activity';
import Nutrition from '#models_pg/nutrition';
import LlmAliment from '#models_pg/llm_aliment';
import { createFoodIntakeSchema, deleteFoodIntakeParamsSchema, getFoodIntakesQuerySchema, } from '#schemas/mobile/food_intake';
import ActivityFoodIntake from '#models_pg/activity_food_intake';
export default class FoodIntakesController {
    athleteService;
    nutritionService;
    constructor() {
        this.athleteService = new AthleteService();
        this.nutritionService = new NutritionService();
    }
    async assertSportActivityOwnership(athleteId, sportActivityId) {
        const sportActivity = await SportActivity.query()
            .where('id', sportActivityId)
            .preload('day')
            .first();
        if (!sportActivity)
            return { sportActivity: null, error: { status: 404, msg: 'Sport activity not found' } };
        if (sportActivity.day?.athleteId !== athleteId) {
            return { sportActivity: null, error: { status: 403, msg: 'Forbidden' } };
        }
        return { sportActivity, error: null };
    }
    async getEffortNutritionResume(athleteId, sportActivity) {
        const dateOfDay = sportActivity.day?.dateOfDay;
        if (!dateOfDay)
            return null;
        const summaries = await this.nutritionService.getNutritionSummaryByMealType(athleteId, {
            dateOfDay: dateOfDay.toJSDate(),
        });
        return summaries['Effort Nutrition'] ?? null;
    }
    async list({ request, response, athlete }) {
        try {
            const { sportActivityId } = await getFoodIntakesQuerySchema.validate(request.qs());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const { sportActivity, error } = await this.assertSportActivityOwnership(athleteRecord.id, sportActivityId);
            if (error)
                return response.status(error.status).json({ message: error.msg });
            const foodIntakes = await ActivityFoodIntake.query()
                .where('sportActivityId', sportActivityId)
                .preload('aliment');
            return response.json({
                foods: foodIntakes.map((foodIntake) => foodIntake.serialize()),
                resume: sportActivity
                    ? await this.getEffortNutritionResume(athleteRecord.id, sportActivity)
                    : null,
            });
        }
        catch (e) {
            console.error('FoodIntakesController.list error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
    async create({ request, response, athlete }) {
        try {
            const payload = await createFoodIntakeSchema.validate(request.body());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const { sportActivity, error } = await this.assertSportActivityOwnership(athleteRecord.id, payload.sportActivityId);
            if (error)
                return response.status(error.status).json({ message: error.msg });
            const foodId = payload.foodId ?? null;
            const llmAlimentId = payload.llmAlimentId ?? null;
            if ((foodId && llmAlimentId) || (!foodId && !llmAlimentId)) {
                return response.badRequest({ message: 'Provide exactly one of foodId or llmAlimentId' });
            }
            const quantity = payload.quantity ?? 1;
            if (llmAlimentId) {
                const llmAliment = await LlmAliment.find(llmAlimentId);
                if (!llmAliment)
                    return response.notFound({ message: 'Llm aliment not found' });
                const dayId = sportActivity.dayId;
                if (!dayId)
                    return response.badRequest({ message: 'Invalid sport activity' });
                const portion = payload.portion ?? llmAliment.portion ?? null;
                await Nutrition.create({
                    dayId,
                    mealType: 'Effort Nutrition',
                    quantity,
                    portion,
                    llmAlimentId,
                    alimentId: null,
                    recipeId: null,
                });
            }
            else if (foodId) {
                await ActivityFoodIntake.create({
                    sportActivityId: payload.sportActivityId,
                    alimentId: foodId,
                    quantity,
                    portion: payload.portion ?? null,
                });
            }
            const foodIntakes = await ActivityFoodIntake.query()
                .where('sportActivityId', payload.sportActivityId)
                .preload('aliment');
            return response.json({
                foods: foodIntakes.map((foodIntake) => foodIntake.serialize()),
                resume: sportActivity
                    ? await this.getEffortNutritionResume(athleteRecord.id, sportActivity)
                    : null,
            });
        }
        catch (e) {
            console.error('FoodIntakesController.create error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
    async delete({ request, response, athlete }) {
        try {
            const { id } = await deleteFoodIntakeParamsSchema.validate(request.params());
            const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
            if (!athleteRecord)
                return response.notFound({ message: 'Athlete not found' });
            const foodIntake = await ActivityFoodIntake.query()
                .where('id', id)
                .preload('sportActivity', (query) => {
                query.preload('day');
            })
                .first();
            if (!foodIntake)
                return response.notFound({ message: 'Food intake not found' });
            const sportActivity = foodIntake.sportActivity;
            if (!sportActivity)
                return response.notFound({ message: 'Sport activity not found' });
            if (sportActivity.day?.athleteId !== athleteRecord.id) {
                return response.forbidden({ message: 'Forbidden' });
            }
            await foodIntake.delete();
            return response.json({ message: 'Deleted Successfully' });
        }
        catch (e) {
            console.error('FoodIntakesController.delete error', e);
            return response.internalServerError({
                message: e instanceof Error ? e.message : 'An error occurred.',
            });
        }
    }
}
//# sourceMappingURL=food_intakes_controller.js.map