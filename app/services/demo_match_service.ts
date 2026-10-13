import DemoPair from '#models_pg/demo_pair'
import { getEmbedding, cosineSimilarity, selectWithHaiku } from '#services/embedding_service'
import type { StoredChart } from '#utils/chart'

const FALLBACK_REFERENCE_DATE = '2025-09-03'

type CachedPair = {
  question: string
  answer: string
  referenceDate: string
  category: 'performance' | 'injury' | null
  chartData: StoredChart | null
  embeddings: number[][]
}

export default class DemoMatchService {
  private static pairs: CachedPair[] = []
  private static loadingPromise: Promise<void> | null = null

  private async load() {
    DemoMatchService.loadingPromise ??= (async () => {
      const rows = await DemoPair.query().where('isActive', true).whereNotNull('embedding')

      DemoMatchService.pairs = rows.map((r) => {
        const main = r.embedding as unknown as number[]
        const variants = (r.variantEmbeddings as unknown as number[][] | null) ?? []
        return {
          question: r.question,
          answer: r.answer,
          referenceDate: r.referenceDate
            ? r.referenceDate.toFormat('yyyy-MM-dd')
            : FALLBACK_REFERENCE_DATE,
          category: r.category,
          chartData: (r.chartData as StoredChart | null) ?? null,
          embeddings: [main, ...variants],
        }
      })
    })()
    await DemoMatchService.loadingPromise
  }

  async match(
    query: string,
    date: string,
    category: 'performance' | 'injury' = 'performance',
    threshold = 0.75
  ): Promise<{
    answer: string
    matchedQuestion: string
    score: number
    chartData: StoredChart | null
  } | null> {
    await this.load()

    const candidates = DemoMatchService.pairs.filter(
      (p) => p.referenceDate === date && (p.category === null || p.category === category)
    )
    if (candidates.length === 0) {
      const dates = [...new Set(DemoMatchService.pairs.map((p) => p.referenceDate))].join(', ')
      console.log(
        `[demo] no candidates for date=${date} category=${category} — available dates: ${dates}`
      )
      return null
    }

    // ── LLM path: Haiku selects the best match directly ──────────────────────
    try {
      const idx = await selectWithHaiku(query, candidates)
      if (idx !== null) {
        const selected = candidates[idx]
        const queryEmbedding = await getEmbedding(query)
        const score = selected.embeddings.reduce(
          (best, emb) => Math.max(best, cosineSimilarity(queryEmbedding, emb)),
          -Infinity
        )
        console.log(
          `[demo][llm]   selected="${selected.question.slice(0, 60)}" cosine=${score.toFixed(3)}`
        )
        return {
          answer: selected.answer,
          matchedQuestion: selected.question,
          score,
          chartData: selected.chartData,
        }
      }
      console.log('[demo][llm]   no match (returned 0)')
      return null
    } catch (err: any) {
      console.log(`[demo][llm]   error: ${err?.message ?? err} — falling back to cosine`)
    }

    // ── Cosine fallback (Haiku unavailable) ──────────────────────────────────
    const queryEmbedding = await getEmbedding(query)
    const scored = candidates
      .map((pair) => ({
        pair,
        score: pair.embeddings.reduce(
          (best, emb) => Math.max(best, cosineSimilarity(queryEmbedding, emb)),
          -Infinity
        ),
      }))
      .sort((a, b) => b.score - a.score)

    const best = scored[0]
    console.log(
      `[demo][cosine] best=${best.score.toFixed(3)} threshold=${threshold} matched="${best.pair.question.slice(0, 60)}"`
    )

    if (best.score < threshold) return null
    return {
      answer: best.pair.answer,
      matchedQuestion: best.pair.question,
      score: best.score,
      chartData: best.pair.chartData,
    }
  }

  static invalidateCache() {
    DemoMatchService.loadingPromise = null
    DemoMatchService.pairs = []
  }
}
