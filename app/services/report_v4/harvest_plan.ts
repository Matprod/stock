import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumDataset } from '#contracts/premium_report'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'

type HarvestWindow = { from: string; to: string }

type HarvestPlanEntry = {
  domain: PremiumDomain
  macros: string[]
  window?: HarvestWindow
}

type HarvestFetchSpec = {
  domain: PremiumDomain
  from: string
  to: string
}

type HarvestPlanOptions = {
  fetches?: HarvestFetchSpec[]
  loadLookback?: HarvestWindow
}

type HarvestDomainStatus = 'rows' | 'empty_after_try' | 'pending'

type HarvestDomainVerdict = {
  domain: PremiumDomain
  window?: HarvestWindow
  status: HarvestDomainStatus
  macros: string[]
}

type HarvestVerification = {
  pending: string[]
  verdicts: HarvestDomainVerdict[]
  hasAnyData: boolean
  allVerified: boolean
}

const DOMAIN_MACROS: Record<PremiumDomain, string[]> = {
  [PREMIUM_DOMAIN.LOAD]: ['build_load_summary', 'fetch_srpe_daily'],
  [PREMIUM_DOMAIN.GPS]: ['fetch_gps_intensity_daily', 'fetch_gps_intensity', 'fetch_gps_distance'],
  [PREMIUM_DOMAIN.MATCH]: ['fetch_match_stats_daily', 'fetch_match_stats'],
  [PREMIUM_DOMAIN.WELLNESS]: ['fetch_wellness_daily'],
  [PREMIUM_DOMAIN.SLEEP]: ['fetch_sleep_daily'],
  [PREMIUM_DOMAIN.VALD]: ['fetch_vald_tests'],
  [PREMIUM_DOMAIN.BIOMARKERS]: ['fetch_biomarkers_daily', 'fetch_biomarkers'],
  [PREMIUM_DOMAIN.BODY]: ['fetch_body_metrics'],
  [PREMIUM_DOMAIN.SCORES]: ['fetch_daily_scores'],
  [PREMIUM_DOMAIN.INJURY]: ['fetch_injuries'],
}

const windowKey = (window: HarvestWindow): string => `${window.from}|${window.to}`

const uniqueWindows = (windows: HarvestWindow[]): HarvestWindow[] => {
  const seen = new Set<string>()
  const out: HarvestWindow[] = []
  for (const window of windows) {
    const key = windowKey(window)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(window)
  }
  return out
}

export const buildHarvestPlan = (
  domains: PremiumDomain[],
  opts?: HarvestPlanOptions
): HarvestPlanEntry[] => {
  const fetches = opts?.fetches ?? []
  const plan: HarvestPlanEntry[] = []
  for (const domain of domains) {
    const macros = DOMAIN_MACROS[domain] ?? []
    if (macros.length === 0) continue
    if (domain === PREMIUM_DOMAIN.LOAD && opts?.loadLookback) {
      plan.push({ domain, macros, window: opts.loadLookback })
      continue
    }
    const domainWindows = uniqueWindows(
      fetches
        .filter((fetch) => fetch.domain === domain)
        .map((fetch) => ({ from: fetch.from, to: fetch.to }))
    )
    if (domainWindows.length === 0) {
      plan.push({ domain, macros })
      continue
    }
    for (const window of domainWindows) {
      plan.push({ domain, macros, window })
    }
  }
  return plan
}

const readInputRange = (input: Record<string, unknown>): HarvestWindow | null => {
  const from = typeof input.from === 'string' ? input.from : ''
  const to = typeof input.to === 'string' ? input.to : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
  return { from, to }
}

const windowsOverlap = (a: HarvestWindow, b: HarvestWindow): boolean =>
  a.from <= b.to && b.from <= a.to

const triedEntryMatches = (
  entry: { name: string; from?: string; to?: string },
  macros: string[],
  window?: HarvestWindow
): boolean => {
  if (!macros.includes(entry.name)) return false
  if (!window) return true
  if (!entry.from || !entry.to) return true
  return windowsOverlap({ from: entry.from, to: entry.to }, window)
}

const triedMacro = (state: PremiumReportState, macros: string[], window?: HarvestWindow): boolean => {
  if ((state.harvestTried ?? []).some((row) => triedEntryMatches(row, macros, window))) {
    return true
  }
  return state.toolHistory.some((row) => {
    if (!macros.includes(row.name)) return false
    if (!window) return true
    const range = readInputRange(row.input)
    return range ? windowsOverlap(range, window) : true
  })
}

export const recordHarvestTried = (
  state: PremiumReportState,
  name: string,
  input: Record<string, unknown>
): void => {
  if (!(name === 'build_load_summary' || name.startsWith('fetch_'))) return
  const from = typeof input.from === 'string' ? input.from : undefined
  const to = typeof input.to === 'string' ? input.to : undefined
  state.harvestTried = state.harvestTried ?? []
  state.harvestTried.push({ name, from, to, timestamp: Date.now() })
}

const IDENTITY_COL_RE =
  /^(joueur|player|date_of_day|date|athlete_id|athlete|poste|position|unit|n|name)$/i

const ROSTER_ID_RE = /^(roster|effectif)$/i

const hasNonIdentityColumns = (dataset: PremiumDataset): boolean =>
  dataset.columns.some((col) => !IDENTITY_COL_RE.test(col))

const hasAthleteIdentityColumn = (dataset: PremiumDataset): boolean =>
  dataset.columns.some((col) => /^(joueur|player|athlete_id|athlete|name|poste|position)$/i.test(col))

export const isRosterDataset = (dataset: PremiumDataset): boolean => {
  if (ROSTER_ID_RE.test(dataset.id) || /effectif/i.test(dataset.id)) return true
  if (dataset.columns.length === 0) return false
  return !hasNonIdentityColumns(dataset) && hasAthleteIdentityColumn(dataset)
}

const datasetHasRows = (dataset: PremiumDataset): boolean =>
  !isRosterDataset(dataset) &&
  dataset.rows.length > 0 &&
  dataset.columns.length > 0 &&
  hasNonIdentityColumns(dataset)

const DOMAIN_COLUMN_HINT: Partial<Record<PremiumDomain, RegExp>> = {
  [PREMIUM_DOMAIN.LOAD]: /srpe|acwr|ewma|monotony|strain/i,
  [PREMIUM_DOMAIN.SCORES]: /performance_score|injury_risk_score/i,
  [PREMIUM_DOMAIN.GPS]:
    /distance.*abs|abs.*distance|total_distance|distance_m|hmld|hsr|sprint|player.?load|duration|speed/i,
  [PREMIUM_DOMAIN.WELLNESS]:
    /mood_rating|stress_rating|energy_rating|body_soreness|wellbeing_rating/i,
  [PREMIUM_DOMAIN.SLEEP]: /sleep|quality_rating|efficiency/i,
  [PREMIUM_DOMAIN.BIOMARKERS]: /ck|creatine|biomark|hemoglobin|ferritin|cortisol|valeur/i,
  [PREMIUM_DOMAIN.BODY]: /body|fat|mass|weight|skinfold/i,
  [PREMIUM_DOMAIN.MATCH]:
    /match|nb_matchs|minutes_?played|playing.?time|tackles?|total_?distance|sprint|intensive_?run|max_?speed|top_?speed/i,
  [PREMIUM_DOMAIN.VALD]: /vald|cmj|jump|force|asymmetr/i,
  [PREMIUM_DOMAIN.INJURY]:
    /date_of_injury|recovery_date|contact_type|patholog|^status$|^injury$|^location$|mechanism|tissue/i,
}

const datasetMatchesWindow = (dataset: PremiumDataset, window?: HarvestWindow): boolean => {
  if (!window) return true
  if (!dataset.dateRange) return true
  return windowsOverlap(dataset.dateRange, window)
}

const domainHasRows = (
  state: PremiumReportState,
  domain: PremiumDomain,
  window?: HarvestWindow
): boolean => {
  const hint = DOMAIN_COLUMN_HINT[domain]
  for (const dataset of state.datasets.values()) {
    if (!datasetHasRows(dataset) || !hasNonIdentityColumns(dataset)) continue
    if (!datasetMatchesWindow(dataset, window)) continue
    if (dataset.domain === domain) return true
    if (hint && dataset.columns.some((col) => hint.test(col))) return true
    if (!hint && triedMacro(state, DOMAIN_MACROS[domain] ?? [], window)) return true
  }
  return false
}

const entryLabel = (entry: HarvestPlanEntry): string => {
  const macro = entry.macros[0] ?? '?'
  if (!entry.window) return `${entry.domain}→${macro}`
  return `${entry.domain}@${entry.window.from}→${entry.window.to}→${macro}`
}

const matchWindowForEntry = (entry: HarvestPlanEntry): HarvestWindow | undefined =>
  entry.domain === PREMIUM_DOMAIN.LOAD ? undefined : entry.window

export const verifyHarvestPlan = (
  state: PremiumReportState,
  plan: HarvestPlanEntry[]
): HarvestVerification => {
  const pending: string[] = []
  const verdicts: HarvestDomainVerdict[] = []
  for (const entry of plan) {
    if (entry.macros.length === 0) continue
    const matchWindow = matchWindowForEntry(entry)
    const tried = triedMacro(state, entry.macros, matchWindow)
    if (!tried) {
      pending.push(entryLabel(entry))
      verdicts.push({
        domain: entry.domain,
        window: entry.window,
        status: 'pending',
        macros: entry.macros,
      })
      continue
    }
    const hasRows = domainHasRows(state, entry.domain, matchWindow)
    verdicts.push({
      domain: entry.domain,
      window: entry.window,
      status: hasRows ? 'rows' : 'empty_after_try',
      macros: entry.macros,
    })
  }
  return {
    pending,
    verdicts,
    hasAnyData: verdicts.some((row) => row.status === 'rows'),
    allVerified: pending.length === 0 && plan.length > 0,
  }
}

export const acceptLinkerHarvestEndTurn = (
  state: PremiumReportState,
  plan: HarvestPlanEntry[]
): string | null => {
  if (plan.length === 0) return null
  const verification = verifyHarvestPlan(state, plan)
  if (verification.pending.length > 0) {
    const freeSqlWhilePending = state.toolHistory.some((row) => row.name === 'query_database')
    return [
      `HarvestPlan incomplete — call remaining domain macros then end_turn: ${verification.pending.join(', ')}.`,
      'Empty once is OK; do not invent windows.',
      freeSqlWhilePending
        ? 'Prefer HarvestPlan macros over query_database for pending domains.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')
  }
  return null
}

export const harvestHasUsableDatasets = (state: PremiumReportState): boolean =>
  [...state.datasets.values()].some(datasetHasRows)

export const hasLinkedData = (state: PremiumReportState): boolean =>
  harvestHasUsableDatasets(state)
