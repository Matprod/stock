import vine from '@vinejs/vine';
import { PREMIUM_BLOCK_TYPES, PREMIUM_REPORT_HISTORY_MAX, PREMIUM_REPORT_MAX_BLOCKS, PREMIUM_REPORT_PROMPT_MAX, } from '#constants/premium_report.constants';
const isoDateSchema = vine.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateRangeSchema = vine.object({
    from: isoDateSchema.clone(),
    to: isoDateSchema.clone(),
});
const cellSchema = vine.any().nullable();
const blockSchema = vine.object({
    id: vine.string().trim().minLength(1),
    type: vine.enum(PREMIUM_BLOCK_TYPES),
    text: vine.string().optional().nullable(),
    level: vine.number().optional().nullable(),
    title: vine.string().optional().nullable(),
    option: vine.any().optional().nullable(),
    columns: vine.array(vine.string()).optional(),
    rows: vine.array(vine.array(cellSchema.clone())).optional(),
});
const documentSchema = vine.object({
    title: vine.string().optional(),
    dateRange: dateRangeSchema.clone(),
    athleteIds: vine.array(vine.string().trim().minLength(1)).optional(),
    blocks: vine.array(blockSchema.clone()).maxLength(PREMIUM_REPORT_MAX_BLOCKS),
});
export const premiumReportGenerateSchema = vine.compile(vine.object({
    prompt: vine.string().trim().minLength(1).maxLength(PREMIUM_REPORT_PROMPT_MAX),
    dateRange: dateRangeSchema.clone(),
    athleteIds: vine.array(vine.string().trim().minLength(1)).optional(),
    history: vine
        .array(vine.object({
        role: vine.enum(['user', 'assistant']),
        content: vine.string().trim().minLength(1).maxLength(PREMIUM_REPORT_PROMPT_MAX),
    }))
        .maxLength(PREMIUM_REPORT_HISTORY_MAX)
        .optional(),
    document: documentSchema.clone().optional(),
}));
export const premiumReportPdfSchema = vine.compile(vine.object({
    document: documentSchema.clone(),
}));
//# sourceMappingURL=premium_report.js.map