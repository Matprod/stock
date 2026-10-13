import logger from '@adonisjs/core/services/logger'
import { PREMIUM_DOMAIN, PREMIUM_DOMAINS, type PremiumDomain } from '#constants/premium_report_domains'
import {
  formatClubSeasonsBrief,
  type ClubSeasonRef,
} from '#services/report_v4/club_seasons'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import {
  EWMA_CHRONIC_MIN_LOOKBACK_DAYS,
  shiftIsoDate,
  todayUtcIso,
  type IsoDateRange,
} from '#services/report_v4/lookback_range'
import {
  REPORT_V4_LEAN_WINDOW_DAYS,
  REPORT_V4_MAX_FETCH_LOOKBACK_BEFORE_DISPLAY,
} from '#services/report_v4/report_v4_constants'
import {
  byDomainFromFetches,
  fetchesFromByDomain,
  resolvePromptWindows,
  unionCoverRange,
  type PromptFetchSpec,
  type PromptWindows,
} from '#services/report_v4/prompt_scope'
import {
  clampFetchesToSessionFocus,
  formatSessionFocusBrief,
  type ReportV4SessionFocus,
} from '#services/report_v4/session_focus'

type LlmFetchRow = {
  domain?: string
  from?: string
  to?: string
  metrics?: unknown
  label?: string
}

type LlmWindowPayload = {
  explicit?: boolean
  display?: { from?: string; to?: string }
  fetches?: LlmFetchRow[]
  byDomain?: Record<string, { from?: string; to?: string }>
  extraRanges?: Array<{ from?: string; to?: string }>
  rationale?: string
  domains?: unknown
  period_follow_up?: unknown
  multi_section?: unknown
}

const DOMAIN_KEYS = new Set<string>(Object.values(PREMIUM_DOMAIN))

const isIsoDay = (value: string | undefined): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`))

const normalizeRange = (raw: { from?: string; to?: string } | undefined): IsoDateRange | null => {
  if (!raw || !isIsoDay(raw.from) || !isIsoDay(raw.to)) return null
  return raw.from <= raw.to ? { from: raw.from, to: raw.to } : { from: raw.to, to: raw.from }
}

const WINDOW_SYSTEM_PROMPT = `You extract calendar date windows for sports staff reports from a coach prompt (FR or EN).

Today (UTC anchor) is provided in the user message. All relative phrases resolve against that day.

Rules:
- Return ONLY valid JSON (no markdown fences, no prose).
- "explicit": true when the coach stated any period (relative OR absolute). false only when no period cue at all.
- "display": main report window {from,to} as ISO YYYY-MM-DD inclusive.
- Relative:
  - "derniere semaine" / "last week" / "cette semaine" → last 7 calendar days ending today (today inclusive).
  - "N dernieres semaines" / "last N weeks" → N×7 calendar days ending today.
  - "N derniers jours" / "last N days" → N calendar days ending today.
  - "dernier mois" / "last month" → 30 calendar days ending today (unless a named calendar month is clear).
  - "depuis le 29 juin" / "start from 29 June" → from that date → today.
- Absolute ISO or day+month phrases → those exact dates (infer year from today when omitted).
- Named calendar month without year (e.g. "decembre", "December", "en fevrier"): if that month in the current year would start AFTER today → use the PREVIOUS year (today=2026-10-07 + "decembre" → 2025-12-01→2025-12-31, NEVER 2026-12). Same for Feb–Mar asked in October → still current year if already past; if still ahead of today → previous year.
- Club seasons: when the user message lists Club seasons, treat that list as authoritative.
  - "this/current season" (any language) → active season dates.
  - "last/previous season" → most recent season that already ended.
  - Named season or year span matching a listed row (e.g. 2024-25, season name) → that row's from→to.
  - If season end > Today, clamp display/fetch \`to\` to Today. Prefer club season bounds over inventing July–June defaults.
- FORBIDDEN any fetch/display window that starts in the future relative to Today.
- "fetches": REQUIRED complete list of macro pulls. Each item: {domain, from, to, metrics?, label?}.
  - domain keys: load,gps,wellness,sleep,scores,biomarkers,match,vald,body,injury.
  - One entry per fetch the linker must run. SAME domain MAY appear multiple times with DIFFERENT windows (e.g. wellness mood on Feb vs wellness stress on March → TWO wellness rows with metrics ["mood"] and ["stress"]).
  - metrics: optional column/slice names when the coach scopes a metric inside a domain (mood, stress, energy, body_soreness, performance_score, …).
  - Clinical injury log / availability / rehab → domain "injury" (NOT scores). ML injury_risk_score → domain "scores".
  - Include every domain the ask needs. If no specific period → use display dates. Do NOT invent domains the coach did not ask for (e.g. skip vald/body/injury unless tests/composition/clinical injuries are requested).
  - When the coach only asks "derniere semaine" / "last week" (or similar relative span), EVERY fetch must use the display window (load may start ~28d earlier for ACWR only). FORBIDDEN inventing Dec/Feb archive biomarker or sleep windows the coach never named.
  - Never leave a fetchable period only in extraRanges — put it in fetches.
- "extraRanges": ONLY periods that cannot be assigned to a domain.
- Never invent a window outside what the prompt implies. If no period → explicit:false and display = last ${REPORT_V4_LEAN_WINDOW_DAYS} days ending today.
- When Prior session focus is provided: period-only or status follow-ups (last/previous season, today, this week, still active, "and last season?") MUST reuse prior focus domains in fetches — do NOT expand to a default load/wellness/sleep/scores/match pack unless the coach names those domains. If the coach names new domains, use those instead.
- "domains": array of domain keys the coach explicitly named (subset of load,gps,wellness,sleep,scores,biomarkers,match,vald,body,injury). Empty array if none named.
- "period_follow_up": true when this is mainly a period/status follow-up on prior focus (last/prior season|week|month, today/active status).
- "multi_section": true when the ask needs several distinct report beats (many domains / viz types / archive+display); false for a thin single-purpose ask.

JSON shape:
{"explicit":true,"display":{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"},"fetches":[{"domain":"wellness","from":"YYYY-MM-DD","to":"YYYY-MM-DD","metrics":["mood"]}],"extraRanges":[],"domains":["wellness"],"period_follow_up":false,"multi_section":false,"rationale":"short"}`

const foldPrompt = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const readMetrics = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const metrics = value
    .filter((row): row is string => typeof row === 'string' && row.trim().length > 0)
    .map((row) => row.trim().toLowerCase())
  return metrics.length ? metrics : undefined
}

const rangeKey = (range: IsoDateRange): string => `${range.from}|${range.to}`

const fetchKey = (fetch: PromptFetchSpec): string =>
  `${fetch.domain}|${fetch.from}|${fetch.to}|${[...(fetch.metrics ?? [])].sort().join(',')}`

const shiftIsoYear = (iso: string, deltaYears: number): string => {
  const year = Number(iso.slice(0, 4)) + deltaYears
  if (!Number.isFinite(year)) return iso
  return `${year}${iso.slice(4)}`
}

const shiftRangeOutOfFuture = (range: IsoDateRange, today: string): IsoDateRange => {
  let from = range.from
  let to = range.to
  let guard = 0
  while (from > today && guard < 5) {
    from = shiftIsoYear(from, -1)
    to = shiftIsoYear(to, -1)
    guard += 1
  }
  if (to > today) to = today
  if (from > to) from = to
  return { from, to }
}

const PAD_ONLY_IF_ASKED = new Set<PremiumDomain>([
  PREMIUM_DOMAIN.LOAD,
  PREMIUM_DOMAIN.GPS,
  PREMIUM_DOMAIN.MATCH,
  PREMIUM_DOMAIN.BODY,
])

const fillMissingDomainFetches = (
  _prompt: string,
  display: IsoDateRange,
  fetches: PromptFetchSpec[],
  askDomains?: PremiumDomain[]
): PromptFetchSpec[] => {
  void _prompt
  const asked = askDomains ?? []
  const askedSet = new Set(asked)
  const next =
    asked.length === 0
      ? [...fetches]
      : fetches.filter((row) => !PAD_ONLY_IF_ASKED.has(row.domain) || askedSet.has(row.domain))
  const present = new Set(next.map((row) => row.domain))
  for (const domain of asked) {
    if (present.has(domain)) continue
    next.push({ domain, from: display.from, to: display.to })
    present.add(domain)
  }
  return next
}

const promptMentionsAbsolutePast = (prompt: string, fetchFrom: string): boolean => {
  const text = foldPrompt(prompt)
  const year = fetchFrom.slice(0, 4)
  if (text.includes(year)) return true
  const month = Number(fetchFrom.slice(5, 7))
  const monthNames = [
    '',
    'janvier|january|jan',
    'fevrier|february|feb',
    'mars|march|mar',
    'avril|april|apr',
    'mai|may',
    'juin|june|jun',
    'juillet|july|jul',
    'aout|august|aug',
    'septembre|september|sep|sept',
    'octobre|october|oct',
    'novembre|november|nov',
    'decembre|december|dec',
  ]
  const names = monthNames[month]
  if (!names) return false
  return new RegExp(String.raw`(?:^|[^a-z0-9_])(?:${names})(?:[^a-z0-9_]|$)`, 'i').test(text)
}

const daysBetween = (from: string, to: string): number => {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86_400_000)
}

const rangesOverlap = (a: IsoDateRange, b: IsoDateRange): boolean =>
  a.from <= b.to && b.from <= a.to

/** Drop hallucinated archive windows (e.g. Dec biomarkers on a March display ask). */
export const clampFetchesToAsk = (
  prompt: string,
  display: IsoDateRange,
  fetches: PromptFetchSpec[]
): PromptFetchSpec[] => {
  const earliestAllowed = shiftIsoDate(display.from, -REPORT_V4_MAX_FETCH_LOOKBACK_BEFORE_DISPLAY)
  const loadEarliest = shiftIsoDate(display.from, -EWMA_CHRONIC_MIN_LOOKBACK_DAYS)
  return fetches
    .map((fetch) => {
      if (fetch.domain === PREMIUM_DOMAIN.LOAD) {
        if (fetch.from >= loadEarliest) return fetch
        if (promptMentionsAbsolutePast(prompt, fetch.from)) return fetch
        return { ...fetch, from: display.from, to: display.to }
      }
      if (rangesOverlap(fetch, display)) {
        const floor = earliestAllowed
        if (fetch.from >= floor) return fetch
        if (promptMentionsAbsolutePast(prompt, fetch.from)) return fetch
        return { ...fetch, from: display.from, to: display.to }
      }
      if (promptMentionsAbsolutePast(prompt, fetch.from)) return fetch
      return { ...fetch, from: display.from, to: display.to }
    })
    .filter((fetch) => {
      if (daysBetween(fetch.from, fetch.to) <= 370) return true
      return promptMentionsAbsolutePast(prompt, fetch.from)
    })
}

const fallbackWindows = (today: string, fallbackDays: number): PromptWindows => {
  const display = {
    from: shiftIsoDate(today, -(fallbackDays - 1)),
    to: today,
  }
  return {
    display,
    byDomain: {},
    fetches: [],
    extraRanges: [],
    cover: display,
    explicit: false,
  }
}

const materializePayload = (
  payload: LlmWindowPayload,
  today: string,
  fallbackDays: number,
  prompt: string,
  askDomains: PremiumDomain[] = []
): PromptWindows => {
  const display = shiftRangeOutOfFuture(
    normalizeRange(payload.display) ??
      ({
        from: shiftIsoDate(today, -(fallbackDays - 1)),
        to: today,
      } satisfies IsoDateRange),
    today
  )

  const fetches: PromptFetchSpec[] = []
  for (const row of payload.fetches ?? []) {
    if (!row.domain || !DOMAIN_KEYS.has(row.domain)) continue
    const rawRange = normalizeRange(row)
    if (!rawRange) continue
    const range = shiftRangeOutOfFuture(rawRange, today)
    const metrics = readMetrics(row.metrics)
    const label = typeof row.label === 'string' && row.label.trim() ? row.label.trim() : undefined
    const spec: PromptFetchSpec = {
      domain: row.domain as PremiumDomain,
      from: range.from,
      to: range.to,
      ...(metrics ? { metrics } : {}),
      ...(label ? { label } : {}),
    }
    if (!fetches.some((existing) => fetchKey(existing) === fetchKey(spec))) fetches.push(spec)
  }

  if (fetches.length === 0) {
    for (const [key, value] of Object.entries(payload.byDomain ?? {})) {
      if (!DOMAIN_KEYS.has(key)) continue
      const rawRange = normalizeRange(value)
      if (!rawRange) continue
      const range = shiftRangeOutOfFuture(rawRange, today)
      fetches.push({ domain: key as PremiumDomain, from: range.from, to: range.to })
    }
  }

  const filled = clampFetchesToAsk(
    prompt,
    display,
    fillMissingDomainFetches(prompt, display, fetches, askDomains).map((row) => {
      const range = shiftRangeOutOfFuture({ from: row.from, to: row.to }, today)
      return { ...row, from: range.from, to: range.to }
    })
  )
  const byDomain = byDomainFromFetches(filled)

  const mappedKeys = new Set(filled.map((row) => rangeKey({ from: row.from, to: row.to })))
  const extraRanges = (payload.extraRanges ?? [])
    .map((row) => normalizeRange(row))
    .filter((row): row is IsoDateRange => row != null)
    .map((range) => shiftRangeOutOfFuture(range, today))
    .filter((range) => range.from !== display.from || range.to !== display.to)
    .filter((range) => !mappedKeys.has(rangeKey(range)))

  const explicit = payload.explicit === true && normalizeRange(payload.display) != null
  const cover = unionCoverRange(display, byDomain, extraRanges)
  return { display, byDomain, fetches: filled, extraRanges, cover, explicit }
}

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= 0.55
  return false
}

const domainsFromPayload = (payload: LlmWindowPayload): PremiumDomain[] => {
  if (!Array.isArray(payload.domains)) return []
  return payload.domains
    .filter((row): row is string => typeof row === 'string' && DOMAIN_KEYS.has(row))
    .map((row) => row as PremiumDomain)
}

const invokeHaikuWindows = async (
  prompt: string,
  today: string,
  seasons: ClubSeasonRef[],
  contextBlock: string
): Promise<LlmWindowPayload> => {
  const seasonsBlock = formatClubSeasonsBrief(seasons, today)
  const user = [
    `Today (UTC): ${today}`,
    '',
    seasonsBlock,
    contextBlock ? `\n${contextBlock}\n` : '',
    `Coach prompt:\n${prompt}`,
  ]
    .filter(Boolean)
    .join('\n')
  return invokeHaikuJson<LlmWindowPayload>({
    system: WINDOW_SYSTEM_PROMPT,
    user,
    maxTokens: 900,
    temperature: 0,
  })
}

export type AnalyzeRequestLlmBundle = {
  windows: PromptWindows
  askDomains: PremiumDomain[]
  periodFollowUp: boolean
  multiSection: boolean
  provider: 'haiku' | 'heuristic'
}

const structuralMultiSection = (args: {
  askDomainCount: number
  fetchDomainCount: number
  fetchWindowCount: number
}): boolean =>
  args.askDomainCount >= 4 ||
  (args.fetchDomainCount >= 4 && args.fetchWindowCount >= 5) ||
  args.fetchWindowCount >= 6

const heuristicPeriodFollowUp = (prompt: string): boolean =>
  /\b(last|previous|prior)\b.{0,28}\b(season|week|month)\b/i.test(prompt) ||
  /\b(today|still active|status)\b/i.test(prompt)

/** One Haiku call: windows + domains + period follow-up + multi-section. */
export const analyzeRequestWithLlm = async (
  prompt: string,
  opts?: ResolvePromptWindowsWithLlmOpts
): Promise<AnalyzeRequestLlmBundle> => {
  const fallbackDays = opts?.fallbackDays ?? REPORT_V4_LEAN_WINDOW_DAYS
  const seasons = opts?.seasons ?? []
  const today = todayUtcIso()
  const trimmed = prompt.trim()
  if (!trimmed) {
    return {
      windows: fallbackWindows(today, fallbackDays),
      askDomains: [],
      periodFollowUp: false,
      multiSection: false,
      provider: 'heuristic',
    }
  }

  const focusBrief = formatSessionFocusBrief(opts?.sessionFocus)
  const priorAsks = (opts?.priorUserAsks ?? []).filter((row) => row.trim().length > 0)
  const contextBlock = [
    focusBrief,
    priorAsks.length
      ? `Prior user asks (oldest→newest, max 2):\n${priorAsks.map((ask, i) => `${i + 1}. ${ask}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const t0 = Date.now()
  try {
    const payload = await invokeHaikuWindows(trimmed, today, seasons, contextBlock)
    let askDomains = domainsFromPayload(payload)
    if (!askDomains.length && opts?.askDomains?.length) askDomains = opts.askDomains
    const periodFollowUp =
      boolFromUnknown(payload.period_follow_up) ||
      Boolean(opts?.periodFollowUp) ||
      heuristicPeriodFollowUp(trimmed)
    let windows = materializePayload(payload, today, fallbackDays, trimmed, askDomains)
    const afterFocus = clampFetchesToSessionFocus(
      windows.fetches,
      opts?.sessionFocus,
      askDomains,
      periodFollowUp
    )
    const fetches = clampFetchesToAsk(trimmed, windows.display, afterFocus)
    if (
      fetches !== windows.fetches ||
      afterFocus !== windows.fetches ||
      fetches.length !== windows.fetches.length ||
      fetches.some((row, i) => fetchKey(row) !== fetchKey(windows.fetches[i]!))
    ) {
      const byDomain = byDomainFromFetches(fetches)
      windows = {
        ...windows,
        fetches,
        byDomain,
        cover: unionCoverRange(windows.display, byDomain, windows.extraRanges),
      }
    }
    const fetchDomains = [...new Set(windows.fetches.map((row) => row.domain))]
    const multiSection =
      boolFromUnknown(payload.multi_section) ||
      structuralMultiSection({
        askDomainCount: askDomains.length,
        fetchDomainCount: fetchDomains.length,
        fetchWindowCount: windows.fetches.length,
      })
    logger.info(
      {
        explicit: windows.explicit,
        display: windows.display,
        byDomain: windows.byDomain,
        fetches: windows.fetches,
        askDomains,
        periodFollowUp,
        multiSection,
        rationale: payload.rationale,
        durationMs: Date.now() - t0,
      },
      'report_v4.analyze_request_llm'
    )
    return {
      windows,
      askDomains,
      periodFollowUp,
      multiSection,
      provider: 'haiku',
    }
  } catch (error) {
    logger.warn({ err: error, durationMs: Date.now() - t0 }, 'report_v4.analyze_request_llm_failed')
    const fallback = resolvePromptWindows(prompt, fallbackDays, seasons)
    const askDomains = opts?.askDomains?.length
      ? opts.askDomains
      : ([...new Set(Object.keys(fallback.byDomain))] as PremiumDomain[]).filter((domain) =>
          PREMIUM_DOMAINS.includes(domain)
        )
    const periodFollowUp = Boolean(opts?.periodFollowUp) || heuristicPeriodFollowUp(trimmed)
    const afterFocus = clampFetchesToSessionFocus(
      clampFetchesToAsk(
        trimmed,
        fallback.display,
        fillMissingDomainFetches(
          trimmed,
          fallback.display,
          fallback.fetches.length ? fallback.fetches : fetchesFromByDomain(fallback.byDomain),
          askDomains
        )
      ),
      opts?.sessionFocus,
      askDomains,
      periodFollowUp
    )
    const fetches = clampFetchesToAsk(trimmed, fallback.display, afterFocus)
    const byDomain = byDomainFromFetches(fetches)
    const windows: PromptWindows = {
      ...fallback,
      fetches,
      byDomain,
      cover: unionCoverRange(fallback.display, byDomain, fallback.extraRanges),
    }
    const fetchDomains = [...new Set(fetches.map((row) => row.domain))]
    return {
      windows,
      askDomains,
      periodFollowUp,
      multiSection: structuralMultiSection({
        askDomainCount: askDomains.length,
        fetchDomainCount: fetchDomains.length,
        fetchWindowCount: fetches.length,
      }),
      provider: 'heuristic',
    }
  }
}

export type ResolvePromptWindowsWithLlmOpts = {
  fallbackDays?: number
  seasons?: ClubSeasonRef[]
  sessionFocus?: ReportV4SessionFocus | null
  priorUserAsks?: string[]
  askDomains?: PremiumDomain[]
  periodFollowUp?: boolean
}

/** Haiku windows; sync regex fallback. Prefer `analyzeRequest` for full early analysis. */
export const resolvePromptWindowsWithLlm = async (
  prompt: string,
  opts?: ResolvePromptWindowsWithLlmOpts
): Promise<PromptWindows> => (await analyzeRequestWithLlm(prompt, opts)).windows
