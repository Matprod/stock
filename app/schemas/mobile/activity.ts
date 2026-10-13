import { timeWithSecondsString } from '#schemas/utils/time'
import vine from '@vinejs/vine'

export const addActivityQuerySchema = vine.compile(
  vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
  })
)

export const addActivitySchema = vine.compile(
  vine.object({
    activityTypeId: vine.string(),
  })
)

export const getActivitiesQuerySchema = vine.compile(
  vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
  })
)

export const getActivityParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)

export const updateActivityParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)

export const deleteActivityParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)

export const updateActivitySchema = vine.compile(
  vine.object({
    distance: vine.number().optional(),
    speed: vine.string().optional(),
    duration: timeWithSecondsString().optional(),
    elevation: vine.number().optional(),
    activeCalories: vine.number().optional(),
    power: vine.number().optional(),
    averagedBpm: vine.number().optional(),
    fcMax: vine.number().optional(),
    gameActivity: vine.boolean().optional(),
    sessionComment: vine.string().trim().nullable().optional(),
    carriedWeight: vine.number().optional(),
    weaponWeight: vine.number().optional(),
    burstCount: vine.number().optional(),
    groundImpact: vine.number().optional(),
    descentDuration: timeWithSecondsString().optional(),
    averageDescentSpeed: vine.number().optional(),
    heartExertion: vine.number().optional(),
    freefallDuration: timeWithSecondsString().optional(),
    maxFreefallSpeed: vine.number().optional(),
    canopyDuration: timeWithSecondsString().optional(),
    exerciseSets: vine
      .array(
        vine.object({
          id: vine.string().optional(),
          exerciseId: vine.string(),
          reps: vine.number().optional(),
          weight: vine.number().optional(),
          durationSeconds: vine.number().optional(),
        })
      )
      .optional(),
  })
)
