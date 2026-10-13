import vine from '@vinejs/vine'

export const generateMobileActivitySummarySchema = vine.compile(
  vine.object({
    entity_id: vine.string().optional(),
    date: vine.string(),
    is_delete: vine.boolean().optional(),
  })
)

export const generateMobileNutritionSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const generateMobileSleepSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const generateMobileHealthSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
    is_delete: vine.boolean().optional(),
  })
)

export const getMobileActivitySummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
    entity_id: vine.string().optional(),
  })
)

export const getMobileNutritionSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const getMobileSleepSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const getMobileHealthSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

