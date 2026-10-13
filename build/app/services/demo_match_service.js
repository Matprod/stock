import DemoPair from '#models_pg/demo_pair';
import { getEmbedding, cosineSimilarity, selectWithHaiku } from '#services/embedding_service';
const FALLBACK_REFERENCE_DATE = '2025-09-03';
export default class DemoMatchService {
    static pairs = [];
    static loadingPromise = null;
    async load() {
        DemoMatchService.loadingPromise ??= (async () => {
            const rows = await DemoPair.query().where('isActive', true).whereNotNull('embedding');
            DemoMatchService.pairs = rows.map((r) => {
                const main = r.embedding;
                const variants = r.variantEmbeddings ?? [];
                return {
                    question: r.question,
                    answer: r.answer,
                    referenceDate: r.referenceDate
                        ? r.referenceDate.toFormat('yyyy-MM-dd')
                        : FALLBACK_REFERENCE_DATE,
                    category: r.category,
                    chartData: r.chartData ?? null,
                    embeddings: [main, ...variants],
                };
            });
        })();
        await DemoMatchService.loadingPromise;
    }
    async match(query, date, category = 'performance', threshold = 0.75) {
        await this.load();
        const candidates = DemoMatchService.pairs.filter((p) => p.referenceDate === date && (p.category === null || p.category === category));
        if (candidates.length === 0) {
            const dates = [...new Set(DemoMatchService.pairs.map((p) => p.referenceDate))].join(', ');
            console.log(`[demo] no candidates for date=${date} category=${category} — available dates: ${dates}`);
            return null;
        }
        try {
            const idx = await selectWithHaiku(query, candidates);
            if (idx !== null) {
                const selected = candidates[idx];
                const queryEmbedding = await getEmbedding(query);
                const score = selected.embeddings.reduce((best, emb) => Math.max(best, cosineSimilarity(queryEmbedding, emb)), -Infinity);
                console.log(`[demo][llm]   selected="${selected.question.slice(0, 60)}" cosine=${score.toFixed(3)}`);
                return {
                    answer: selected.answer,
                    matchedQuestion: selected.question,
                    score,
                    chartData: selected.chartData,
                };
            }
            console.log('[demo][llm]   no match (returned 0)');
            return null;
        }
        catch (err) {
            console.log(`[demo][llm]   error: ${err?.message ?? err} — falling back to cosine`);
        }
        const queryEmbedding = await getEmbedding(query);
        const scored = candidates
            .map((pair) => ({
            pair,
            score: pair.embeddings.reduce((best, emb) => Math.max(best, cosineSimilarity(queryEmbedding, emb)), -Infinity),
        }))
            .sort((a, b) => b.score - a.score);
        const best = scored[0];
        console.log(`[demo][cosine] best=${best.score.toFixed(3)} threshold=${threshold} matched="${best.pair.question.slice(0, 60)}"`);
        if (best.score < threshold)
            return null;
        return {
            answer: best.pair.answer,
            matchedQuestion: best.pair.question,
            score: best.score,
            chartData: best.pair.chartData,
        };
    }
    static invalidateCache() {
        DemoMatchService.loadingPromise = null;
        DemoMatchService.pairs = [];
    }
}
//# sourceMappingURL=demo_match_service.js.map