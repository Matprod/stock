import { DateTime } from 'luxon';
import DemoPair from '#models_pg/demo_pair';
import DemoMatchService from '#services/demo_match_service';
import { getEmbedding, generateVariants, generateTimeVariants, needsVariants, invokeClaude, } from '#services/embedding_service';
export default class DemoPairService {
    static parseChartData(raw) {
        if (!raw)
            return null;
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            }
            catch {
                return null;
            }
        }
        return raw;
    }
    async buildEmbeddings(question) {
        if (!needsVariants(question)) {
            const embedding = await getEmbedding(question);
            return { embedding, variants: null, variantEmbeddings: null };
        }
        const [embedding, variants] = await Promise.all([
            getEmbedding(question),
            generateVariants(question),
        ]);
        const variantEmbeddings = await Promise.all(variants.map((v) => getEmbedding(v)));
        return { embedding, variants, variantEmbeddings };
    }
    async findOrUpsertPair(question, category, refDate, fields) {
        const existing = await DemoPair.query()
            .where('question', question)
            .where((q) => (category ? q.where('category', category) : q.whereNull('category')))
            .where('reference_date', refDate.toFormat('yyyy-MM-dd'))
            .first();
        if (existing) {
            existing.merge({ ...fields, isActive: true });
            await existing.save();
            return existing;
        }
        return DemoPair.create({ question, category, referenceDate: refDate, isActive: true, ...fields });
    }
    async backfillEmbeddings(forceRefresh, nullOnly) {
        const pairs = await DemoPair.query()
            .where('isActive', true)
            .where((q) => {
            if (nullOnly)
                q.whereNull('category');
            if (!forceRefresh)
                q.whereNull('variant_embeddings');
        });
        const results = [];
        for (const pair of pairs) {
            try {
                const { embedding, variants, variantEmbeddings } = await this.buildEmbeddings(pair.question);
                if (!pair.embedding)
                    pair.embedding = embedding;
                if (variants && (forceRefresh || !pair.variantEmbeddings)) {
                    pair.variants = variants;
                    pair.variantEmbeddings = variantEmbeddings;
                }
                await pair.save();
                results.push({ id: pair.id, question: pair.question.slice(0, 60), ok: true });
            }
            catch (err) {
                console.error(`[backfillEmbeddings] pair ${pair.id} failed:`, err?.message ?? err);
                results.push({ id: pair.id, question: pair.question.slice(0, 60), ok: false });
            }
        }
        DemoMatchService.invalidateCache();
        return results;
    }
    async analyzeAnswer(question, answer) {
        return invokeClaude(`You are reviewing pre-stored answers in a sports analytics chatbot demo. Evaluate the quality of this answer.

Question: "${question}"

Answer:
${answer}

Evaluate on these criteria:
1. **Relevance** — Does the answer actually address the question?
2. **Completeness** — Is the answer sufficiently detailed or is it vague/missing key info?
3. **Accuracy** — Does the data cited seem plausible and internally consistent?
4. **Clarity** — Is it well structured and easy to understand?
5. **Time horizon** — If the question specifies a time period, does the answer respect it?

Conclude with one of:
- ✅ GOOD — suitable for demo use
- ⚠️ ACCEPTABLE — usable but could be improved
- ❌ POOR — should be re-generated

Be concise. Max 10 lines.`, 600);
    }
    async generateTimeVariantQuestions(pairs) {
        const results = [];
        for (const pair of pairs) {
            try {
                const variants = await generateTimeVariants(pair.question);
                if (variants.length > 0) {
                    results.push({
                        originalId: pair.id,
                        originalQuestion: pair.question,
                        category: pair.category,
                        referenceDate: pair.referenceDate,
                        variants,
                    });
                }
            }
            catch (err) {
                console.error(`[timeVariantQuestions] pair ${pair.id} failed:`, err?.message);
            }
        }
        return results;
    }
    async saveFromDemo(data) {
        const refDate = DateTime.fromISO(data.referenceDate);
        const { embedding, variants, variantEmbeddings } = await this.buildEmbeddings(data.question);
        const pair = await this.findOrUpsertPair(data.question, data.category, refDate, {
            answer: data.answer,
            chartData: data.chartData,
            embedding,
            variants,
            variantEmbeddings,
        });
        DemoMatchService.invalidateCache();
        console.log(`[demo][save-from-demo] id=${pair.id} question="${data.question.slice(0, 60)}"`);
        return pair;
    }
    async deletePair(id) {
        const pair = await DemoPair.findOrFail(id);
        await pair.delete();
        DemoMatchService.invalidateCache();
    }
}
//# sourceMappingURL=demo_pair_service.js.map