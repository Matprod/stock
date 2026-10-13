import Day from '#models_pg/day';
export default class NutritionService {
    async getDayWithNutrition(athleteId, date) {
        return Day.query()
            .where('athleteId', athleteId)
            .where('dateOfDay', date.toISODate())
            .preload('nutrition', (nutritionQuery) => {
            nutritionQuery.preload('aliment');
            nutritionQuery.preload('llmAliment');
            nutritionQuery.preload('recipe', (recipeQuery) => {
                recipeQuery.preload('recipeAliments', (recipeAlimentsQuery) => {
                    recipeAlimentsQuery.preload('meal');
                });
            });
        })
            .first();
    }
    mergeLlmNutritionWithAliment(llmAliment) {
        return {
            id: llmAliment.id,
            name: llmAliment.name,
            energyKcal: llmAliment.energyKcal,
            proteinsG: llmAliment.proteinsG,
            carbohydrateG: llmAliment.carbohydrateG,
            fatG: llmAliment.fatG,
        };
    }
    formatLlmAlimentForDetail(cm) {
        return {
            id: cm.id,
            name: cm.name,
            energyKcal: cm.energyKcal,
            proteinsG: cm.proteinsG,
            carbohydrateG: cm.carbohydrateG,
            fatG: cm.fatG,
        };
    }
    formatNutritionDetail(day) {
        return {
            id: day.id,
            athleteId: day.athleteId,
            dateOfDay: day.dateOfDay?.toISODate(),
            nutrition: day.nutrition.map((nutrition) => {
                const mealData = nutrition.aliment;
                const llmAlimentData = nutrition.llmAliment
                    ? this.formatLlmAlimentForDetail(nutrition.llmAliment)
                    : null;
                return {
                    id: nutrition.id,
                    mealType: nutrition.mealType,
                    quantity: nutrition.quantity,
                    portion: nutrition.portion,
                    mealName: nutrition.mealName,
                    meal: mealData
                        ? {
                            id: mealData.id,
                            name: mealData.name,
                            energyKcal: mealData.energyKcal,
                            proteinsG: mealData.proteinsG,
                            carbohydrateG: mealData.carbohydrateG,
                            fatG: mealData.fatG,
                        }
                        : null,
                    llmAliment: llmAlimentData,
                    recipe: nutrition.recipe
                        ? {
                            id: nutrition.recipe.id,
                            name: nutrition.recipe.name,
                            mealType: nutrition.recipe.mealType,
                            recipeMeals: nutrition.recipe.recipeAliments.map((recipeAliment) => ({
                                id: recipeAliment.id,
                                quantity: recipeAliment.quantity,
                                portion: recipeAliment.portion,
                                meal: recipeAliment.meal
                                    ? {
                                        id: recipeAliment.meal.id,
                                        name: recipeAliment.meal.name,
                                        energyKcal: recipeAliment.meal.energyKcal,
                                        proteinsG: recipeAliment.meal.proteinsG,
                                        carbohydrateG: recipeAliment.meal.carbohydrateG,
                                        fatG: recipeAliment.meal.fatG,
                                    }
                                    : null,
                            })),
                        }
                        : null,
                };
            }),
        };
    }
    async getMealsFilled(day) {
        const nutrition = day.nutrition ?? [];
        const allMealTypes = this.extractMealTypes(nutrition);
        return {
            breakfast: allMealTypes.includes('breakfast'),
            lunch: allMealTypes.includes('lunch'),
            snackAM: allMealTypes.includes('snack am'),
            dinner: allMealTypes.includes('dinner'),
            snackPM: allMealTypes.includes('snack pm'),
        };
    }
    extractMealTypes(nutrition) {
        const mealTypes = nutrition
            .filter((n) => n.mealType && (n.aliment || n.llmAliment))
            .map((n) => n.mealType.toLowerCase());
        const recipeMealTypes = nutrition
            .filter((n) => n.recipe?.mealType.length)
            .map((n) => n.recipe.mealType.map((mealType) => mealType.toLowerCase()));
        return [...mealTypes, ...recipeMealTypes];
    }
    async getSkippedMeals(dayId) {
        const day = await Day.query()
            .where('id', dayId)
            .preload('metricValues', (q) => q.preload('metric'))
            .first();
        if (!day) {
            return {};
        }
        const metricByNames = new Map();
        for (const metricValue of day.metricValues ?? []) {
            if (metricValue.metric?.name) {
                metricByNames.set(metricValue.metric.name, metricValue.value);
            }
        }
        const result = {};
        for (const mealType of ['Breakfast', 'Lunch', 'Dinner']) {
            const metricName = this.getSkippedMetricNameForMealType(mealType);
            if (!metricName)
                continue;
            const raw = metricByNames.get(metricName);
            if (!raw)
                continue;
            const normalized = raw.trim().toLowerCase();
            const isSkipped = normalized === 'true' || normalized === '1';
            if (isSkipped) {
                result[mealType] = true;
            }
        }
        return result;
    }
    getSkippedMealNames(skippedMeals) {
        const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
        return mealTypes.filter((meal) => skippedMeals[meal] === true);
    }
    getSkippedMetricNameForMealType(mealType) {
        const normalized = mealType.trim().toLowerCase();
        if (normalized === 'breakfast')
            return 'breakfast_skipped';
        if (normalized === 'lunch')
            return 'lunch_skipped';
        if (normalized === 'dinner')
            return 'dinner_skipped';
        return null;
    }
}
//# sourceMappingURL=nutrition_service.js.map