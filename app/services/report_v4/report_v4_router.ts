import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAIN_NOUL_THRESHOLD,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import {
  PREMIUM_DERIVE_MODE,
  PREMIUM_GRAIN,
  type PremiumGrain,
  type PremiumReportIntent,
  defaultPremiumIntent,
} from '#constants/premium_report_intent'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import {
  REPORT_DESIGN_PACK_IDS,
  type ReportDesignPackId,
} from '#services/report_v4/design/report_design_pack'
import { choice, noul } from '#services/jev_service'
import { ASK_FAITHFUL_NOTE } from '#services/report_v4/coach_policy_heuristic'
import { requireJevClient, throwJevUnavailable } from '#services/report_v4/jev_guard'
import { choiceValue, noulScore } from '#utils/jev_answers'

type ReportV4AnalysisDepth = 'standard' | 'deep'

export type ReportV4Route = {
  grain: PremiumGrain
  domains: PremiumDomain[]
  includePhotos: boolean
  includeVald: boolean
  includeMatch: boolean
  designPackId: ReportDesignPackId
  analysisDepth: ReportV4AnalysisDepth
  intent: PremiumReportIntent
  provider: 'jev' | 'skip'
}

export const skippedReportV4Route = (designPackId: ReportDesignPackId = 'mauna'): ReportV4Route => {
  const intent = defaultPremiumIntent()
  return {
    grain: PREMIUM_GRAIN.BOTH,
    domains: [],
    includePhotos: false,
    includeVald: false,
    includeMatch: false,
    designPackId,
    analysisDepth: 'standard',
    intent,
    provider: 'skip',
  }
}

const filterPopulated = (domains: PremiumDomain[], populated: PremiumDomain[]): PremiumDomain[] =>
  PREMIUM_DOMAINS.filter((domain) => domains.includes(domain) && populated.includes(domain))

const buildQuestions = (populated: PremiumDomain[], includeDomainQs: boolean) => {
  const domainQs = includeDomainQs
    ? Object.fromEntries(
        populated.map((domain) => [
          `dom_${domain}`,
          noul(
            `Should the staff report actively use the ${domain} domain for this coach request? Include only if the coach asked for ${domain} metrics (or a required join). ${ASK_FAITHFUL_NOTE}`,
            {
              true: `Include ${domain}`,
              false: `Skip ${domain} — not asked`,
            }
          ),
        ])
      )
    : {}

  return {
    grain: choice(
      {
        question: 'What presentation grain best answers this coach prompt?',
        note: 'Infer from the request. Individual score lines + team mean → both. Do not default to a canned monitoring template.',
      },
      {
        [PREMIUM_GRAIN.TEAM]: 'Squad / team aggregates first',
        [PREMIUM_GRAIN.INDIVIDUAL]:
          'Per-athlete fiches because the ask is about named or flagged players',
        [PREMIUM_GRAIN.BOTH]: 'Team context then the players the data actually flags',
      }
    ),
    analysis_depth: choice(
      {
        question: 'How deep should the scientific interpretation go?',
        note: 'Pick exactly one. Thin score-chart asks → standard unless coach asked for deep cross-domain science.',
      },
      {
        standard: 'Solid monitoring with clear flags',
        deep: 'Deep cross-domain analysis, correlations, converging signals',
      }
    ),
    design_pack: choice(
      {
        question: 'Which visual design pack fits the coach request?',
        note: 'Pick exactly one.',
      },
      {
        mauna: 'MAUNA dashboard blue',
        clinical: 'Clinical light',
        editorial: 'Editorial',
      }
    ),
    include_vald: noul('Should VALD / force-plate tests be pulled when data exists?', {
      true: 'Include VALD',
      false: 'Skip VALD unless coach asked',
    }),
    include_match: noul('Should match stats be pulled when data exists?', {
      true: 'Include match',
      false: 'Skip match unless coach asked',
    }),
    ...domainQs,
  }
}

const routeFromAnswers = (
  answers: Record<string, unknown>,
  populated: PremiumDomain[],
  designPackFallback: ReportDesignPackId | undefined,
  provider: ReportV4Route['provider'],
  askDomains: PremiumDomain[],
  preferredDomains: PremiumDomain[] | undefined,
  scoredDomains: boolean
): ReportV4Route => {
  const grainRaw = choiceValue(answers, 'grain')
  const grain =
    grainRaw === PREMIUM_GRAIN.TEAM ||
    grainRaw === PREMIUM_GRAIN.INDIVIDUAL ||
    grainRaw === PREMIUM_GRAIN.BOTH
      ? grainRaw
      : PREMIUM_GRAIN.BOTH

  const depthRaw = choiceValue(answers, 'analysis_depth')
  const analysisDepth: ReportV4AnalysisDepth = depthRaw === 'deep' ? 'deep' : 'standard'

  const packRaw = choiceValue(answers, 'design_pack')
  const designPackId = (
    REPORT_DESIGN_PACK_IDS.includes(packRaw as ReportDesignPackId)
      ? packRaw
      : (designPackFallback ?? 'mauna')
  ) as ReportDesignPackId

  const preferredPopulated = preferredDomains?.length
    ? filterPopulated(preferredDomains, populated)
    : []
  const askedPopulated = filterPopulated(askDomains, populated)
  let domains: PremiumDomain[]
  if (preferredPopulated.length > 0) {
    domains = preferredPopulated
  } else if (scoredDomains) {
    const scored = populated.filter(
      (domain) => noulScore(answers, `dom_${domain}`) >= PREMIUM_DOMAIN_NOUL_THRESHOLD
    )
    domains = scored.length > 0 ? scored : askedPopulated
  } else {
    domains = askedPopulated
  }
  const includeVald =
    populated.includes(PREMIUM_DOMAIN.VALD) &&
    noulScore(answers, 'include_vald') >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  const includeMatch =
    populated.includes(PREMIUM_DOMAIN.MATCH) &&
    noulScore(answers, 'include_match') >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  if (includeMatch && !domains.includes(PREMIUM_DOMAIN.MATCH)) {
    domains = [...domains, PREMIUM_DOMAIN.MATCH]
  }
  if (includeVald && !domains.includes(PREMIUM_DOMAIN.VALD)) {
    domains = [...domains, PREMIUM_DOMAIN.VALD]
  }

  const intent = defaultPremiumIntent()
  intent.grain = grain
  intent.deriveMode = PREMIUM_DERIVE_MODE.BOTH
  intent.analysisText = true
  intent.timeSeries = true
  intent.tableHeat = true

  return {
    grain,
    domains: PREMIUM_DOMAINS.filter((d) => domains.includes(d)),
    includePhotos: false,
    includeVald,
    includeMatch,
    designPackId,
    analysisDepth,
    intent,
    provider,
  }
}

export const routeReportV4 = async (args: {
  prompt: string
  populatedDomains: PremiumDomain[]
  designPackId?: ReportDesignPackId
  askDomains?: PremiumDomain[]
  preferredDomains?: PremiumDomain[]
}): Promise<ReportV4Route> => {
  const askDomains = args.askDomains ?? []
  const preferredDomains = args.preferredDomains ?? []
  const skipDomainJev = preferredDomains.length > 0
  const client = requireJevClient({ context: 'router' })

  try {
    const response = await client.systemOne({
      model: JEV_ROUTER_MODEL,
      state: {
        prompt: args.prompt.slice(0, 1200),
        populated: args.populatedDomains.join(','),
        note: ASK_FAITHFUL_NOTE,
        ...(skipDomainJev ? { preferredDomains: preferredDomains.join(',') } : {}),
      },
      questions: buildQuestions(args.populatedDomains, !skipDomainJev),
    })
    const route = routeFromAnswers(
      response.answers,
      args.populatedDomains,
      args.designPackId,
      'jev',
      askDomains,
      preferredDomains,
      !skipDomainJev
    )
    return route
  } catch (error) {
    return throwJevUnavailable({ cause: error, context: 'router' })
  }
}
