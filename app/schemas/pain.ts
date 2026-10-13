import vine from '@vinejs/vine'

export const getAllPainsSchema = vine.compile(
  vine.object({
    athleteId: vine.string().optional(),
  })
)

export const getAllPainsBySportActivityIdParamsSchema = vine.compile(
  vine.object({
    sportActivityId: vine.string(),
  })
)
