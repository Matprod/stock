import logger from '@adonisjs/core/services/logger'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { PREMIUM_DOMAINS, type PremiumDomain } from '#constants/premium_report_domains'
import {
  COACH_REPORT_SHAPE,
  type CoachReportShape,
} from '#services/report_v4/coach_policy_heuristic'
import { noul } from '#services/jev_service'
import { elapsedSec } from '#services/premium_report/premium_report_log'
import { requireJevClient, throwJevUnavailable } from '#services/report_v4/jev_guard'
import { noulScore } from '#utils/jev_answers'

export type FetchDomainSpec = {
  domain: PremiumDomain
  from?: string
  to?: string
}

export type ResolveReportDomainsArgs = {
  prompt: string
  preferred: PremiumDomain[]
  routed: PremiumDomain[]
  populated: PremiumDomain[]
  excluded: PremiumDomain[]
  fetches: FetchDomainSpec[]
  monitoringPlaybook: boolean
  askDomains?: PremiumDomain[]
}

export type ResolveReportDomainsResult = {
  domains: PremiumDomain[]
  fromAsk: PremiumDomain[]
  fromWindows: PremiumDomain[]
  fromPreferred: PremiumDomain[]
  forcedArchive: PremiumDomain[]
  dropped: Array<{ domain: PremiumDomain; reason: string }>
}

export type MultiSectionAskResult = {
  multiSection: boolean
  provider: 'jev' | 'structural'
  score?: number
}

const uniqueDomains = (domains: PremiumDomain[]): PremiumDomain[] =>
  PREMIUM_DOMAINS.filter((domain) => domains.includes(domain))

const domainsFromFetches = (fetches: FetchDomainSpec[]): PremiumDomain[] =>
  uniqueDomains(fetches.map((row) => row.domain))

export const resolveReportDomains = (
  args: ResolveReportDomainsArgs
): ResolveReportDomainsResult => {
  const excluded = new Set(args.excluded)
  const populated = new Set(args.populated)
  const fromAsk = (args.askDomains ?? []).filter((d) => !excluded.has(d))
  const fromPreferred = args.preferred.filter((d) => !excluded.has(d))
  const fromWindows = domainsFromFetches(args.fetches).filter((d) => !excluded.has(d))
  const fromRouted = args.routed.filter((d) => !excluded.has(d))

  const askUnion = uniqueDomains([...fromAsk, ...fromPreferred, ...fromWindows])
  const forcedArchive = fromWindows.filter((domain) => !populated.has(domain))
  const dropped: Array<{ domain: PremiumDomain; reason: string }> = []
  const included: PremiumDomain[] = []

  for (const domain of askUnion) {
    if (populated.has(domain) || fromWindows.includes(domain)) {
      included.push(domain)
      continue
    }
    dropped.push({ domain, reason: 'not_populated_and_no_fetch_window' })
  }

  if (args.monitoringPlaybook) {
    for (const domain of fromRouted) {
      if (excluded.has(domain) || included.includes(domain) || askUnion.includes(domain)) continue
      dropped.push({ domain, reason: 'playbook_structure_only_not_fetched' })
    }
  }

  let domains = uniqueDomains(included)
  if (domains.length === 0) {
    domains = uniqueDomains(
      fromRouted.filter((domain) => populated.has(domain) || fromWindows.includes(domain))
    )
  }
  if (domains.length === 0 && fromAsk.length > 0) {
    domains = uniqueDomains(fromAsk.filter((domain) => fromWindows.includes(domain)))
  }

  return {
    domains,
    fromAsk,
    fromWindows,
    fromPreferred,
    forcedArchive,
    dropped,
  }
}

const structuralMultiSection = (args: {
  askDomainCount: number
  fetchDomainCount: number
  fetchWindowCount: number
}): boolean =>
  args.askDomainCount >= 4 ||
  (args.fetchDomainCount >= 4 && args.fetchWindowCount >= 5) ||
  args.fetchWindowCount >= 6

export const resolveMultiSectionAsk = async (args: {
  prompt: string
  askDomainCount: number
  fetchDomainCount: number
  fetchWindowCount: number
}): Promise<MultiSectionAskResult> => {
  const started = Date.now()
  const structural = structuralMultiSection(args)
  const client = requireJevClient({ context: 'multi_section_ask' })

  try {
    const response = await client.systemOne({
      model: JEV_ROUTER_MODEL,
      state: {
        prompt: args.prompt.slice(0, 3500),
        askDomainCount: String(args.askDomainCount),
        fetchDomainCount: String(args.fetchDomainCount),
        fetchWindowCount: String(args.fetchWindowCount),
        note: [
          'Staff report coach ask classification.',
          'multi_section=true when the coach wants several distinct report beats in one go',
          '(multiple domains, multiple chart types, archive window plus display, athlete cards plus squad viz, etc.).',
          'multi_section=false for a thin single-purpose ask (one metric family / one viz / micro follow-up).',
          'Language-agnostic: judge intent, not wording.',
        ].join(' '),
      },
      questions: {
        multi_section: noul(
          'Does this coach ask require a multi-section staff report (several distinct analysis beats) rather than a single thin viz?',
          {
            true: 'Multiple beats / domains / viz types in one report',
            false: 'Single thin ask or micro follow-up',
          }
        ),
      },
    })
    const score = noulScore(response.answers as Record<string, unknown>, 'multi_section')
    const multiSection = score >= 0.55 || structural
    logger.info(
      {
        multiSection,
        provider: 'jev',
        score,
        structural,
        askDomainCount: args.askDomainCount,
        fetchDomainCount: args.fetchDomainCount,
        fetchWindowCount: args.fetchWindowCount,
        durationSec: elapsedSec(started),
      },
      'report_v4.multi_section_ask'
    )
    return { multiSection, provider: 'jev', score }
  } catch (error) {
    return throwJevUnavailable({ cause: error, context: 'multi_section_ask' })
  }
}

export const askCoverageContinue = (args: {
  domains: PremiumDomain[]
  chartCount: number
  tableCount: number
  hasBrief: boolean
  reportShape?: CoachReportShape
  multiSection?: boolean
  monitoringPlaybook?: boolean
}): string | null => {
  if (args.domains.length === 0) return null
  if (!args.hasBrief) {
    return `Ask coverage incomplete: commit_report_brief required (domains=${args.domains.join(',')}).`
  }
  const deepFloor =
    Boolean(args.monitoringPlaybook) || Boolean(args.multiSection) || args.domains.length >= 3
  const thinFree =
    !deepFloor &&
    (args.reportShape ?? COACH_REPORT_SHAPE.FREE) === COACH_REPORT_SHAPE.FREE &&
    args.domains.length <= 2
  if (thinFree) return null
  const minCharts = Math.min(8, Math.max(2, args.domains.length))
  if (args.chartCount + args.tableCount < minCharts) {
    return `Ask coverage incomplete: need viz/tables for allowed domains [${args.domains.join(', ')}] (charts=${args.chartCount} tables=${args.tableCount} minCombined=${minCharts}). Use Linker datasetIds only; Plan B once on join/filter errors.`
  }
  return null
}
