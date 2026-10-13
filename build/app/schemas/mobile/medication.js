import vine from '@vinejs/vine';
export const getMedicationsQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addMedicationQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addMedicationSchema = vine.compile(vine.object({
    foodsupplements: vine.array(vine.object({
        id: vine.string().nullable(),
        quantity: vine.number().positive(),
        suppNameId: vine.string(),
    })),
}));
//# sourceMappingURL=medication.js.map