import {
  addRecipeSchema,
  deleteRecipeParamsSchema,
  getRecipesQuerySchema,
  updateRecipeParamsSchema,
} from '#schemas/mobile/nutrition_recipe'
import AthleteService from '#services/athlete_service'
import NutritionRecipesService from '#services/mobile/nutrition/nutrition_recipes_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class NutritionRecipesController {
  private athleteService: AthleteService
  private nutritionRecipesService: NutritionRecipesService

  constructor() {
    this.nutritionRecipesService = new NutritionRecipesService()
    this.athleteService = new AthleteService()
  }

  public async addRecipe({ request, response, athlete }: HttpContext) {
    const payload = await addRecipeSchema.validate(request.body())
    await this.nutritionRecipesService.addRecipe(athlete!.athleteid, payload)

    return response.json({ success: true })
  }

  public async updateRecipe({ request, response, athlete }: HttpContext) {
    const { id } = await updateRecipeParamsSchema.validate(request.params())
    const payload = await addRecipeSchema.validate(request.body())

    await this.nutritionRecipesService.addRecipe(athlete!.athleteid, { ...payload, id })
    return response.json({ success: true })
  }

  public async getRecipes({ response, athlete, request }: HttpContext) {
    const { mealType } = await getRecipesQuerySchema.validate(request.qs())
    const athleteRecord = await this.athleteService.getAthleteById(athlete!.athleteid)
    if (!athleteRecord) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const recipes = await this.nutritionRecipesService.getRecipes(athleteRecord.id, mealType)
    return response.json(recipes.map((recipe) => recipe.serialize()))
  }

  public async deleteRecipe({ response, athlete, request }: HttpContext) {
    const { id } = await deleteRecipeParamsSchema.validate(request.params())
    await this.nutritionRecipesService.deleteRecipe(athlete!.athleteid, id)
    return response.json({ success: true })
  }
}
