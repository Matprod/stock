import vine from '@vinejs/vine'

export const backfillEmbeddingsSchema = vine.compile(
  vine.object({
    force: vine.boolean().optional(),
    nullOnly: vine.boolean().optional(),
  })
)

export const analyzeAnswerSchema = vine.compile(
  vine.object({
    question: vine.string(),
    answer: vine.string(),
  })
)

export const saveFromDemoSchema = vine.compile(
  vine.object({
    question: vine.string(),
    answer: vine.string(),
    referenceDate: vine.date({ formats: ['YYYY-MM-DD'] }),
    chartData: vine.any().optional(),
    category: vine.enum(['performance', 'injury'] as const).optional(),
  })
)
