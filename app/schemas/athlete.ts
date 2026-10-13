import vine from '@vinejs/vine'
import { INSIGHT_CATEGORIES } from '#constants/insight.constants'

export const athleteIdSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)

export const getAthleteSchema = vine.compile(
  vine.object({
    allTime: vine.boolean().optional(),
  })
)

export const getInsightsSchema = vine.compile(
  vine.object({
    date: vine.string(),
    type: vine.enum(INSIGHT_CATEGORIES),
    allTime: vine.boolean().optional(),
  })
)

export const athleteIdParamSchema = vine.compile(
  vine.object({
    athleteId: vine.string(),
  })
)

export const tdeeSchema = vine.compile(
  vine.object({
    athlete_id: vine.string(),
    date: vine.string().optional(),
  })
)

export const bmrSchema = vine.compile(
  vine.object({
    athlete_id: vine.string(),
  })
)
