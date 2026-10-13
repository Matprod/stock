import vine from '@vinejs/vine'

export interface SleepQualityBounds {
  min: number
  max: number
}

export const getSleepsSchema = vine.compile(
  vine.object({
    from: vine.date({ formats: ['iso8601'] }),
    to: vine.date({ formats: ['iso8601'] }),
    athleteId: vine.string().optional(),
  })
)

export const upsertSleepSchema = (bounds: SleepQualityBounds) =>
  vine.compile(
    vine.object({
      date: vine.date({ formats: ['iso8601'] }),
      athleteId: vine.string(),
      bedtimeDate: vine.date({ formats: ['iso8601'] }),
      wakeUpDate: vine.date({ formats: ['iso8601'] }),
      qualityRating: vine.number().min(bounds.min).max(bounds.max),
    })
  )

export const deleteSleepParamsSchema = vine.compile(
  vine.object({
    id: vine.string(),
  })
)
