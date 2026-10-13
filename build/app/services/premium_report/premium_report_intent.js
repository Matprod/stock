import logger from '@adonisjs/core/services/logger';
import { correlationDomains, PREMIUM_CORRELATION_JEV, PREMIUM_CORRELATION_KEYWORDS, PREMIUM_DOMAIN_CATALOG, PREMIUM_DOMAIN_NOUL_THRESHOLD, PREMIUM_DOMAINS, } from '#constants/premium_report_domains';
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants';
import JevService, { noul } from '#services/jev_service';
const CORRELATION_ANSWER_KEY = 'correlation';
const FALLBACK_TOP_DOMAIN_COUNT = 2;
const FALLBACK_MIN_SCORE = 0.1;
export const detectPremiumDomains = async (prompt) => {
    const client = JevService.getClient();
    if (client) {
        try {
            return await detectWithJev(prompt, client);
        }
        catch (error) {
            logger.warn({ err: error }, 'premium_report.intent_jev_failed');
        }
    }
    return detectWithKeywords(prompt);
};
const noulScore = (answers, key) => answers[key]?.noul ?? 0;
const resolveDomains = (selected, scores) => {
    if (selected.size > 0)
        return [...selected];
    if (!scores)
        return [...PREMIUM_DOMAINS];
    const top = PREMIUM_DOMAINS.map((domain) => ({ domain, score: scores[domain] ?? 0 }))
        .sort((left, right) => right.score - left.score)
        .filter((entry) => entry.score >= FALLBACK_MIN_SCORE)
        .slice(0, FALLBACK_TOP_DOMAIN_COUNT)
        .map((entry) => entry.domain);
    return top.length > 0 ? top : [PREMIUM_DOMAINS[0]];
};
const withCorrelation = (selected, correlation) => {
    if (!correlation)
        return;
    for (const domain of correlationDomains())
        selected.add(domain);
};
const detectWithJev = async (prompt, client) => {
    const questions = Object.fromEntries([
        ...PREMIUM_DOMAINS.map((domain) => {
            const { question, trueLabel, falseLabel } = PREMIUM_DOMAIN_CATALOG[domain].jev;
            return [domain, noul(question, { true: trueLabel, false: falseLabel })];
        }),
        [
            CORRELATION_ANSWER_KEY,
            noul(PREMIUM_CORRELATION_JEV.question, {
                true: PREMIUM_CORRELATION_JEV.trueLabel,
                false: PREMIUM_CORRELATION_JEV.falseLabel,
            }),
        ],
    ]);
    const response = await client.systemOne({
        model: JEV_ROUTER_MODEL,
        state: { prompt },
        questions,
    });
    const scores = {};
    for (const domain of PREMIUM_DOMAINS) {
        scores[domain] = noulScore(response.answers, domain);
    }
    const correlationScore = noulScore(response.answers, CORRELATION_ANSWER_KEY);
    const correlation = correlationScore >= PREMIUM_DOMAIN_NOUL_THRESHOLD;
    const selected = new Set(PREMIUM_DOMAINS.filter((domain) => (scores[domain] ?? 0) >= PREMIUM_DOMAIN_NOUL_THRESHOLD));
    for (const domain of keywordMatchedDomains(prompt))
        selected.add(domain);
    withCorrelation(selected, correlation);
    const domains = resolveDomains(selected, scores);
    return { domains, correlation };
};
const keywordMatchedDomains = (prompt) => {
    const q = prompt.toLowerCase();
    return PREMIUM_DOMAINS.filter((domain) => PREMIUM_DOMAIN_CATALOG[domain].keywords.some((word) => keywordHit(q, word)));
};
const keywordHit = (haystack, word) => {
    if (word.includes(' ') || word.length > 5)
        return haystack.includes(word);
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
};
const detectWithKeywords = (prompt) => {
    const selected = new Set(keywordMatchedDomains(prompt));
    const q = prompt.toLowerCase();
    const correlation = PREMIUM_CORRELATION_KEYWORDS.some((word) => keywordHit(q, word));
    withCorrelation(selected, correlation);
    const domains = resolveDomains(selected);
    return { domains, correlation };
};
//# sourceMappingURL=premium_report_intent.js.map