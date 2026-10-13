import vine from '@vinejs/vine';
export const updateSubjectiveFieldsSchema = vine.compile(vine.array(vine.object({
    id: vine.string(),
    value: vine.number().nullable(),
})));
export const updateSubjectiveFieldsParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
export const getActivityTypeDisplayVariablesParamsSchema = vine.compile(vine.object({
    activityTypeId: vine.string(),
}));
export const upsertActivityPainParamsSchema = vine.compile(vine.object({
    sportActivityId: vine.string(),
}));
export const upsertActivityPainSchema = vine.compile(vine.object({
    rating: vine.number().min(1).max(5),
    locationId: vine.string(),
}));
export const deleteActivityPainParamsSchema = vine.compile(vine.object({
    painId: vine.string(),
}));
export const getHeartRatePointsParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=sport_activity_schema.js.map