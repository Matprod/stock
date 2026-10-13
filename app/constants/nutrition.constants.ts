export const MIN_NUTRITION_SEARCH_LENGTH = 3

export const NUTRITION_SUMMARY_MIN_FILLED_MEALS = 2
export const NUTRITION_SUMMARY_MAX_GENERATIONS_PER_DAY = 7

export const JOURNAL_MEAL_TYPES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
] as const

export const NUTRITION_MEAL_TYPES = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK_AM: 'Snack AM',
  SNACK_PM: 'Snack PM',
  INTAKES: 'intakes',
  EFFORT_NUTRITION: 'Effort Nutrition',
} as const

export type NutritionMealType = (typeof NUTRITION_MEAL_TYPES)[keyof typeof NUTRITION_MEAL_TYPES]

export const SNACK_DB_MEAL_TYPES = [
  NUTRITION_MEAL_TYPES.SNACK_AM,
  NUTRITION_MEAL_TYPES.SNACK_PM,
  'Snack',
  'Snacks',
] as const
