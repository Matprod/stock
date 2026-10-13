import vine from '@vinejs/vine'

export const generateActivitySummarySchema = vine.compile(
  vine.object({
    entityId: vine.string().optional(),
    date: vine.string(),
    athleteId: vine.string(),
    is_delete: vine.boolean().optional(),
  })
)

export const generateNutritionSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
    athleteId: vine.string(),
  })
)

export const generateHealthSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
    athleteId: vine.string(),
    is_delete: vine.boolean().optional(),
  })
)

export const generateSleepSummarySchema = vine.compile(
  vine.object({
    date: vine.string(),
    athleteId: vine.string(),
  })
)

export const getActivitySummaryParamsSchema = vine.compile(
  vine.object({
    entityId: vine.string().optional(),
    date: vine.string(),
  })
)

export const getActivitySummaryQuerySchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const getNutritionSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const getNutritionSummaryQuerySchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const getHealthSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const getHealthSummaryQuerySchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const getSleepSummaryParamsSchema = vine.compile(
  vine.object({
    date: vine.string(),
  })
)

export const getSleepSummaryQuerySchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)
