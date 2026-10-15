import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
type FetchDomainSpec = {
  domain: PremiumDomain
  from?: string
  to?: string
}

type ResolveReportDomainsArgs = {
  prompt: string
  preferred: PremiumDomain[]
  routed: PremiumDomain[]
  populated: PremiumDomain[]
  excluded: PremiumDomain[]
  fetches: FetchDomainSpec[]
  monitoringPlaybook: boolean
  askDomains?: PremiumDomain[]
}

type ResolveReportDomainsResult = {
  domains: PremiumDomain[]
  fromAsk: PremiumDomain[]
  fromWindows: PremiumDomain[]
  fromPreferred: PremiumDomain[]
  forcedArchive: PremiumDomain[]
  dropped: Array<{ domain: PremiumDomain; reason: string }>
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
    if (fromPreferred.includes(domain) && domain === PREMIUM_DOMAIN.BIOMARKERS) {
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

export const askCoverageContinue = (args: {
  domains: PremiumDomain[]
  chartCount: number
  tableCount: number
  hasBrief: boolean
  floors: { minCharts: number; minTables: number; minCombined: number }
}): string | null => {
  if (args.domains.length === 0) return null
  if (!args.hasBrief) {
    return `Ask coverage incomplete: commit_report_brief required (domains=${args.domains.join(',')}).`
  }
  const { minCharts, minTables, minCombined } = args.floors
  if (minCharts === 0 && minTables === 0 && minCombined === 0) return null
  const combined = args.chartCount + args.tableCount
  const thin = args.chartCount < minCharts || args.tableCount < minTables || combined < minCombined
  if (!thin) return null
  return `Ask coverage incomplete: need viz/tables for domains with data [${args.domains.join(', ')}] (charts=${args.chartCount}/${minCharts} tables=${args.tableCount}/${minTables} combined=${combined}/${minCombined}). Empty domains → unavailability line, not more charts. Use Linker datasetIds only; Plan B once on join/filter errors.`
}
