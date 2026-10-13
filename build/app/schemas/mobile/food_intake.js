import vine from '@vinejs/vine';
export const getFoodIntakesQuerySchema = vine.compile(vine.object({
    sportActivityId: vine.string(),
}));
export const createFoodIntakeSchema = vine.compile(vine.object({
    sportActivityId: vine.string(),
    foodId: vine.string().nullable().optional(),
    llmAlimentId: vine.string().nullable().optional(),
    quantity: vine.number().optional(),
    portion: vine.number().nullable().optional(),
}));
export const deleteFoodIntakeParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=food_intake.js.map