import db from '@adonisjs/lucid/services/db'
import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { loadClubSeasons, type ClubSeasonRef } from '#services/report_v4/club_seasons'
import { buildFetchRange, type IsoDateRange } from '#services/report_v4/lookback_range'
import {
  resolvePromptWindows,
  type PromptFetchSpec,
  type PromptWindows,
} from '#services/report_v4/prompt_scope'
import { buildDomainCoverageSql } from '#services/report_v4/domain_coverage_sql'

const COVERAGE_MIN_DAYS = 2
const COVERAGE_MIN_ATHLETES = 2

type DomainCoverageRow = {
  domain: PremiumDomain
  daysWithData: number
  athletesWithData: number
  populated: boolean
}

export type DomainCoverageReport = {
  dateRange: IsoDateRange
  domains: DomainCoverageRow[]
  populatedDomains: PremiumDomain[]
  emptyDomains: PremiumDomain[]
}

const emptyCoverageReport = (dateRange: IsoDateRange): DomainCoverageReport => ({
  dateRange,
  domains: PREMIUM_DOMAINS.map((domain) => ({
    domain,
    daysWithData: 0,
    athletesWithData: 0,
    populated: false,
  })),
  populatedDomains: [],
  emptyDomains: [...PREMIUM_DOMAINS],
})

const DOMAIN_COVERAGE_PAIRS: Array<[PremiumDomain, string, string]> = [
  [PREMIUM_DOMAIN.LOAD, 'load_days', 'load_athletes'],
  [PREMIUM_DOMAIN.GPS, 'gps_days', 'gps_athletes'],
  [PREMIUM_DOMAIN.MATCH, 'match_days', 'match_athletes'],
  [PREMIUM_DOMAIN.WELLNESS, 'wellness_days', 'wellness_athletes'],
  [PREMIUM_DOMAIN.SLEEP, 'sleep_days', 'sleep_athletes'],
  [PREMIUM_DOMAIN.VALD, 'vald_days', 'vald_athletes'],
  [PREMIUM_DOMAIN.BIOMARKERS, 'biomarkers_days', 'biomarkers_athletes'],
  [PREMIUM_DOMAIN.BODY, 'body_days', 'body_athletes'],
  [PREMIUM_DOMAIN.SCORES, 'scores_days', 'scores_athletes'],
  [PREMIUM_DOMAIN.INJURY, 'injury_days', 'injury_athletes'],
]

const rowsFromCoverageQuery = (row: Record<string, number | string | undefined>): DomainCoverageRow[] => {
  const read = (key: string): number => Number(row[key] ?? 0) || 0
  return DOMAIN_COVERAGE_PAIRS.map(([domain, daysKey, athletesKey]) => {
    const daysWithData = read(daysKey)
    const athletesWithData = read(athletesKey)
    return {
      domain,
      daysWithData,
      athletesWithData,
      populated:
        daysWithData >= COVERAGE_MIN_DAYS &&
        athletesWithData >= COVERAGE_MIN_ATHLETES,
    }
  })
}

const probeDomainCoverage = async (args: {
  clubId: string
  dateRange: IsoDateRange
  athleteIds: string[]
}): Promise<DomainCoverageReport> => {
  if (args.athleteIds.length === 0) {
    return emptyCoverageReport(args.dateRange)
  }

  const athletePlaceholders = args.athleteIds.map(() => '?').join(', ')
  const biomarkerBindings = [
    ...args.athleteIds,
    args.dateRange.from,
    args.dateRange.to,
    args.clubId,
  ]
  const injuryBindings = [
    args.clubId,
    ...args.athleteIds,
    args.dateRange.to,
    args.dateRange.from,
  ]
  const bindings: unknown[] = [
    args.clubId,
    args.dateRange.from,
    args.dateRange.to,
    ...args.athleteIds,
    ...injuryBindings,
    ...biomarkerBindings,
    ...biomarkerBindings,
  ]

  const result = await db.rawQuery(buildDomainCoverageSql(athletePlaceholders), bindings)
  const row = (result.rows?.[0] ?? result[0] ?? {}) as Record<string, number | string | undefined>
  const domains = rowsFromCoverageQuery(row)
  const populatedDomains = domains.filter((d) => d.populated).map((d) => d.domain)
  const emptyDomains = domains.filter((d) => !d.populated).map((d) => d.domain)

  return {
    dateRange: args.dateRange,
    domains,
    populatedDomains,
    emptyDomains,
  }
}

const overlayScopedDomainWindows = async (args: {
  clubId: string
  athleteIds: string[]
  displayRange: IsoDateRange
  domainRanges: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
  coverage: DomainCoverageReport
}): Promise<DomainCoverageReport> => {
  let coverage = args.coverage
  const scopedJobs: Array<{ domain: string; range: IsoDateRange }> = []
  if (args.fetches?.length) {
    for (const fetch of args.fetches) {
      if (fetch.from === args.displayRange.from && fetch.to === args.displayRange.to) continue
      const dup = scopedJobs.some(
        (job) =>
          job.domain === fetch.domain && job.range.from === fetch.from && job.range.to === fetch.to
      )
      if (!dup) scopedJobs.push({ domain: fetch.domain, range: { from: fetch.from, to: fetch.to } })
    }
  } else {
    for (const [domain, range] of Object.entries(args.domainRanges)) {
      if (!range || (range.from === args.displayRange.from && range.to === args.displayRange.to)) {
        continue
      }
      scopedJobs.push({ domain, range })
    }
  }

  for (const job of scopedJobs) {
    const scoped = await probeDomainCoverage({
      clubId: args.clubId,
      dateRange: job.range,
      athleteIds: args.athleteIds,
    })
    const scopedRow = scoped.domains.find((row) => row.domain === job.domain)
    if (!scopedRow) continue
    const domains = coverage.domains.map((row) => {
      if (row.domain !== job.domain) return row
      if (!row.populated && scopedRow.populated) return scopedRow
      if (row.populated && scopedRow.populated) {
        return {
          ...row,
          daysWithData: Math.max(row.daysWithData, scopedRow.daysWithData),
          athletesWithData: Math.max(row.athletesWithData, scopedRow.athletesWithData),
          populated: true,
        }
      }
      return row
    })
    coverage = {
      ...coverage,
      domains,
      populatedDomains: domains.filter((row) => row.populated).map((row) => row.domain),
      emptyDomains: domains.filter((row) => !row.populated).map((row) => row.domain),
    }
  }
  return coverage
}

export type ReportV4CoverageView = {
  displayRange: IsoDateRange
  fetchRange: IsoDateRange
  domainRanges: PromptWindows['byDomain']
  fetches?: PromptFetchSpec[]
  domains: DomainCoverageRow[]
  populatedDomains: PremiumDomain[]
  emptyDomains: PremiumDomain[]
}

const probeCoverageForWindows = async (args: {
  clubId: string
  athleteIds: string[]
  displayRange: IsoDateRange
  domainRanges: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
}): Promise<DomainCoverageReport> =>
  overlayScopedDomainWindows({
    clubId: args.clubId,
    athleteIds: args.athleteIds,
    displayRange: args.displayRange,
    domainRanges: args.domainRanges,
    fetches: args.fetches,
    coverage: await probeDomainCoverage({
      clubId: args.clubId,
      dateRange: args.displayRange,
      athleteIds: args.athleteIds,
    }),
  })

export const resolveFullCoverage = async (args: {
  clubId: string
  prompt: string
  athleteIds: string[]
  displayRange?: IsoDateRange
  domainRanges?: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
  seasons?: ClubSeasonRef[]
}): Promise<ReportV4CoverageView> => {
  const needSyncWindows = !(args.displayRange && args.domainRanges != null)
  const seasons = needSyncWindows ? (args.seasons ?? (await loadClubSeasons(args.clubId))) : []
  const windows = needSyncWindows ? resolvePromptWindows(args.prompt, undefined, seasons) : null
  const displayRange = args.displayRange ?? windows?.display
  if (!displayRange) throw new Error('resolveFullCoverage: missing displayRange')
  const domainRanges = args.domainRanges ?? windows?.byDomain ?? {}
  const fetches = args.fetches ?? windows?.fetches
  const fetchRange = buildFetchRange(domainRanges.load ?? displayRange)
  const coverage = await probeCoverageForWindows({
    clubId: args.clubId,
    athleteIds: args.athleteIds,
    displayRange,
    domainRanges,
    fetches,
  })
  return {
    displayRange,
    fetchRange,
    domainRanges,
    fetches,
    domains: coverage.domains,
    populatedDomains: coverage.populatedDomains,
    emptyDomains: coverage.emptyDomains,
  }
}
