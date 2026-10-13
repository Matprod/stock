import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import logger from '@adonisjs/core/services/logger'
import {
  HAIKU_ROUTER_MODEL_ID,
  JEV_ROUTER_MODEL,
  ROUTER_PROVIDER,
  ROUTER_ROUTE,
  type RouterProvider,
  type RouterRoute,
} from '#constants/question_router.constants'
import JevService, { choice } from '#services/jev_service'
import env from '#start/env'

export type RouterDecision = {
  route: RouterRoute
  intent: string
  reason: string
  provider: RouterProvider
  durationMs: number
  confidence?: number
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a question classifier for a sports performance chatbot assistant used by coaches.

The chatbot has two systems:
1. **chatbot_ml** — Has a pre-built 7-day athlete context (scores, metrics, EWMA values, recent injuries, nutrition). Best for interpretation, coaching advice, and analysis of data already present in this context.
2. **agent** — Can query the full database with SQL. Best for data that is NOT available in the 7-day context: historical trends, specific date ranges, exact values over long periods, charts/visualizations.

KEY DISTINCTION:
- chatbot_ml already contains pre-calculated metrics like EWMA values (even if their name includes "28 days" or "7 days" — these are metric names, not query windows).
- agent is needed when the user wants to retrieve or compute data across a time range that exceeds what the 7-day context provides.

ROUTING RULES:
1. → agent if the user asks for a chart, graph, visualization, curve, or trend plot.
2. → agent if the user asks for exact values, raw data, tables, lists, counts, or exports.
3. → agent if answering the question requires historical data beyond what the 7-day context contains (e.g. "past month", "last 3 months", "this season", "since January", injury history, performance evolution over weeks/months).
4. → chatbot_ml if the user asks for interpretation, explanation, insights, coaching advice, or deep analysis of a metric that is already available in the 7-day context (including EWMA metrics whose names contain time windows like "28 days").
5. → chatbot_ml for general questions, greetings, or anything not requiring extended historical data.

Respond ONLY with valid JSON, no explanation outside it:
{"route": "chatbot_ml", "intent": "global_analysis", "reason": "holistic analysis of current scores"}`

const bedrockClient = new BedrockRuntimeClient({
  region: env.get('AWS_REGION'),
  credentials: {
    accessKeyId: env.get('AWS_ACCESS_KEY'),
    secretAccessKey: env.get('AWS_SECRET_KEY'),
  },
})

const resolveProvider = (): RouterProvider => {
  const configured = env.get('QUESTION_ROUTER_PROVIDER')
  if (configured === ROUTER_PROVIDER.JEV) return ROUTER_PROVIDER.JEV
  return ROUTER_PROVIDER.HAIKU
}

/**
 * Classifies a question and returns the routing decision.
 * Always resolves — never throws. Falls back to chatbot_ml on error.
 */
export const classifyQuestion = async (
  question: string,
  history: Array<{ role: string; content: string }> = []
): Promise<RouterDecision> => {
  const provider = resolveProvider()
  const compare = env.get('QUESTION_ROUTER_COMPARE') === true

  if (compare) {
    const [primary, other] = await Promise.all([
      provider === ROUTER_PROVIDER.JEV
        ? classifyWithJev(question, history)
        : classifyWithHaiku(question, history),
      provider === ROUTER_PROVIDER.JEV
        ? classifyWithHaiku(question, history)
        : classifyWithJev(question, history),
    ])
    logger.info(
      {
        provider,
        primary: {
          route: primary.route,
          durationMs: primary.durationMs,
          confidence: primary.confidence,
        },
        other: { route: other.route, durationMs: other.durationMs, confidence: other.confidence },
        agree: primary.route === other.route,
      },
      'question_router.compare'
    )
    return primary
  }

  try {
    if (provider === ROUTER_PROVIDER.JEV) {
      return await classifyWithJev(question, history)
    }
    return await classifyWithHaiku(question, history)
  } catch (error) {
    logger.warn({ err: error, provider }, 'question_router.failed — falling back to chatbot_ml')
    if (provider === ROUTER_PROVIDER.JEV) {
      try {
        return await classifyWithHaiku(question, history)
      } catch (haikuError) {
        logger.warn({ err: haikuError }, 'question_router.haiku_fallback_failed')
      }
    }
    return {
      route: ROUTER_ROUTE.CHATBOT_ML,
      intent: 'general',
      reason: 'fallback on classification error',
      provider,
      durationMs: 0,
    }
  }
}

const classifyWithJev = async (
  question: string,
  history: Array<{ role: string; content: string }>
): Promise<RouterDecision> => {
  const client = JevService.requireClient()
  const recentHistory = history
    .slice(-4)
    .map((turn) => `${turn.role}: ${turn.content.slice(0, 200)}`)
    .join('\n')

  const t0 = Date.now()
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      question,
      recent_conversation: recentHistory || null,
      context_note:
        'chatbot_ml already has 7-day athlete metrics including EWMA-named fields; agent is for charts, long history, exact tables.',
    },
    questions: {
      route: choice(
        {
          question:
            'Which system should answer this sports performance coach question given `question` and optional `recent_conversation`?',
          note: '`context_note` explains what each system already can do.',
        },
        {
          chatbot_ml:
            'Interpretation, coaching advice, or analysis of recent (≈7-day) athlete context already loaded — including EWMA metrics whose names mention 7/28 days.',
          agent:
            'Needs full database access: charts/graphs, exact historical values, long date ranges (weeks/months/season), lists/tables/counts beyond the 7-day context.',
        }
      ),
    },
  })
  const durationMs = Date.now() - t0
  const answer = response.answers.route
  const route: RouterRoute =
    answer.choice === ROUTER_ROUTE.AGENT ? ROUTER_ROUTE.AGENT : ROUTER_ROUTE.CHATBOT_ML

  logger.info(
    {
      provider: ROUTER_PROVIDER.JEV,
      route,
      durationMs,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    },
    'question_router.decision'
  )

  return {
    route,
    intent: route === ROUTER_ROUTE.AGENT ? 'direct_data_question' : 'global_analysis',
    reason: `jev route=${route} conf=${answer.confidence.toFixed(2)}`,
    provider: ROUTER_PROVIDER.JEV,
    durationMs,
    confidence: answer.confidence,
  }
}

const classifyWithHaiku = async (
  question: string,
  history: Array<{ role: string; content: string }>
): Promise<RouterDecision> => {
  const recentHistory = history
    .slice(-4)
    .map((turn) => `${turn.role}: ${turn.content.slice(0, 200)}`)
    .join('\n')

  const userMessage = recentHistory
    ? `Recent conversation:\n${recentHistory}\n\nNew question to classify: ${question}`
    : `Question to classify: ${question}`

  const t0 = Date.now()
  const raw = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: HAIKU_ROUTER_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 100,
        system: CLASSIFIER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
  )
  const durationMs = Date.now() - t0
  const json = JSON.parse(Buffer.from(raw.body).toString('utf-8'))
  const rawText: string = json.content?.[0]?.text ?? '{}'
  const cleaned = rawText
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in classifier response. Raw text: ${rawText.slice(0, 300)}`)

  const parsed = JSON.parse(match[0]) as { route?: string; intent?: string; reason?: string }
  const route: RouterRoute =
    parsed.route === ROUTER_ROUTE.AGENT ? ROUTER_ROUTE.AGENT : ROUTER_ROUTE.CHATBOT_ML

  logger.info({ provider: ROUTER_PROVIDER.HAIKU, route, durationMs }, 'question_router.decision')

  return {
    route,
    intent: String(parsed.intent ?? 'general'),
    reason: String(parsed.reason ?? ''),
    provider: ROUTER_PROVIDER.HAIKU,
    durationMs,
  }
}
