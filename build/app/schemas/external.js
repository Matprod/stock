import vine from '@vinejs/vine';
const isoDate = vine.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const getExternalScoresSchema = vine.compile(vine.object({
    from: isoDate.clone(),
    to: isoDate.clone(),
    athleteId: vine.string().optional(),
}));
//# sourceMappingURL=external.js.map