import vine from '@vinejs/vine'

export const calendarDateRangeQuerySchema = vine.compile(
  vine.object({
    startDate: vine.date({ formats: ['iso8601'] }),
    endDate: vine.date({ formats: ['iso8601'] }),
  })
)

export const calendarEventParamsSchema = vine.compile(
  vine.object({
    id: vine.string().trim().minLength(1),
  })
)
