import vine from '@vinejs/vine';
export const upsertInjurySchema = vine.compile(vine.object({
    athleteId: vine.string(),
    injuryTypeId: vine.string(),
    startDate: vine.string(),
    endDate: vine.string().optional().nullable(),
    context: vine.enum(['match', 'training', 'other']).optional(),
    note: vine.string().optional(),
}));
export const upsertInjuryParams = vine.compile(vine.object({
    id: vine.string().optional(),
}));
export const getInjuriesSchema = vine.compile(vine.object({
    athleteId: vine.string().optional(),
}));
//# sourceMappingURL=injury.js.map