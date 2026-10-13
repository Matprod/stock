import vine from '@vinejs/vine'

export const analyzeNutritionFromItemsSchema = vine.compile(
  vine.object({
    foodItems: vine
      .array(
        vine.object({
          name: vine.string().trim(),
          portion: vine.number(),
        })
      )
      .minLength(1),
    dateOfMeal: vine.string().trim().optional(),
    mealType: vine.string().trim().optional(),
    sportActivityId: vine.string().optional(),
    persist: vine.boolean().optional(),
  })
)
