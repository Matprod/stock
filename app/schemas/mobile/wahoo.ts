import vine from '@vinejs/vine'

export const wahooTokenQuerySchema = vine.compile(
  vine.object({
    code: vine.string(),
  })
)
