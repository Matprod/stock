import vine from '@vinejs/vine';
export const getTdeeQuerySchema = vine.compile(vine.object({
    date: vine.date({ formats: ['iso8601'] }).optional(),
}));
//# sourceMappingURL=tdee.js.map