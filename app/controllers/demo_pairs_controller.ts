import type { HttpContext } from '@adonisjs/core/http'
import DemoMatchService from '#services/demo_match_service'
import DemoPairService from '#services/demo_pair_service'
import { analyzeAnswerSchema, backfillEmbeddingsSchema, saveFromDemoSchema } from '#schemas/demo_pair'

const service = new DemoPairService()

export default class DemoPairsController {
  private requireToken({ request, response }: Pick<HttpContext, 'request' | 'response'>): boolean {
    if (request.input('token') !== 'CLEM_BOGOSS') {
      response.status(403).send({ error: 'Token invalide' })
      return false
    }
    return true
  }

  public async backfillEmbeddings({ request, response }: HttpContext) {
    if (!this.requireToken({ request, response })) return

    const { force, nullOnly } = await backfillEmbeddingsSchema.validate(request.qs())
    const results = await service.backfillEmbeddings(force ?? false, nullOnly ?? false)

    return response.json({ backfilled: results.length, results })
  }

  public async analyzeAnswer({ request, response }: HttpContext) {
    if (!this.requireToken({ request, response })) return

    const { question, answer } = await analyzeAnswerSchema.validate(request.body())
    const analysis = await service.analyzeAnswer(question, answer)
    return response.json({ analysis })
  }

  public async timeVariantQuestions({ request, response }: HttpContext) {
    if (!this.requireToken({ request, response })) return

    const pairs = request.input('pairs') ?? []
    const results = await service.generateTimeVariantQuestions(pairs)
    return response.json({ total: results.length, results })
  }

  public async saveFromDemo({ request, response }: HttpContext) {
    const { question, answer, chartData, referenceDate, category } = await saveFromDemoSchema.validate(request.body())
    const pair = await service.saveFromDemo({
      question,
      answer,
      chartData: chartData ?? null,
      referenceDate: referenceDate.toISOString().slice(0, 10),
      category: category ?? null,
    })
    return response.json({ saved: true, id: pair.id })
  }

  public async deletePair({ params, response }: HttpContext) {
    await service.deletePair(String(params.id))
    return response.json({ deleted: true, id: params.id })
  }

  public async invalidateCache({ response }: HttpContext) {
    DemoMatchService.invalidateCache()
    return response.json({ invalidated: true })
  }
}
