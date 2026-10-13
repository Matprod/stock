import vine from '@vinejs/vine'
import {
  PREMIUM_BLOCK_TYPES,
  PREMIUM_REPORT_HISTORY_MAX,
} from '#constants/premium_report.constants'
import { PREMIUM_DOMAINS } from '#constants/premium_report_domains'
import {
  REPORT_DESIGN_PACK_IDS,
  REPORT_V4_ISO_DATE_PATTERN,
  REPORT_V4_MAX_BLOCKS,
  REPORT_V4_PROMPT_MAX,
} from '#services/report_v4/report_v4_constants'

const isoDateSchema = vine.string().regex(new RegExp(REPORT_V4_ISO_DATE_PATTERN))

const dateRangeSchema = vine.object({
  from: isoDateSchema.clone(),
  to: isoDateSchema.clone(),
})

const blockSchema = vine.object({
  id: vine.string().trim().minLength(1),
  type: vine.enum(PREMIUM_BLOCK_TYPES),
  text: vine.string().optional().nullable(),
  level: vine.number().optional().nullable(),
  title: vine.string().optional().nullable(),
  option: vine.any().optional().nullable(),
  columns: vine.array(vine.string()).optional(),
  rows: vine.array(vine.array(vine.any().nullable())).optional(),
})

const documentSchema = vine.object({
  title: vine.string().optional(),
  dateRange: dateRangeSchema.clone(),
  athleteIds: vine.array(vine.string().trim().minLength(1)).optional(),
  blocks: vine.array(blockSchema.clone()).maxLength(REPORT_V4_MAX_BLOCKS),
})

const historySchema = vine
  .array(
    vine.object({
      role: vine.enum(['user', 'assistant'] as const),
      content: vine.string().trim().minLength(1).maxLength(REPORT_V4_PROMPT_MAX),
    })
  )
  .maxLength(PREMIUM_REPORT_HISTORY_MAX)

const sessionFocusSchema = vine.object({
  lastPrompt: vine.string().trim().maxLength(500),
  domains: vine.array(vine.enum(PREMIUM_DOMAINS)).maxLength(PREMIUM_DOMAINS.length),
  fetches: vine
    .array(
      vine.object({
        domain: vine.enum(PREMIUM_DOMAINS),
        from: isoDateSchema.clone(),
        to: isoDateSchema.clone(),
        label: vine.string().trim().maxLength(200).optional(),
      })
    )
    .maxLength(24),
  displayRange: dateRangeSchema.clone(),
  askRound: vine.number().min(0).max(1).optional(),
  pendingAskIds: vine.array(vine.string().trim().maxLength(64)).maxLength(8).optional(),
})

export const fullStaffReportGenerateSchema = vine.compile(
  vine.object({
    prompt: vine.string().trim().minLength(1).maxLength(REPORT_V4_PROMPT_MAX),
    history: historySchema.clone().optional(),
    sessionFocus: sessionFocusSchema.clone().optional(),
    document: documentSchema.clone().optional(),
    /** Prior free-HTML artifact — enables soft edits without redesigning the canvas. */
    html: vine.string().maxLength(2_500_000).optional(),
    designPackId: vine.enum(REPORT_DESIGN_PACK_IDS).optional(),
    skipPdf: vine.boolean().optional(),
  })
)

export const fullStaffReportExportPdfSchema = vine.compile(
  vine.object({
    html: vine.string().trim().minLength(400).maxLength(2_500_000),
    filename: vine.string().trim().maxLength(200).optional(),
  })
)
