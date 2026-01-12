import type {
  FoodItem,
  MacronutrientType,
  Meal,
  MealsFilled,
  NutritionDetail,
  APINutrition,
} from "../types/nutrition.types";

export const getMealName = (mealType: string): string => {
  const mealNames: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
    "snack am": "Morning Snack",
    snackam: "Morning Snack",
    "snack pm": "Evening Snack",
    snackpm: "Evening Snack",
  };
  const normalizedType = mealType.toLowerCase().replace(" ", "");
  return mealNames[normalizedType] || mealNames[mealType.toLowerCase()] || mealType;
};

export const getMacroValue = (
  obj: Meal | FoodItem | NutritionDetail,
  macro: MacronutrientType,
): number => {
  const key = `total${macro.charAt(0).toUpperCase() + macro.slice(1)}` as keyof typeof obj;
  return (obj[key] as number) || (obj[macro as keyof typeof obj] as number) || 0;
};

export const getMacroUnit = (macro: MacronutrientType): string => {
  return macro === "calories" ? "kcal" : "g";
};

export const calculateProportionalValue = (
  baseValue: number,
  portion: number,
  quantity = 1,
): number => {
  const portionFactor = portion / 100;
  return baseValue * portionFactor * quantity;
};

export const getMealTypeKey = (mealName: string): keyof MealsFilled | "snack" | null => {
  const lowerName = mealName.toLowerCase();

  if (lowerName.includes("petit") || lowerName.includes("breakfast")) return "breakfast";
  if (lowerName.includes("déjeuner") || lowerName.includes("lunch")) return "lunch";
  if (lowerName.includes("dîner") || lowerName.includes("dinner")) return "dinner";
  if (lowerName.includes("collation matin") || lowerName.includes("morning snack"))
    return "snackAM";
  if (lowerName.includes("collation soir") || lowerName.includes("evening snack")) return "snackPM";
  if (lowerName.includes("collation") || lowerName.includes("snack")) return "snack";

  return null;
};

export const sortMealTypes = (mealTypes: string[]) => {
  const mealOrder = ["breakfast", "snackAM", "lunch", "snackPM", "dinner"];

  return [...mealTypes].sort((a, b) => {
    const indexA = mealOrder.indexOf(a);
    const indexB = mealOrder.indexOf(b);

    if (indexA === -1) return 1;
    if (indexB === -1) return -1;

    return indexA - indexB;
  });
};

export const groupNutritionByMealType = (
  nutrition: APINutrition[],
): Map<string, APINutrition[]> => {
  const mealsMap = new Map<string, APINutrition[]>();

  nutrition.forEach((item) => {
    const mealType = item.mealType?.toLowerCase();
    if (!mealType) return;

    if (!mealsMap.has(mealType)) {
      mealsMap.set(mealType, []);
    }
    mealsMap.get(mealType)!.push(item);
  });

  return mealsMap;
};

export const isMealFilled = (mealName: string, mealsFilled?: MealsFilled): boolean => {
  if (!mealsFilled) return false;

  const mealTypeKey = getMealTypeKey(mealName);

  if (mealTypeKey === "snack") {
    return mealsFilled.snackAM || mealsFilled.snackPM;
  }

  if (mealTypeKey) {
    return mealsFilled[mealTypeKey as keyof MealsFilled];
  }

  return false;
};
