import vine from '@vinejs/vine';
export const upsertDiseaseSchema = vine.compile(vine.object({
    athleteId: vine.string(),
    dateOfDisease: vine.string(),
    recoveryDate: vine.string().optional().nullable(),
    name: vine.string().trim().minLength(1),
    note: vine.string().optional(),
}));
export const upsertDiseaseParams = vine.compile(vine.object({
    id: vine.string().optional(),
}));
export const getDiseasesSchema = vine.compile(vine.object({
    athleteId: vine.string().optional(),
}));
export const deleteDiseaseParams = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=disease.js.map