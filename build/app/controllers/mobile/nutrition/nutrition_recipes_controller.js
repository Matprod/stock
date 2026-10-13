import { addRecipeSchema, deleteRecipeParamsSchema, getRecipesQuerySchema, updateRecipeParamsSchema, } from '#schemas/mobile/nutrition_recipe';
import AthleteService from '#services/athlete_service';
import NutritionRecipesService from '#services/mobile/nutrition/nutrition_recipes_service';
export default class NutritionRecipesController {
    athleteService;
    nutritionRecipesService;
    constructor() {
        this.nutritionRecipesService = new NutritionRecipesService();
        this.athleteService = new AthleteService();
    }
    async addRecipe({ request, response, athlete }) {
        const payload = await addRecipeSchema.validate(request.body());
        await this.nutritionRecipesService.addRecipe(athlete.athleteid, payload);
        return response.json({ success: true });
    }
    async updateRecipe({ request, response, athlete }) {
        const { id } = await updateRecipeParamsSchema.validate(request.params());
        const payload = await addRecipeSchema.validate(request.body());
        await this.nutritionRecipesService.addRecipe(athlete.athleteid, { ...payload, id });
        return response.json({ success: true });
    }
    async getRecipes({ response, athlete, request }) {
        const { mealType } = await getRecipesQuerySchema.validate(request.qs());
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const recipes = await this.nutritionRecipesService.getRecipes(athleteRecord.id, mealType);
        return response.json(recipes.map((recipe) => recipe.serialize()));
    }
    async deleteRecipe({ response, athlete, request }) {
        const { id } = await deleteRecipeParamsSchema.validate(request.params());
        await this.nutritionRecipesService.deleteRecipe(athlete.athleteid, id);
        return response.json({ success: true });
    }
}
//# sourceMappingURL=nutrition_recipes_controller.js.map