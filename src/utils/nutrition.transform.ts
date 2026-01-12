import type {
  APINutritionDay,
  Meal,
  NutritionDetail,
  FoodItem,
  APINutrition,
  APIMeal,
} from "../types/nutrition.types";
import {
  getMealName,
  calculateProportionalValue,
  groupNutritionByMealType,
  sortMealTypes,
} from "./nutrition.utils";

const createFoodItem = (meal: APIMeal, portion: number, quantity = 1): FoodItem | null => {
  if (!meal) return null;

  const proportionalValue = (baseValue: number) =>
    calculateProportionalValue(baseValue, portion, quantity);

  return {
    id: Date.now(),
    name: meal.name,
    nameFr: meal.nameFr,
    nameEn: meal.nameEn,
    portion,
    protein: proportionalValue(meal.proteinsG),
    carbs: proportionalValue(meal.carbohydrateG),
    fats: proportionalValue(meal.fatG),
    calories: proportionalValue(meal.energyKcal),
  };
};

const addFoodIfExists = (
  foods: FoodItem[],
  meal: APIMeal | null | undefined,
  portion: number,
  quantity: number,
) => {
  if (meal) {
    const food = createFoodItem(meal, portion, quantity);
    if (food) foods.push(food);
  }
};

const processNutritionItems = (nutritionItems: APINutrition[]): FoodItem[] => {
  const foods: FoodItem[] = [];

  nutritionItems.forEach((item) => {
    addFoodIfExists(foods, item.meal, item.portion, item.quantity);
    addFoodIfExists(foods, item.chatgptMeal, item.portion, item.quantity);

    item.recipe?.recipeMeals.forEach((recipeMeal) => {
      addFoodIfExists(foods, recipeMeal.meal, recipeMeal.portion, recipeMeal.quantity);
    });
  });

  return foods;
};

const calculateMealTotals = (foods: FoodItem[]) =>
  foods.reduce(
    (totals, food) => ({
      totalProtein: totals.totalProtein + food.protein,
      totalCarbs: totals.totalCarbs + food.carbs,
      totalFats: totals.totalFats + food.fats,
      totalCalories: totals.totalCalories + food.calories,
    }),
    { totalProtein: 0, totalCarbs: 0, totalFats: 0, totalCalories: 0 },
  );

const calculateDailyTotals = (meals: Meal[]) =>
  meals.reduce(
    (totals, meal) => ({
      totalProtein: totals.totalProtein + meal.totalProtein,
      totalCarbs: totals.totalCarbs + meal.totalCarbs,
      totalFats: totals.totalFats + meal.totalFats,
      totalCalories: totals.totalCalories + meal.totalCalories,
    }),
    { totalProtein: 0, totalCarbs: 0, totalFats: 0, totalCalories: 0 },
  );

export const transformNutritionDetail = (response: APINutritionDay): NutritionDetail => {
  const mealsMap = groupNutritionByMealType(response.nutrition);
  const sortedMealTypes = sortMealTypes(Array.from(mealsMap.keys()));
  const meals: Meal[] = [];

  sortedMealTypes.forEach((mealType, index) => {
    const nutritionItems = mealsMap.get(mealType)!;
    const foods = processNutritionItems(nutritionItems);
    const totals = calculateMealTotals(foods);

    meals.push({
      id: Date.now() + index + 1,
      name: getMealName(mealType),
      type: mealType as Meal["type"],
      date: response.dateOfDay,
      foods,
      ...totals,
    });
  });

  const dailyTotals = calculateDailyTotals(meals);

  return {
    athleteId: response.athleteId,
    date: response.dateOfDay,
    meals,
    ...dailyTotals,
  };
};
