import { PREMIUM_DOMAINS, type PremiumDomain } from '#constants/premium_report_domains'
import { collectSeasonRanges, type ClubSeasonRef } from '#services/report_v4/club_seasons'
import {
  currentWeekToDate,
  DEFAULT_REPORT_TIMEZONE,
  previousCompleteCalendarWeek,
  shiftIsoDate,
  todayInTimeZone,
  type IsoDateRange,
} from '#services/report_v4/lookback_range'
import {
  REPORT_V4_LEAN_WINDOW_DAYS,
  REPORT_V4_MS_PER_DAY,
} from '#services/report_v4/report_v4_constants'

export type ResolvePromptWindowsOpts = {
  timeZone?: string
  today?: string
}

const RANGE_SEP = String.raw`(?:to|->|→|⇒|–|-|—)`

export type { IsoDateRange }

export type PromptFetchSpec = {
  domain: PremiumDomain
  from: string
  to: string
  metrics?: string[]
  label?: string
}

export type PromptWindows = {
  display: IsoDateRange
  byDomain: Partial<Record<PremiumDomain, IsoDateRange>>
  fetches: PromptFetchSpec[]
  extraRanges: IsoDateRange[]
  cover: IsoDateRange
  explicit: boolean
}

const unionIsoRanges = (ranges: IsoDateRange[]): IsoDateRange | null => {
  if (ranges.length === 0) return null
  let from = ranges[0]!.from
  let to = ranges[0]!.to
  for (const range of ranges) {
    if (range.from < from) from = range.from
    if (range.to > to) to = range.to
  }
  return { from, to }
}

export const byDomainFromFetches = (
  fetches: PromptFetchSpec[]
): Partial<Record<PremiumDomain, IsoDateRange>> => {
  const buckets = new Map<PremiumDomain, IsoDateRange[]>()
  for (const fetch of fetches) {
    const list = buckets.get(fetch.domain) ?? []
    list.push({ from: fetch.from, to: fetch.to })
    buckets.set(fetch.domain, list)
  }
  const out: Partial<Record<PremiumDomain, IsoDateRange>> = {}
  for (const [domain, ranges] of buckets) {
    const union = unionIsoRanges(ranges)
    if (union) out[domain] = union
  }
  return out
}

export const fetchesFromByDomain = (
  byDomain: Partial<Record<PremiumDomain, IsoDateRange>>
): PromptFetchSpec[] =>
  Object.entries(byDomain).flatMap(([domain, range]) =>
    range ? [{ domain: domain as PremiumDomain, from: range.from, to: range.to }] : []
  )

type LocatedRange = {
  from: string
  to: string
  index: number
  end: number
}

const fold = (value: string): string => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const isoDate = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

const isValidIsoDay = (iso: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(`${iso}T12:00:00Z`))

const pushUnique = (into: LocatedRange[], next: LocatedRange) => {
  if (into.some((r) => r.index === next.index && r.from === next.from && r.to === next.to)) return
  into.push(next)
}

/** Month names after fold() (accents stripped). Longest first for regex. */
const MONTH_ENTRIES: Array<{ name: string; month: number }> = (
  [
    ['janvier', 1],
    ['janv', 1],
    ['january', 1],
    ['jan', 1],
    ['fevrier', 2],
    ['fevr', 2],
    ['february', 2],
    ['feb', 2],
    ['mars', 3],
    ['march', 3],
    ['mar', 3],
    ['avril', 4],
    ['avr', 4],
    ['april', 4],
    ['apr', 4],
    ['mai', 5],
    ['may', 5],
    ['juin', 6],
    ['june', 6],
    ['jun', 6],
    ['juillet', 7],
    ['juil', 7],
    ['july', 7],
    ['jul', 7],
    ['aout', 8],
    ['august', 8],
    ['aug', 8],
    ['septembre', 9],
    ['sept', 9],
    ['september', 9],
    ['sep', 9],
    ['octobre', 10],
    ['october', 10],
    ['oct', 10],
    ['novembre', 11],
    ['november', 11],
    ['nov', 11],
    ['decembre', 12],
    ['december', 12],
    ['dec', 12],
  ] as Array<[string, number]>
)
  .map(([name, month]) => ({ name, month }))
  .sort((a, b) => b.name.length - a.name.length)

const MONTH_ALT = MONTH_ENTRIES.map((entry) => entry.name).join('|')

const monthFromName = (raw: string): number | null => {
  const key = fold(raw)
  return MONTH_ENTRIES.find((entry) => entry.name === key)?.month ?? null
}

/**
 * Infer calendar year when the coach omits it.
 * Past months in the same year stay; a named month still entirely after `today` → previous year
 * (e.g. "December" asked in October → last December).
 */
const inferYearForMonth = (month: number, today: string, explicitYear?: number): number => {
  if (explicitYear != null && Number.isFinite(explicitYear)) return explicitYear
  const year = Number(today.slice(0, 4))
  const end = isoDate(year, month, lastDayOfMonth(year, month))
  if (end > today) return year - 1
  return year
}

const collectIsoPairs = (text: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(20\d{2}-\d{2}-\d{2})\s*${RANGE_SEP}\s*(20\d{2}-\d{2}-\d{2})\b`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const from = match[1]!
    const to = match[2]!
    if (isValidIsoDay(from) && isValidIsoDay(to) && from <= to) {
      pushUnique(out, {
        from,
        to,
        index: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      })
    }
  }
  return out
}

const collectIsoSingles = (text: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = /\b(20\d{2}-\d{2}-\d{2})\b/g
  for (const match of text.matchAll(re)) {
    const iso = match[1]!
    if (!isValidIsoDay(iso)) continue
    pushUnique(out, {
      from: iso,
      to: iso,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })
  }
  return out
}

const collectIsoMonthWindows = (text: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = /\b(20\d{2})-(\d{2})\b/g
  for (const match of text.matchAll(re)) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (!Number.isFinite(year) || month < 1 || month > 12) continue
    const idx = match.index ?? 0
    if (text.slice(idx, idx + 10).match(/^\d{4}-\d{2}-\d{2}/)) continue
    pushUnique(out, {
      from: isoDate(year, month, 1),
      to: isoDate(year, month, lastDayOfMonth(year, month)),
      index: idx,
      end: idx + match[0].length,
    })
  }
  return out
}

/** Same-month day spans: "1–7 March 2026", "from 1 to 7 March". */
const collectSameMonthDayRanges = (text: string, today: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(?:du|de|from|the)?\s*(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s*${RANGE_SEP}\s*(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s+(${MONTH_ALT})\b(?:\s*(20\d{2}))?`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const dayFrom = Number(match[1])
    const dayTo = Number(match[2])
    const month = monthFromName(match[3]!)
    const year = inferYearForMonth(month ?? 0, today, match[4] ? Number(match[4]) : undefined)
    if (!month || dayFrom < 1 || dayTo < 1 || dayFrom > 31 || dayTo > 31) continue
    const from = isoDate(year, month, Math.min(dayFrom, lastDayOfMonth(year, month)))
    const to = isoDate(year, month, Math.min(dayTo, lastDayOfMonth(year, month)))
    if (!isValidIsoDay(from) || !isValidIsoDay(to) || from > to) continue
    pushUnique(out, {
      from,
      to,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })
  }
  return out
}

/** Cross-month day spans: "from 25 February to 7 March 2026". */
const collectCrossMonthDayRanges = (text: string, today: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(?:du|de|from|the)?\s*(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s+(${MONTH_ALT})\s*${RANGE_SEP}\s*(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s+(${MONTH_ALT})\b(?:\s*(20\d{2}))?`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const dayFrom = Number(match[1])
    const monthFrom = monthFromName(match[2]!)
    const dayTo = Number(match[3])
    const monthTo = monthFromName(match[4]!)
    const explicitYear = match[5] ? Number(match[5]) : undefined
    if (!monthFrom || !monthTo || dayFrom < 1 || dayTo < 1) continue

    let yearTo = inferYearForMonth(monthTo, today, explicitYear)
    let yearFrom = inferYearForMonth(monthFrom, today, explicitYear)
    if (explicitYear == null && monthFrom > monthTo) {
      yearFrom = yearTo - 1
    } else if (explicitYear == null && monthFrom <= monthTo) {
      yearFrom = yearTo
    }
    const from = isoDate(
      yearFrom,
      monthFrom,
      Math.min(dayFrom, lastDayOfMonth(yearFrom, monthFrom))
    )
    const to = isoDate(yearTo, monthTo, Math.min(dayTo, lastDayOfMonth(yearTo, monthTo)))
    if (!isValidIsoDay(from) || !isValidIsoDay(to) || from > to) continue
    pushUnique(out, {
      from,
      to,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })
  }
  return out
}

/** Bare month windows: "in March 2026", "December 2025" — not "29th June". */
const collectNamedMonthWindows = (text: string, today: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(?:en|in|of|pour|for|sur|during)?\s*(${MONTH_ALT})(?:\s*(20\d{2}))?\b`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const month = monthFromName(match[1]!)
    if (!month) continue
    const idx = match.index ?? 0
    const end = idx + match[0].length
    const before = text.slice(Math.max(0, idx - 16), idx)
    if (/\d{1,2}(?:er|e|eme|th|st|nd|rd)?\s*$/i.test(before)) continue
    const year = inferYearForMonth(month, today, match[2] ? Number(match[2]) : undefined)
    pushUnique(out, {
      from: isoDate(year, month, 1),
      to: isoDate(year, month, lastDayOfMonth(year, month)),
      index: idx,
      end,
    })
  }
  return out
}

/** Named calendar day: "29th June 2026", "29 June". */
const collectNamedDays = (text: string, today: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(?:le|la|the|on|du|de)?\s*(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s+(${MONTH_ALT})(?:\s*(20\d{2}))?\b`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const day = Number(match[1])
    const month = monthFromName(match[2]!)
    if (!month || day < 1 || day > 31) continue
    const year = inferYearForMonth(month, today, match[3] ? Number(match[3]) : undefined)
    const iso = isoDate(year, month, Math.min(day, lastDayOfMonth(year, month)))
    if (!isValidIsoDay(iso)) continue
    pushUnique(out, {
      from: iso,
      to: iso,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })
  }
  return out
}

/**
 * Open-ended start: "Start this from 29th June 2026", "from 29 June".
 * Display = that day → today (fetch lookback still extends before `from` for EWMA/ACWR).
 */
const collectOpenStartRanges = (text: string, today: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const re = new RegExp(
    String.raw`\b(?:start(?:ing)?(?:\s+this)?\s+from|from|a\s+partir(?:\s+du)?|depuis|commence(?:r)?(?:\s+(?:le|au|a|ce\s+rapport))?(?:\s+(?:du|le|a))?)\s+(\d{1,2})(?:er|e|eme|th|st|nd|rd)?\s+(${MONTH_ALT})(?:\s*(20\d{2}))?\b`,
    'g'
  )
  for (const match of text.matchAll(re)) {
    const day = Number(match[1])
    const month = monthFromName(match[2]!)
    if (!month || day < 1 || day > 31) continue
    const year = inferYearForMonth(month, today, match[3] ? Number(match[3]) : undefined)
    const from = isoDate(year, month, Math.min(day, lastDayOfMonth(year, month)))
    if (!isValidIsoDay(from)) continue
    const to = from <= today ? today : from
    pushUnique(out, {
      from,
      to,
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    })
  }
  return out
}

const RELATIVE_COUNT_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  one: 1,
  deux: 2,
  two: 2,
  trois: 3,
  three: 3,
  quatre: 4,
  four: 4,
  cinq: 5,
  five: 5,
  six: 6,
  sept: 7,
  seven: 7,
  huit: 8,
  eight: 8,
  neuf: 9,
  nine: 9,
  dix: 10,
  ten: 10,
  onze: 11,
  eleven: 11,
  douze: 12,
  twelve: 12,
  quinze: 15,
  fifteen: 15,
  twenty: 20,
  vingt: 20,
}

const COUNT_TOKEN = String.raw`(\d{1,3}|${Object.keys(RELATIVE_COUNT_WORDS).join('|')})`

const parseRelativeCount = (raw: string | undefined): number | null => {
  if (!raw) return null
  const digit = Number(raw)
  if (Number.isFinite(digit) && digit >= 1) return digit
  const word = RELATIVE_COUNT_WORDS[raw]
  return word != null && word >= 1 ? word : null
}

const collectNamedWeekRanges = (text: string, todayIso: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const lastWeek = previousCompleteCalendarWeek(todayIso)
  const thisWeek = currentWeekToDate(todayIso)
  const patterns: Array<{ re: RegExp; range: IsoDateRange }> = [
    {
      re: /\b(?:(?:la|de\s+la)\s+)?semaine\s+derniere\b|\bderniere\s+semaine\b|\blast\s+week\b|\bprevious\s+week\b/g,
      range: lastWeek,
    },
    {
      re: /\bcette\s+semaine\b|\bthis\s+week\b/g,
      range: thisWeek,
    },
  ]
  for (const { re, range } of patterns) {
    for (const match of text.matchAll(re)) {
      pushUnique(out, {
        from: range.from,
        to: range.to,
        index: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      })
    }
  }
  return out
}

const collectRelativeRanges = (text: string, anchorTo: string): LocatedRange[] => {
  const out: LocatedRange[] = []
  const patterns: Array<{ re: RegExp; days: (n: number) => number }> = [
    { re: new RegExp(String.raw`\b(?:last|past)\s+${COUNT_TOKEN}\s*days?\b`, 'g'), days: (n) => n },
    {
      re: new RegExp(String.raw`\b(?:last|past)\s+${COUNT_TOKEN}\s*weeks?\b`, 'g'),
      days: (n) => n * 7,
    },
    {
      re: new RegExp(String.raw`\b(?:last|past)\s+${COUNT_TOKEN}\s*months?\b`, 'g'),
      days: (n) => n * 30,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?derniers?\s+${COUNT_TOKEN}\s*jours?\b`,
        'g'
      ),
      days: (n) => n,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?dernieres?\s+${COUNT_TOKEN}\s*semaines?\b`,
        'g'
      ),
      days: (n) => n * 7,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?derniers?\s+${COUNT_TOKEN}\s*mois\b`,
        'g'
      ),
      days: (n) => n * 30,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?${COUNT_TOKEN}\s+derniers?\s+jours?\b`,
        'g'
      ),
      days: (n) => n,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?${COUNT_TOKEN}\s+dernieres?\s+semaines?\b`,
        'g'
      ),
      days: (n) => n * 7,
    },
    {
      re: new RegExp(
        String.raw`\b(?:les?\s+|des?\s+|ces?\s+)?${COUNT_TOKEN}\s+derniers?\s+mois\b`,
        'g'
      ),
      days: (n) => n * 30,
    },
    {
      re: new RegExp(String.raw`\b${COUNT_TOKEN}\s+(?:last|past)\s+weeks?\b`, 'g'),
      days: (n) => n * 7,
    },
    { re: /\b(\d{1,3})\s*d(?:ays?)?\b/g, days: (n) => n },
  ]
  for (const { re, days } of patterns) {
    for (const match of text.matchAll(re)) {
      const n = parseRelativeCount(match[1])
      if (n == null) continue
      const span = Math.max(1, days(n))
      pushUnique(out, {
        from: shiftIsoDate(anchorTo, -(span - 1)),
        to: anchorTo,
        index: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      })
    }
  }
  return out
}

const rangeContainsToken = (span: LocatedRange, token: LocatedRange): boolean =>
  span.index <= token.index && token.end <= span.end

const promptAsksLineChart = (prompt: string): boolean =>
  /\bline\s*charts?\b|\btime\s*series\b/i.test(fold(prompt))

export const ensureTimeSeriesDomainWindows = (
  prompt: string,
  display: IsoDateRange,
  byDomain: Partial<Record<PremiumDomain, IsoDateRange>>
): Partial<Record<PremiumDomain, IsoDateRange>> => {
  if (!promptAsksLineChart(prompt)) return byDomain
  const fromMs = Date.parse(`${display.from}T12:00:00Z`)
  const toMs = Date.parse(`${display.to}T12:00:00Z`)
  const span =
    Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs >= fromMs
      ? Math.round((toMs - fromMs) / REPORT_V4_MS_PER_DAY) + 1
      : REPORT_V4_LEAN_WINDOW_DAYS
  if (span > 3) return byDomain
  const domains = Object.keys(byDomain) as PremiumDomain[]
  if (domains.length === 0) return byDomain
  const lean = {
    from: shiftIsoDate(display.to, -(REPORT_V4_LEAN_WINDOW_DAYS - 1)),
    to: display.to,
  }
  const next: Partial<Record<PremiumDomain, IsoDateRange>> = { ...byDomain }
  for (const domain of domains) next[domain] = lean
  return next
}

const domainNear = (text: string, index: number, end: number): PremiumDomain | null => {
  const before = text.slice(Math.max(0, index - 120), index)
  const after = text.slice(end, Math.min(text.length, end + 120))
  const around = `${before} ${after}`.toLowerCase()
  for (const domain of PREMIUM_DOMAINS) {
    const key = domain.replace(/_/g, ' ')
    if (new RegExp(String.raw`(?:^|[^a-z0-9_])${domain}(?:[^a-z0-9_]|$)`, 'i').test(around)) {
      return domain
    }
    if (
      key !== domain &&
      new RegExp(String.raw`(?:^|[^a-z0-9_])${key}(?:[^a-z0-9_]|$)`, 'i').test(around)
    ) {
      return domain
    }
  }
  return null
}

const pickDisplayPool = (
  text: string,
  rows: LocatedRange[]
): { display: IsoDateRange | null; globals: LocatedRange[] } => {
  const globals = rows
    .filter((range) => domainNear(text, range.index, range.end) == null)
    .sort((a, b) => a.index - b.index)
  const pool = (globals.length ? globals : [...rows]).sort((a, b) => a.index - b.index)
  // Prefer the first multi-day global window (coach display), not a single day.
  const multiDay = pool.find((range) => range.from !== range.to)
  const first = multiDay ?? pool[0]
  return {
    display: first ? { from: first.from, to: first.to } : null,
    globals,
  }
}

export const unionCoverRange = (
  display: IsoDateRange,
  byDomain: Partial<Record<PremiumDomain, IsoDateRange>>,
  extraRanges: IsoDateRange[]
): IsoDateRange => {
  const ranges: IsoDateRange[] = [display, ...Object.values(byDomain), ...extraRanges]
  let from = ranges[0]!.from
  let to = ranges[0]!.to
  for (const range of ranges) {
    if (range.from < from) from = range.from
    if (range.to > to) to = range.to
  }
  return { from, to }
}

const WELLNESS_METRIC_ALIASES: Array<{ metric: string; aliases: string[] }> = [
  { metric: 'mood', aliases: ['mood', 'humeur'] },
  { metric: 'stress', aliases: ['stress'] },
  { metric: 'energy', aliases: ['energy', 'energie'] },
  { metric: 'body_soreness', aliases: ['soreness', 'courbature', 'douleur', 'body_soreness'] },
]

const metricsNear = (text: string, index: number, end: number): string[] => {
  const around = text.slice(Math.max(0, index - 80), Math.min(text.length, end + 80))
  const found: string[] = []
  for (const { metric, aliases } of WELLNESS_METRIC_ALIASES) {
    const re = new RegExp(String.raw`(?:^|[^a-z0-9_])(?:${aliases.join('|')})(?:[^a-z0-9_]|$)`, 'i')
    if (re.test(around)) found.push(metric)
  }
  return found
}

const sameMetricSet = (a?: string[], b?: string[]): boolean => {
  const left = [...(a ?? [])].sort().join(',')
  const right = [...(b ?? [])].sort().join(',')
  return left === right
}

export const resolvePromptWindows = (
  prompt: string,
  fallbackDays = REPORT_V4_LEAN_WINDOW_DAYS,
  seasons: ClubSeasonRef[] = [],
  opts?: ResolvePromptWindowsOpts
): PromptWindows => {
  const text = fold(prompt)
  const today =
    opts?.today && isValidIsoDay(opts.today)
      ? opts.today
      : todayInTimeZone(opts?.timeZone ?? DEFAULT_REPORT_TIMEZONE)

  const isoPairs = collectIsoPairs(text)
  const isoMonths = collectIsoMonthWindows(text)
  const sameMonthDays = collectSameMonthDayRanges(text, today)
  const crossMonthDays = collectCrossMonthDayRanges(text, today)
  const openStarts = collectOpenStartRanges(text, today)
  const namedDays = collectNamedDays(text, today).filter(
    (day) => !openStarts.some((span) => rangeContainsToken(span, day))
  )
  const daySpans = [...sameMonthDays, ...crossMonthDays, ...openStarts]
  const namedMonths = collectNamedMonthWindows(text, today).filter(
    (monthRange) =>
      !daySpans.some((span) => rangeContainsToken(span, monthRange)) &&
      !namedDays.some((day) => rangeContainsToken(day, monthRange))
  )
  const seasonRanges: LocatedRange[] = collectSeasonRanges(prompt, seasons, today).map((row) => ({
    from: row.from,
    to: row.to,
    index: row.index,
    end: row.end,
  }))
  const namedWeeks = collectNamedWeekRanges(text, today)

  const spanning = [
    ...isoPairs,
    ...isoMonths,
    ...daySpans,
    ...namedMonths,
    ...seasonRanges,
    ...namedWeeks,
  ]
  const singles = [...namedDays, ...collectIsoSingles(text)].filter(
    (day) => !spanning.some((span) => rangeContainsToken(span, day))
  )
  const calendar = [...spanning, ...singles]

  const anchorTo = [...calendar].sort((a, b) => a.index - b.index)[0]?.to ?? today
  const relative = collectRelativeRanges(text, anchorTo).filter(
    (range) => !namedWeeks.some((week) => rangeContainsToken(week, range) || rangeContainsToken(range, week))
  )

  const located = [...calendar, ...relative].sort((a, b) => a.index - b.index)
  const fetches: PromptFetchSpec[] = []
  for (const range of located) {
    const domain = domainNear(text, range.index, range.end)
    if (!domain) continue
    const metrics = metricsNear(text, range.index, range.end)
    const dup = fetches.some(
      (row) =>
        row.domain === domain &&
        row.from === range.from &&
        row.to === range.to &&
        sameMetricSet(row.metrics, metrics)
    )
    if (!dup) {
      fetches.push({
        domain,
        from: range.from,
        to: range.to,
        ...(metrics.length ? { metrics } : {}),
      })
    }
  }

  const calendarPick = pickDisplayPool(text, calendar)
  const relativePick = pickDisplayPool(text, relative)

  const explicit = located.length > 0
  const byDomain = byDomainFromFetches(fetches)
  const display =
    calendarPick.display ??
    relativePick.display ??
    (Object.values(byDomain)[0] != null
      ? { ...(Object.values(byDomain)[0] as IsoDateRange) }
      : { from: shiftIsoDate(today, -(fallbackDays - 1)), to: today })

  const extraRanges = [...calendarPick.globals, ...relativePick.globals]
    .filter((range) => range.from !== display.from || range.to !== display.to)
    .map((range) => ({ from: range.from, to: range.to }))
    .filter(
      (range, index, all) =>
        all.findIndex((row) => row.from === range.from && row.to === range.to) === index
    )

  const cover = unionCoverRange(display, byDomain, extraRanges)

  return { display, byDomain, fetches, extraRanges, cover, explicit }
}
