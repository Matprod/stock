import vine from '@vinejs/vine';
export const getHealthsSchema = vine.compile(vine.object({
    from: vine.date({ formats: ['iso8601'] }),
    to: vine.date({ formats: ['iso8601'] }),
    athleteId: vine.string().optional(),
}));
export const upsertHealthSchema = vine.compile(vine.object({
    athleteId: vine.string(),
    date: vine.date({ formats: ['iso8601'] }),
    ratings: vine.record(vine.number().nullable()).optional(),
    metrics: vine.record(vine.number().nullable()).optional(),
}));
export const deleteHealthParamsSchema = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=health.js.map