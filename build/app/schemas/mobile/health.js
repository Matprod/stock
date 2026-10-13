import vine from '@vinejs/vine';
export const getHealthSchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const getExtraHealthParamsSchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const upsertExtraHealthParamsSchema = vine.compile(vine.object({
    fcMax: vine.number().nullable(),
}));
export const addHealthQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addHealthSchema = vine.compile(vine.object({
    ratings: vine.record(vine.number().nullable()).optional(),
    metrics: vine.record(vine.number().nullable()).optional(),
    pains: vine
        .array(vine.object({
        id: vine.string().nullable(),
        location: vine.string(),
        rating: vine.number().min(1).max(5),
    }))
        .optional(),
}));
//# sourceMappingURL=health.js.map