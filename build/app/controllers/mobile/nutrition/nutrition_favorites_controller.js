import NutritionFavoritesService from '#services/mobile/nutrition/nutrition_favorites_service';
import { addNutritionFavoriteSchema, deleteNutritionFavoriteParamsSchema, deleteNutritionFavoriteSchema, getNutritionFavoritesQuerySchema, } from '#schemas/mobile/nutrition_favorite';
import AthleteService from '#services/athlete_service';
import NutritionService from '#services/mobile/nutrition/nutrition_service';
import { getLanguageFromRequest } from '#utils/language';
export default class NutritionFavoritesController {
    nutritionFavoritesService;
    athleteService;
    nutritionService;
    constructor() {
        this.nutritionFavoritesService = new NutritionFavoritesService();
        this.athleteService = new AthleteService();
        this.nutritionService = new NutritionService();
    }
    async getFavorites({ response, athlete, request }) {
        const { mealType } = await getNutritionFavoritesQuerySchema.validate(request.qs());
        const athleteRecord = await this.athleteService.getAthleteById(athlete.athleteid);
        if (!athleteRecord) {
            return response.notFound({ message: 'Athlete not found' });
        }
        const language = getLanguageFromRequest(request);
        const favorites = await this.nutritionFavoritesService.getFavorites(athlete.athleteid, mealType);
        await this.nutritionService.translateAliments(favorites.map((favorite) => favorite.aliment), language);
        return response.json(favorites.map((favorite) => {
            const { aliment, llmAliment, ...favoriteData } = favorite.serialize();
            if (!aliment && !llmAliment) {
                return null;
            }
            return {
                ...favoriteData,
                food: aliment ?? llmAliment,
            };
        }));
    }
    async deleteFavorite({ response, athlete, request }) {
        const { id } = await deleteNutritionFavoriteParamsSchema.validate(request.params());
        const { mealType } = await deleteNutritionFavoriteSchema.validate(request.body());
        await this.nutritionFavoritesService.deleteFavorite(athlete.athleteid, id, mealType);
        return response.json({ message: 'Favorite deleted successfully' });
    }
    async addFavorite({ response, athlete, request }) {
        const payload = await addNutritionFavoriteSchema.validate(request.body());
        const favorite = await this.nutritionFavoritesService.addFavorite(athlete.athleteid, payload);
        const language = getLanguageFromRequest(request);
        await this.nutritionService.translateAliments([favorite.aliment], language);
        const { aliment, llmAliment, ...favoriteData } = favorite.serialize();
        return response.json({
            ...favoriteData,
            food: aliment ?? llmAliment,
        });
    }
}
//# sourceMappingURL=nutrition_favorites_controller.js.map