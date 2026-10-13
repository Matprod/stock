import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import logger from '@adonisjs/core/services/logger';
import { HAIKU_ROUTER_MODEL_ID, JEV_ROUTER_MODEL, ROUTER_CLASSIFIER_PROMPT_TITLE, ROUTER_PROVIDER, ROUTER_ROUTE, } from '#constants/question_router.constants';
import Prompt from '#models_pg/prompt';
import JevService, { choice } from '#services/jev_service';
import env from '#start/env';
const loadClassifierPrompt = () => Prompt.findByOrFail('title', ROUTER_CLASSIFIER_PROMPT_TITLE).then((p) => p.content);
const bedrockClient = new BedrockRuntimeClient({
    region: env.get('AWS_REGION'),
    credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY'),
        secretAccessKey: env.get('AWS_SECRET_KEY'),
    },
});
const resolveProvider = () => {
    const configured = env.get('QUESTION_ROUTER_PROVIDER');
    if (configured === ROUTER_PROVIDER.HAIKU)
        return ROUTER_PROVIDER.HAIKU;
    if (configured === ROUTER_PROVIDER.JEV)
        return ROUTER_PROVIDER.JEV;
    return JevService.isAvailable() ? ROUTER_PROVIDER.JEV : ROUTER_PROVIDER.HAIKU;
};
export const classifyQuestion = async (question, history = []) => {
    const provider = resolveProvider();
    const compare = env.get('QUESTION_ROUTER_COMPARE') === true;
    if (compare) {
        const [primary, other] = await Promise.all([
            provider === ROUTER_PROVIDER.JEV
                ? classifyWithJev(question, history)
                : classifyWithHaiku(question, history),
            provider === ROUTER_PROVIDER.JEV
                ? classifyWithHaiku(question, history)
                : classifyWithJev(question, history),
        ]);
        logger.info({
            provider,
            primary: {
                route: primary.route,
                durationMs: primary.durationMs,
                confidence: primary.confidence,
            },
            other: { route: other.route, durationMs: other.durationMs, confidence: other.confidence },
            agree: primary.route === other.route,
        }, 'question_router.compare');
        return primary;
    }
    try {
        if (provider === ROUTER_PROVIDER.JEV) {
            return await classifyWithJev(question, history);
        }
        return await classifyWithHaiku(question, history);
    }
    catch (error) {
        logger.warn({ err: error, provider }, 'question_router.failed — falling back to chatbot_ml');
        if (provider === ROUTER_PROVIDER.JEV) {
            try {
                return await classifyWithHaiku(question, history);
            }
            catch (haikuError) {
                logger.warn({ err: haikuError }, 'question_router.haiku_fallback_failed');
            }
        }
        return {
            route: ROUTER_ROUTE.CHATBOT_ML,
            intent: 'general',
            reason: 'fallback on classification error',
            provider,
            durationMs: 0,
        };
    }
};
const classifyWithJev = async (question, history) => {
    const client = JevService.requireClient();
    const recentHistory = history
        .slice(-4)
        .map((turn) => `${turn.role}: ${turn.content.slice(0, 200)}`)
        .join('\n');
    const t0 = Date.now();
    const response = await client.systemOne({
        model: JEV_ROUTER_MODEL,
        state: {
            question,
            recent_conversation: recentHistory || null,
            context_note: 'chatbot_ml already has 7-day athlete metrics including EWMA-named fields; agent is for charts, long history, exact tables.',
        },
        questions: {
            route: choice({
                question: 'Which system should answer this sports performance coach question given `question` and optional `recent_conversation`?',
                note: '`context_note` explains what each system already can do.',
            }, {
                chatbot_ml: 'Interpretation, coaching advice, or analysis of recent (≈7-day) athlete context already loaded — including EWMA metrics whose names mention 7/28 days.',
                agent: 'Needs full database access: charts/graphs, exact historical values, long date ranges (weeks/months/season), lists/tables/counts beyond the 7-day context.',
            }),
        },
    });
    const durationMs = Date.now() - t0;
    const answer = response.answers.route;
    const route = answer.choice === ROUTER_ROUTE.AGENT ? ROUTER_ROUTE.AGENT : ROUTER_ROUTE.CHATBOT_ML;
    logger.info({
        provider: ROUTER_PROVIDER.JEV,
        route,
        durationMs,
        confidence: answer.confidence,
        probabilities: answer.probabilities,
    }, 'question_router.decision');
    return {
        route,
        intent: route === ROUTER_ROUTE.AGENT ? 'direct_data_question' : 'global_analysis',
        reason: `jev route=${route} conf=${answer.confidence.toFixed(2)}`,
        provider: ROUTER_PROVIDER.JEV,
        durationMs,
        confidence: answer.confidence,
    };
};
const classifyWithHaiku = async (question, history) => {
    const [classifierPrompt, recentHistory] = await Promise.all([
        loadClassifierPrompt(),
        Promise.resolve(history
            .slice(-4)
            .map((turn) => `${turn.role}: ${turn.content.slice(0, 200)}`)
            .join('\n')),
    ]);
    const userMessage = recentHistory
        ? `Recent conversation:\n${recentHistory}\n\nNew question to classify: ${question}`
        : `Question to classify: ${question}`;
    const t0 = Date.now();
    const raw = await bedrockClient.send(new InvokeModelCommand({
        modelId: HAIKU_ROUTER_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 100,
            system: classifierPrompt,
            messages: [{ role: 'user', content: userMessage }],
        }),
    }));
    const durationMs = Date.now() - t0;
    const json = JSON.parse(Buffer.from(raw.body).toString('utf-8'));
    const rawText = json.content?.[0]?.text ?? '{}';
    const cleaned = rawText
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/```/g, '')
        .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match)
        throw new Error(`No JSON in classifier response. Raw text: ${rawText.slice(0, 300)}`);
    const parsed = JSON.parse(match[0]);
    const route = parsed.route === ROUTER_ROUTE.AGENT ? ROUTER_ROUTE.AGENT : ROUTER_ROUTE.CHATBOT_ML;
    logger.info({ provider: ROUTER_PROVIDER.HAIKU, route, durationMs }, 'question_router.decision');
    return {
        route,
        intent: String(parsed.intent ?? 'general'),
        reason: String(parsed.reason ?? ''),
        provider: ROUTER_PROVIDER.HAIKU,
        durationMs,
    };
};
//# sourceMappingURL=question_router.js.map