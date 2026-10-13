import vine from '@vinejs/vine'
import {
  REPORT_BLOC_SPLIT,
  REPORT_BLOC_TYPE,
  REPORT_LINE_DASHES,
  REPORT_CONVERT_UNITS,
  REPORT_FORMULA_IDS,
  REPORT_HEX_COLOR,
  REPORT_SERIES_OP,
  REPORT_CHATBOT_HISTORY_MAX,
  REPORT_CHATBOT_PROMPT_MAX,
  REPORT_TEXT_MAX_LENGTH,
} from '#constants/report_builder.constants'

const isoDateSchema = vine.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const dateRangeSchema = vine.object({
  from: isoDateSchema.clone(),
  to: isoDateSchema.clone(),
})

const seriesSchema = vine.object({
  id: vine.string().trim().minLength(1),
  label: vine.string().trim().minLength(1).optional(),
  op: vine
    .enum([
      REPORT_SERIES_OP.IDENTITY,
      REPORT_SERIES_OP.SUM,
      REPORT_SERIES_OP.SUB,
      REPORT_SERIES_OP.MUL,
      REPORT_SERIES_OP.DIV,
    ])
    .optional(),
  variables: vine.array(vine.string().trim().minLength(1)).minLength(1),
  formula: vine
    .object({
      id: vine.enum(REPORT_FORMULA_IDS),
      params: vine.any().optional(),
    })
    .optional(),
  convert: vine.enum(REPORT_CONVERT_UNITS).optional(),
  color: vine.string().regex(REPORT_HEX_COLOR).optional(),
  dash: vine.enum(REPORT_LINE_DASHES).optional(),
})

const themeSchema = vine.object({
  colors: vine.array(vine.string().regex(REPORT_HEX_COLOR)).minLength(1).maxLength(16).optional(),
})

const blocSchema = vine.object({
  id: vine.string().trim().minLength(1),
  type: vine.enum([
    REPORT_BLOC_TYPE.LINE_CHART,
    REPORT_BLOC_TYPE.BAR_CHART,
    REPORT_BLOC_TYPE.PIE_CHART,
    REPORT_BLOC_TYPE.KPI,
    REPORT_BLOC_TYPE.TABLE,
    REPORT_BLOC_TYPE.TEXT,
  ]),
  variables: vine.array(vine.string().trim().minLength(1)).optional(),
  series: vine.array(seriesSchema.clone()).optional(),
  athleteIds: vine.array(vine.string().trim().minLength(1)).optional(),
  split: vine.enum([REPORT_BLOC_SPLIT.VARIABLE, REPORT_BLOC_SPLIT.ATHLETE]).optional(),
  dateRange: dateRangeSchema.clone().optional(),
  text: vine.string().trim().minLength(1).maxLength(REPORT_TEXT_MAX_LENGTH).optional(),
})

export const generateReportSchema = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).optional(),
    dateRange: dateRangeSchema.clone(),
    blocs: vine.array(blocSchema.clone()),
    theme: themeSchema.clone().optional(),
    useImputedMetrics: vine.boolean().optional(),
  })
)

export const upsertReportSchema = generateReportSchema

export const reportChatbotSchema = vine.compile(
  vine.object({
    prompt: vine.string().trim().minLength(1).maxLength(REPORT_CHATBOT_PROMPT_MAX),
    history: vine
      .array(
        vine.object({
          role: vine.enum(['user', 'assistant'] as const),
          content: vine.string().trim().minLength(1).maxLength(REPORT_CHATBOT_PROMPT_MAX),
        })
      )
      .maxLength(REPORT_CHATBOT_HISTORY_MAX)
      .optional(),
    title: vine.string().trim().minLength(1).optional(),
    dateRange: dateRangeSchema.clone(),
    blocs: vine.array(blocSchema.clone()),
    theme: themeSchema.clone().optional(),
    useImputedMetrics: vine.boolean().optional(),
  })
)

export const catalogQuerySchema = vine.compile(
  vine.object({
    from: isoDateSchema.clone().optional(),
    to: isoDateSchema.clone().optional(),
    useImputedMetrics: vine.enum(['true', 'false']).optional(),
  })
)

export const reportIdParamsSchema = vine.compile(
  vine.object({
    id: vine.string().trim().minLength(1),
  })
)
