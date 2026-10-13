import vine from '@vinejs/vine'

export const agentChatSchema = vine.compile(
  vine.object({
    question: vine.string().minLength(1),
  })
)
