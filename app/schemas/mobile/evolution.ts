import vine from '@vinejs/vine'

export const getEvolutionQuerySchema = vine.compile(
  vine.object({
    startDate: vine.date({ formats: ['iso8601'] }),
    endDate: vine.date({ formats: ['iso8601'] }),
  })
)
