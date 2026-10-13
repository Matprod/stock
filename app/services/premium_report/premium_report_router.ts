import logger from '@adonisjs/core/services/logger'
import {
  PREMIUM_CANVAS_ASK,
  PREMIUM_VALD_TEST_TYPES,
  type PremiumCanvasAsk,
  type PremiumJevProvider,
} from '#constants/premium_report.constants'
import {
  correlationDomains,
  PREMIUM_CORRELATION_JEV,
  PREMIUM_DOMAIN_CATALOG,
  PREMIUM_DOMAIN_NOUL_THRESHOLD,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import {
  defaultPremiumIntent,
  isPremiumChartHint,
  isPremiumDeriveMode,
  isPremiumGrain,
  isPremiumVizLayout,
  PREMIUM_INTENT_CHOICE_CATALOG,
  PREMIUM_INTENT_FLAG_CATALOG,
  type PremiumReportIntent,
} from '#constants/premium_report_intent'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import {
  buildCanvasAskChoice,
  heuristicCanvasAsk,
  mustUseToolsForCanvasAsk,
  isCanvasExplain,
  resolveCanvasAsk,
} from '#services/premium_report/jev_canvas_ask'
import { elapsedSec, logPremiumJev } from '#services/premium_report/premium_report_log'
import JevService, { choice, noul, type TypeSafeClient } from '#services/jev_service'
import { choiceValue, noulScore } from '#utils/jev_answers'

const CORRELATION_KEY = 'correlation'
const CANVAS_ASK_KEY = 'canvasAsk'

const valdIncludeKey = (id: string) => `vald_include_${id}`
const valdExcludeKey = (id: string) => `vald_exclude_${id}`

const FALLBACK_TOP_DOMAIN_COUNT = 2
const FALLBACK_MIN_SCORE = 0.1

export type PremiumReportRoute = {
  domains: PremiumDomain[]
  correlation: boolean
  canvasAsk: PremiumCanvasAsk
  intent: PremiumReportIntent
  valdTestTypes?: string[]
  mustUseTools: boolean
  explanationAsk: boolean
  provider: PremiumJevProvider
  domainScores?: Partial<Record<PremiumDomain, number>>
}

const flagTrue = (answers: Record<string, unknown>, key: string): boolean =>
  noulScore(answers, key) >= PREMIUM_DOMAIN_NOUL_THRESHOLD

const flagOrDefault = (
  answers: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean => {
  if (!(key in answers)) return fallback
  const score = noulScore(answers, key)
  if (score >= 0.55) return true
  if (score <= 0.45) return false
  return fallback
}

const resolveDomains = (
  selected: Set<PremiumDomain>,
  scores?: Partial<Record<PremiumDomain, number>>
): PremiumDomain[] => {
  if (selected.size > 0) return [...selected]
  if (!scores) return []
  return PREMIUM_DOMAINS.map((domain) => ({ domain, score: scores[domain] ?? 0 }))
    .sort((left, right) => right.score - left.score)
    .filter((entry) => entry.score >= FALLBACK_MIN_SCORE)
    .slice(0, FALLBACK_TOP_DOMAIN_COUNT)
    .map((entry) => entry.domain)
}

const withCorrelation = (selected: Set<PremiumDomain>, correlation: boolean): void => {
  if (!correlation) return
  for (const domain of correlationDomains()) selected.add(domain)
}

const defaultRoute = (hasExistingCanvas: boolean): PremiumReportRoute => {
  const intent = defaultPremiumIntent()
  const canvasAsk = heuristicCanvasAsk(hasExistingCanvas)
  return {
    domains: [],
    correlation: false,
    canvasAsk,
    intent,
    mustUseTools: mustUseToolsForCanvasAsk(canvasAsk) || !hasExistingCanvas,
    explanationAsk: isCanvasExplain(canvasAsk),
    provider: 'heuristic',
  }
}

const buildQuestions = (hasExistingCanvas: boolean) => {
  const questions: Record<string, ReturnType<typeof noul> | ReturnType<typeof choice>> = {
    ...Object.fromEntries(
      PREMIUM_DOMAINS.map((domain) => {
        const { question, trueLabel, falseLabel } = PREMIUM_DOMAIN_CATALOG[domain].jev
        return [domain, noul(question, { true: trueLabel, false: falseLabel })]
      })
    ),
    [CORRELATION_KEY]: noul(PREMIUM_CORRELATION_JEV.question, {
      true: PREMIUM_CORRELATION_JEV.trueLabel,
      false: PREMIUM_CORRELATION_JEV.falseLabel,
    }),
    ...Object.fromEntries(
      Object.entries(PREMIUM_INTENT_CHOICE_CATALOG).map(([key, entry]) => [
        key,
        choice(
          { question: entry.question, note: 'Pick exactly one option.' },
          entry.criteria as Record<string, string>
        ),
      ])
    ),
    ...Object.fromEntries(
      Object.entries(PREMIUM_INTENT_FLAG_CATALOG).map(([key, entry]) => [
        key,
        noul(entry.question, { true: entry.trueLabel, false: entry.falseLabel }),
      ])
    ),
  }

  for (const entry of PREMIUM_VALD_TEST_TYPES) {
    questions[valdIncludeKey(entry.id)] = noul(
      `Does \`prompt\` specifically request ${entry.id} force-plate / jump tests (aliases: ${entry.aliases.join(', ')})?`,
      { true: `Include ${entry.id}`, false: `Not asking for ${entry.id}` }
    )
    questions[valdExcludeKey(entry.id)] = noul(
      `Does \`prompt\` explicitly exclude or reject ${entry.id} tests (e.g. without / not / no ${entry.id})?`,
      { true: `Exclude ${entry.id}`, false: `Not excluding ${entry.id}` }
    )
  }

  if (hasExistingCanvas) {
    questions[CANVAS_ASK_KEY] = buildCanvasAskChoice(
      'Given `prompt` and that a report canvas already exists (`hasExistingCanvas`), which single action best matches the coach request? Prefer SPLIT when dividing one table by columns. Prefer DUPLICATE to copy a block. Prefer REMOVE to delete blocks. Prefer MICRO_EDIT for unit/label/style. Prefer EXPLAIN for why/how. Prefer NEW_VIZ for new metrics or charts.'
    )
  }

  return questions
}

const parseValdTypes = (answers: Record<string, unknown>): string[] | undefined => {
  const included: string[] = []
  const excluded = new Set<string>()
  for (const entry of PREMIUM_VALD_TEST_TYPES) {
    if (flagTrue(answers, valdExcludeKey(entry.id))) excluded.add(entry.id)
    else if (flagTrue(answers, valdIncludeKey(entry.id))) included.push(entry.id)
  }
  if (included.length === 0 && excluded.size === 0) return undefined
  if (included.length > 0) return included.filter((id) => !excluded.has(id))
  const remaining = PREMIUM_VALD_TEST_TYPES.map((e) => e.id).filter((id) => !excluded.has(id))
  return remaining.length > 0 && remaining.length < PREMIUM_VALD_TEST_TYPES.length
    ? remaining
    : undefined
}

const parseIntent = (answers: Record<string, unknown>): PremiumReportIntent => {
  const fallback = defaultPremiumIntent()
  const grainRaw = choiceValue(answers, 'grain')
  const layoutRaw = choiceValue(answers, 'vizLayout')
  const chartRaw = choiceValue(answers, 'chartHint')
  const deriveRaw = choiceValue(answers, 'deriveMode')
  return {
    grain: grainRaw && isPremiumGrain(grainRaw) ? grainRaw : fallback.grain,
    vizLayout: layoutRaw && isPremiumVizLayout(layoutRaw) ? layoutRaw : fallback.vizLayout,
    chartHint: chartRaw && isPremiumChartHint(chartRaw) ? chartRaw : fallback.chartHint,
    deriveMode: deriveRaw && isPremiumDeriveMode(deriveRaw) ? deriveRaw : fallback.deriveMode,
    tableHeat: flagOrDefault(answers, 'tableHeat', fallback.tableHeat),
    analysisText: flagOrDefault(answers, 'analysisText', fallback.analysisText),
    timeSeries: flagTrue(answers, 'timeSeries'),
    distanceKm: flagTrue(answers, 'distanceKm'),
    insertAtTop: flagTrue(answers, 'insertAtTop'),
  }
}

const parseCanvasAsk = (
  answers: Record<string, unknown>,
  hasExistingCanvas: boolean
): PremiumCanvasAsk => {
  if (!hasExistingCanvas) {
    return { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'jev' }
  }
  return resolveCanvasAsk(answers, CANVAS_ASK_KEY, PREMIUM_CANVAS_ASK.NEW_VIZ)
}

const routeFromAnswers = (
  answers: Record<string, unknown>,
  hasExistingCanvas: boolean,
  provider: PremiumReportRoute['provider']
): PremiumReportRoute => {
  const domainScores: Partial<Record<PremiumDomain, number>> = {}
  for (const domain of PREMIUM_DOMAINS) {
    domainScores[domain] = noulScore(answers, domain)
  }
  const correlation = flagTrue(answers, CORRELATION_KEY)
  const selected = new Set(
    PREMIUM_DOMAINS.filter((domain) => (domainScores[domain] ?? 0) >= PREMIUM_DOMAIN_NOUL_THRESHOLD)
  )
  withCorrelation(selected, correlation)
  const domains = resolveDomains(selected, domainScores)
  const intent = parseIntent(answers)
  const canvasAsk = parseCanvasAsk(answers, hasExistingCanvas)
  const valdTestTypes = parseValdTypes(answers)

  return {
    domains,
    correlation,
    canvasAsk,
    intent,
    ...(valdTestTypes?.length ? { valdTestTypes } : {}),
    mustUseTools: mustUseToolsForCanvasAsk(canvasAsk) || !hasExistingCanvas,
    explanationAsk: isCanvasExplain(canvasAsk),
    provider,
    domainScores,
  }
}

const detectWithJev = async (
  prompt: string,
  hasExistingCanvas: boolean,
  client: TypeSafeClient
): Promise<PremiumReportRoute> => {
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      prompt: prompt.slice(0, 1200),
      hasExistingCanvas: String(hasExistingCanvas),
    },
    questions: buildQuestions(hasExistingCanvas),
  })
  return routeFromAnswers(response.answers, hasExistingCanvas, 'jev')
}

export const routePremiumReport = async (args: {
  prompt: string
  hasExistingCanvas: boolean
}): Promise<PremiumReportRoute> => {
  const started = Date.now()
  const client = JevService.getClient()
  if (!client) {
    const route = { ...defaultRoute(args.hasExistingCanvas), provider: 'skip' as const }
    logPremiumJev({
      kind: 'route',
      durationSec: elapsedSec(started),
      ok: true,
      decision: route.domains.join(','),
      provider: 'skip',
      detail: `canvas=${route.canvasAsk.kind} no-client`,
    })
    return route
  }

  try {
    const route = await detectWithJev(args.prompt, args.hasExistingCanvas, client)
    const scoreDetail = PREMIUM_DOMAINS.map(
      (domain) => `${domain}=${(route.domainScores?.[domain] ?? 0).toFixed(2)}`
    ).join(' ')
    const { intent } = route
    logPremiumJev({
      kind: 'route',
      durationSec: elapsedSec(started),
      ok: true,
      decision: `${route.domains.join(',')}|${route.canvasAsk.kind}`,
      provider: 'jev',
      detail: [
        `corr=${route.correlation}`,
        `grain=${intent.grain}`,
        `layout=${intent.vizLayout}`,
        `chart=${intent.chartHint}`,
        `derive=${intent.deriveMode}`,
        `heat=${intent.tableHeat}`,
        `text=${intent.analysisText}`,
        `ts=${intent.timeSeries}`,
        `km=${intent.distanceKm}`,
        route.valdTestTypes?.length ? `vald=${route.valdTestTypes.join(',')}` : undefined,
        scoreDetail,
      ]
        .filter(Boolean)
        .join(' '),
    })
    return route
  } catch (error) {
    logger.warn({ err: error }, 'premium_report.route_jev_failed')
    const route = { ...defaultRoute(args.hasExistingCanvas), provider: 'fallback' as const }
    logPremiumJev({
      kind: 'route',
      durationSec: elapsedSec(started),
      ok: false,
      decision: route.domains.join(','),
      provider: 'fallback',
      detail: error instanceof Error ? error.message.slice(0, 120) : 'error',
    })
    return route
  }
}
