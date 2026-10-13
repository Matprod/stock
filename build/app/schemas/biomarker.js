import vine from '@vinejs/vine';
const MAX_BIOMARKER_BATCH_SIZE = 1000;
export const getAllBiomarkersQuerySchema = vine.compile(vine.object({
    cursor: vine.number().optional(),
    athleteId: vine.string().optional(),
    biomarkerTypeId: vine.string().optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
}));
const biomarkerPayload = vine.object({
    athleteId: vine.string(),
    biomarkerTypeId: vine.string(),
    value: vine.string().trim(),
    measuredAt: vine.date({ formats: ['iso8601'] }),
});
export const updateBiomarkerSchema = vine.compile(biomarkerPayload);
export const createBiomarkersSchema = vine.compile(vine.array(biomarkerPayload).minLength(1).maxLength(MAX_BIOMARKER_BATCH_SIZE));
export const biomarkerIdParams = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=biomarker.js.map