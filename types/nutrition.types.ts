export interface FoodItem {
  id: number;
  name: string;
  nameFr?: string;
  nameEn?: string;
  portion: number;
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
}

export interface Meal {
  id: number;
  name: string;
  nameFr?: string;
  nameEn?: string;
  type: "breakfast" | "lunch" | "dinner" | "snack" | "snackAM" | "snackPM";
  foods: FoodItem[];
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalCalories: number;
  date: string;
}

export interface NutritionDetail {
  athleteId: number;
  date: string;
  meals: Meal[];
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalCalories: number;
}

export interface APINutrition {
  id: number;
  mealType: string;
  quantity: number;
  portion: number;
  dateAdded?: string;
  dateUpdated?: string;
  meal: APIMeal | null;
  chatgptMeal?: APIMeal | null;
  recipe?: APIRecipe | null;
}

export interface APIMeal {
  id: number;
  name: string;
  nameFr?: string;
  nameEn?: string;
  energyKcal: number;
  proteinsG: number;
  carbohydrateG: number;
  fatG: number;
}

export interface APIRecipe {
  id: number;
  name: string;
  mealType: string;
  dateAdded?: string;
  dateUpdated?: string;
  recipeMeals: APIRecipeMeal[];
}

export interface APIRecipeMeal {
  id: number;
  quantity: number;
  portion: number;
  meal: APIMeal;
}

export interface APINutritionDay {
  id: number;
  athleteId: number;
  dateOfDay: string;
  nutrition: APINutrition[];
}

export interface MealsFilled {
  breakfast: boolean;
  lunch: boolean;
  snackAM: boolean;
  dinner: boolean;
  snackPM: boolean;
}

export const MACRO_OPTIONS = ["protein", "carbs", "fats", "calories"] as const;
export type MacronutrientType = (typeof MACRO_OPTIONS)[number];
