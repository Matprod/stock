import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import { asSeriesList } from '#services/premium_report/charts/echarts_types'
import { columnStats, round3, toNumber } from '#services/premium_report/dataset_ops'
import type { ReportBrief } from '#services/report_v4/report_brief'

type FactGroundingHit = {
  code: 'numeric_ungrounded' | 'literal_number'
  message: string
  evidence?: string
}

export const IDENTITY_COL_RE =
  /^(joueur|player|athlete|athlete_id|name|full_?name|athlete_?name|date_of_day|date|poste|position|unit|n|count)$/i

export const fold = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

type MetricGrounding = {
  key: string
  values: Set<number>
  min: number
  max: number
}

type GroundedNumberIndex = {
  global: Set<number>
  byMetric: Map<string, MetricGrounding>
  byAthleteMetric: Map<string, MetricGrounding>
  metricTokens: Array<{ key: string; token: string }>
}

type NumericClaim = {
  value: number
  metricKey?: string
  athlete?: string
  evidence: string
}

const AMBIGUOUS_COUNT_RE =
  /\b(?:n\s*=\s*\d+|count\s*=\s*\d+|sample\s*size\s*=?\s*\d+|\d+\s*(?:athletes?|players?|days?|weeks?|months?|sessions?|rows?|groups?|signals?|watches?))\b/i

const RANKING_CONTEXT_RE =
  /\b(?:top|group|rank|page|chart|section|watch|signals?)\s*#?\s*\d+\b|\b\d+\s*(?:st|nd|rd|th)\b/i

const ISO_DATE_FRAG_RE = /\b\d{4}-\d{2}-\d{2}\b/
const CHART_HOST_RE = /\bchart[_\s-]?\d+\b/i
const NUMERIC_TOKEN_RE = /(?<![A-Za-z0-9_])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9_])/g
const SCORE_SCALE_RANGE_RE = /\(\s*0\s*[-–—to]+\s*100\s*\)/gi
const SCORE_METRIC_RE = /\b(?:score|risk|performance|injury)\b/i

const LITERAL_ISO_DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g
const LITERAL_ISO_DATE_RANGE_RE =
  /\b\d{4}-\d{2}-\d{2}\s*(?:→|->|–|—|-|to|au|à)\s*\d{4}-\d{2}-\d{2}\b/gi
const LITERAL_SLASH_DATE_RE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g
const LITERAL_MONTH_YEAR_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janv(?:ier)?|févr(?:ier)?|fevr(?:ier)?|mars|avr(?:il)?|mai|juin|juil(?:let)?|août|aout|sept(?:embre)?|oct(?:obre)?|nov(?:embre)?|déc(?:embre)?|dec(?:embre)?)\s+20\d{2}\b/gi
const LITERAL_YEAR_TOKEN_RE = /\b20\d{2}\b/g
const LITERAL_CHART_HOST_RE = /\bchart_[a-z0-9_-]+\b/gi
const LITERAL_SECTION_NUM_RE = /\b(?:section|part|page|chart)\s*#?\s*\d+\b/gi
const LITERAL_ORDINAL_RE = /\b\d+(?:st|nd|rd|th)\b/gi
const LITERAL_LIST_INDEX_RE = /(?:^|[\s>])\d{1,2}[.)]\s/g
const LITERAL_UNIT_PAIR_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:%|kg|cm|km|m|ms|sec(?:s|onds?)?|min(?:utes?)?|h(?:ours?)?|u\/l|ul|bpm|au)\b/gi
const LITERAL_SCALE_RANGE_RE =
  /\b(?:0\s*[-–—to]+\s*100|1\s*[-–—to]+\s*(?:5|7|10)|0\s*[-–—to]+\s*10)\b/gi

const athleteMetricKey = (athlete: string, metric: string): string =>
  `${fold(athlete)}::${fold(metric)}`

const addGroundedNumber = (set: Set<number>, raw: number): void => {
  if (!Number.isFinite(raw)) return
  const n = round3(raw)
  set.add(n)
  set.add(round3(Math.round(raw * 100) / 100))
  set.add(round3(Math.round(raw * 10) / 10))
  if (Math.abs(raw - Math.round(raw)) < 0.051) set.add(Math.round(raw))
}

const ensureMetric = (map: Map<string, MetricGrounding>, key: string): MetricGrounding => {
  const folded = fold(key)
  const existing = map.get(folded)
  if (existing) return existing
  const created: MetricGrounding = {
    key: folded,
    values: new Set(),
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  }
  map.set(folded, created)
  return created
}

const ingestMetricValue = (metric: MetricGrounding, raw: number): void => {
  addGroundedNumber(metric.values, raw)
  if (raw < metric.min) metric.min = raw
  if (raw > metric.max) metric.max = raw
}

const collectNestedNumbers = (value: unknown, out: Set<number>, depth = 0): void => {
  if (depth > 8) return
  if (typeof value === 'number') {
    addGroundedNumber(out, value)
    return
  }
  if (typeof value === 'string') {
    const n = toNumber(value)
    if (n != null) addGroundedNumber(out, n)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNestedNumbers(item, out, depth + 1)
    return
  }
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if ('value' in record) collectNestedNumbers(record.value, out, depth + 1)
  if ('yAxis' in record) collectNestedNumbers(record.yAxis, out, depth + 1)
  if ('xAxis' in record) collectNestedNumbers(record.xAxis, out, depth + 1)
  if (Array.isArray(record.data)) collectNestedNumbers(record.data, out, depth + 1)
}

const ingestDatasetColumn = (
  index: GroundedNumberIndex,
  column: string,
  rows: Array<Record<string, unknown>>,
  athleteColumn?: string
): void => {
  if (IDENTITY_COL_RE.test(column)) return
  const metric = ensureMetric(index.byMetric, column)
  const values: number[] = []
  for (const row of rows) {
    const n = toNumber(row[column])
    if (n == null) continue
    values.push(n)
    addGroundedNumber(index.global, n)
    ingestMetricValue(metric, n)
    if (athleteColumn) {
      const athlete = String(row[athleteColumn] ?? '').trim()
      if (athlete) {
        ingestMetricValue(ensureMetric(index.byAthleteMetric, athleteMetricKey(athlete, column)), n)
      }
    }
  }
  if (values.length === 0) return
  const stats = columnStats(rows, column)
  if (stats) {
    for (const n of [stats.min, stats.max, stats.mean, stats.median]) {
      addGroundedNumber(index.global, n)
      ingestMetricValue(metric, n)
    }
  }
  const sum = values.reduce((acc, n) => acc + n, 0)
  addGroundedNumber(index.global, sum)
  ingestMetricValue(metric, sum)
  const last = values[values.length - 1]
  if (last != null) {
    addGroundedNumber(index.global, last)
    ingestMetricValue(metric, last)
  }
}

const ingestChartOption = (option: Record<string, unknown>, index: GroundedNumberIndex): void => {
  for (const series of asSeriesList(option.series)) {
    collectNestedNumbers(series.data, index.global)
    if (series.markLine?.data) collectNestedNumbers(series.markLine.data, index.global)
  }
  if (option.dataset && typeof option.dataset === 'object' && !Array.isArray(option.dataset)) {
    collectNestedNumbers((option.dataset as { source?: unknown }).source, index.global)
  }
}

export const buildGroundedNumberIndex = (
  datasets: Iterable<PremiumDataset>,
  document?: PremiumReportDocument
): GroundedNumberIndex => {
  const index: GroundedNumberIndex = {
    global: new Set(),
    byMetric: new Map(),
    byAthleteMetric: new Map(),
    metricTokens: [],
  }
  const tokenKeys = new Set<string>()
  const pushToken = (raw: string, metricKey: string) => {
    const token = fold(raw).replace(/_/g, ' ')
    if (token.length < 3 || IDENTITY_COL_RE.test(raw) || IDENTITY_COL_RE.test(metricKey)) {
      return
    }
    const key = fold(metricKey)
    const id = `${key}|${token}`
    if (tokenKeys.has(id)) return
    tokenKeys.add(id)
    index.metricTokens.push({ key, token })
  }

  for (const dataset of datasets) {
    const athleteColumn = pickAthleteColumn(dataset.columns)
    for (const column of dataset.columns) {
      pushToken(column, column)
      const label = dataset.labels?.[column]
      if (label?.trim()) pushToken(label, column)
      ingestDatasetColumn(index, column, dataset.rows, athleteColumn)
    }
  }

  if (document) {
    for (const block of document.blocks) {
      if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
        for (const column of block.columns) pushToken(column, column)
        for (const row of block.rows) {
          for (const cell of row) {
            const n = toNumber(cell)
            if (n != null) addGroundedNumber(index.global, n)
          }
          for (let i = 0; i < block.columns.length; i += 1) {
            const column = block.columns[i]
            if (!column || IDENTITY_COL_RE.test(column)) continue
            const n = toNumber(row[i])
            if (n == null) continue
            ingestMetricValue(ensureMetric(index.byMetric, column), n)
          }
        }
      }
      if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
        ingestChartOption(block.option, index)
      }
    }
  }

  index.metricTokens.sort((a, b) => b.token.length - a.token.length)
  return index
}

const numbersNearEqual = (left: number, right: number): boolean => {
  const delta = Math.abs(left - right)
  if (delta <= 0.005) return true
  const scale = Math.max(Math.abs(left), Math.abs(right), 1)
  return delta / scale <= 0.005
}

const setHasNumber = (set: Set<number>, value: number): boolean => {
  const target = round3(value)
  if (set.has(target)) return true
  for (const candidate of set) {
    if (numbersNearEqual(candidate, value)) return true
  }
  return false
}

const withinMetricRange = (metric: MetricGrounding, value: number): boolean => {
  if (!Number.isFinite(metric.min) || !Number.isFinite(metric.max)) return false
  const span = metric.max - metric.min
  const pad = Math.max(0.01, span * 0.02, Math.abs(metric.max) * 0.01)
  return value >= metric.min - pad && value <= metric.max + pad
}

const resolveMetric = (index: GroundedNumberIndex, raw: string): MetricGrounding | undefined => {
  const needle = fold(raw)
  if (!needle) return undefined
  const exact = index.byMetric.get(needle)
  if (exact) return exact
  const needleLoose = needle.replace(/_/g, ' ')
  for (const [key, metric] of index.byMetric) {
    const keyLoose = key.replace(/_/g, ' ')
    if (
      key === needle ||
      keyLoose === needleLoose ||
      keyLoose.includes(needleLoose) ||
      needleLoose.includes(keyLoose)
    ) {
      return metric
    }
  }
  return undefined
}

const isAmbiguousNumericContext = (text: string, matchIndex: number, raw: string): boolean => {
  if (/^(?:19|20)\d{2}$/.test(raw.replace(',', '.'))) return true
  const window = text.slice(Math.max(0, matchIndex - 28), matchIndex + raw.length + 28)
  if (ISO_DATE_FRAG_RE.test(window)) return true
  if (CHART_HOST_RE.test(window)) return true
  if (AMBIGUOUS_COUNT_RE.test(window)) return true
  if (RANKING_CONTEXT_RE.test(window)) return true
  if (/\bn\s*=\s*$/i.test(text.slice(Math.max(0, matchIndex - 6), matchIndex))) return true
  const asNumber = toNumber(raw)
  if (asNumber == null) return true
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 31) {
    if (/\b(?:day|date|march|april|may|june|july|aug|sep|oct|nov|dec|jan|feb)\b/i.test(window)) {
      return true
    }
  }
  return false
}

const parseClaimNumber = (raw: string): number | null => toNumber(raw.replace(/\s/g, ''))

const claimIsGrounded = (claim: NumericClaim, index: GroundedNumberIndex): boolean => {
  if (setHasNumber(index.global, claim.value)) return true
  const metric = claim.metricKey ? resolveMetric(index, claim.metricKey) : undefined
  if (metric) {
    if (setHasNumber(metric.values, claim.value)) return true
    if (withinMetricRange(metric, claim.value)) return true
    if (claim.athlete) {
      const personal = index.byAthleteMetric.get(athleteMetricKey(claim.athlete, metric.key))
      if (personal) {
        if (setHasNumber(personal.values, claim.value)) return true
        if (withinMetricRange(personal, claim.value)) return true
      }
    }
  }
  return false
}

const maskScoreScaleRanges = (text: string): string =>
  text.replace(SCORE_SCALE_RANGE_RE, (match) => ' '.repeat(match.length))

const isScoreScaleBoundClaim = (
  text: string,
  index: number,
  raw: string,
  value: number
): boolean => {
  if (value !== 0 && value !== 100) return false
  const window = text.slice(Math.max(0, index - 40), index + raw.length + 40)
  return SCORE_SCALE_RANGE_RE.test(window) || /\b0\s*[-–—to]+\s*100\b/i.test(window)
}

const extractNumbersFromText = (
  text: string
): Array<{ value: number; raw: string; index: number }> => {
  const masked = maskScoreScaleRanges(text)
  const out: Array<{ value: number; raw: string; index: number }> = []
  NUMERIC_TOKEN_RE.lastIndex = 0
  for (const match of masked.matchAll(NUMERIC_TOKEN_RE)) {
    const raw = match[1] ?? match[0]
    const index = match.index ?? 0
    if (isAmbiguousNumericContext(text, index, raw)) continue
    const value = parseClaimNumber(raw)
    if (value == null) continue
    if (isScoreScaleBoundClaim(text, index, raw, value)) continue
    out.push({ value, raw, index })
  }
  return out
}

const metricsInWindow = (
  text: string,
  index: GroundedNumberIndex,
  from: number,
  to: number
): string[] => {
  const window = fold(text.slice(from, to)).replace(/_/g, ' ')
  const hits: string[] = []
  const seen = new Set<string>()
  for (const token of index.metricTokens) {
    if (!window.includes(token.token) || seen.has(token.key)) continue
    seen.add(token.key)
    hits.push(token.key)
  }
  return hits
}

export const extractNumericClaimsFromText = (
  text: string,
  index: GroundedNumberIndex,
  athlete?: string
): NumericClaim[] => {
  if (!text?.trim() || index.metricTokens.length === 0) return []
  const claims: NumericClaim[] = []
  const numbers = extractNumbersFromText(text)
  for (const hit of numbers) {
    const metrics = metricsInWindow(
      text,
      index,
      Math.max(0, hit.index - 48),
      Math.min(text.length, hit.index + hit.raw.length + 48)
    )
    if (metrics.length === 0) continue
    for (const metricKey of metrics.slice(0, 3)) {
      claims.push({
        value: hit.value,
        metricKey,
        athlete,
        evidence: `${metricKey}=${hit.raw}`,
      })
    }
  }
  return claims
}

export const extractNumericClaimsFromBrief = (
  brief: ReportBrief,
  index: GroundedNumberIndex
): NumericClaim[] => {
  const claims: NumericClaim[] = []
  for (const signal of brief.signals) {
    for (const [key, raw] of Object.entries(signal.metrics)) {
      const value = typeof raw === 'number' ? raw : toNumber(String(raw))
      if (value == null) continue
      claims.push({
        value,
        metricKey: key,
        athlete: signal.athlete?.trim() || undefined,
        evidence: `signal.metrics.${key}=${raw}`,
      })
    }
    if (signal.summary?.trim()) {
      claims.push(
        ...extractNumericClaimsFromText(signal.summary, index, signal.athlete?.trim() || undefined)
      )
    }
  }
  for (const chunk of [brief.focus, ...brief.narrative]) {
    if (!chunk?.trim()) continue
    claims.push(...extractNumericClaimsFromText(chunk, index))
  }
  for (const section of brief.sections) {
    if (section.title?.trim()) {
      claims.push(
        ...extractNumericClaimsFromText(
          section.title,
          index,
          section.athleteName?.trim() || undefined
        )
      )
    }
    for (const bullet of section.bullets) {
      claims.push(
        ...extractNumericClaimsFromText(bullet, index, section.athleteName?.trim() || undefined)
      )
    }
  }
  return claims
}

export const auditNumericClaims = (
  claims: NumericClaim[],
  index: GroundedNumberIndex
): FactGroundingHit[] => {
  if (index.global.size === 0 || claims.length === 0) return []
  const violations: FactGroundingHit[] = []
  for (const claim of claims) {
    if (!claim.metricKey) continue
    const metric = resolveMetric(index, claim.metricKey)
    if (!metric) continue
    if (Number.isInteger(claim.value) && claim.value >= 0 && claim.value <= 20 && metric.max > 40) {
      continue
    }
    if (
      (claim.value === 0 || claim.value === 100) &&
      SCORE_METRIC_RE.test(claim.metricKey ?? '') &&
      /\(0-100\)|0\s*[-–—to]+\s*100/i.test(claim.evidence)
    ) {
      continue
    }
    if (claimIsGrounded(claim, index)) continue
    violations.push({
      code: 'numeric_ungrounded',
      message: 'KPI value not present in dataset columnStats, table cells, or chart series',
      evidence: claim.athlete ? `${claim.athlete} ${claim.evidence}` : claim.evidence,
    })
  }
  return violations
}

const LITERAL_FR_COUNT_RE =
  /\b\d+\s+(?:(?:[A-Za-zÀ-ÿ]+|GPS|VALD)\s+){0,3}(?:séances?|sessions?|joueurs?|athlètes?|athletes?|players?|jours?|days?|semaines?|weeks?|mois|months?)\b/gi
const LITERAL_DAY_MONTH_RE =
  /\b\d{1,2}\s+(?:jan(?:uary|v(?:ier)?)?|feb(?:ruary)?|févr?(?:ier)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|jun(?:e)?|juin|jul(?:y)?|juil(?:let)?|aug(?:ust)?|ao[uû]t|sep(?:t(?:ember|embre)?)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember)?|déc(?:embre)?)\b\.?/gi
const LITERAL_PAGE_FRAC_RE = /\b\d+\s*\/\s*\d+\b/g

const maskAllowedNumericContexts = (plain: string): string =>
  plain
    .replace(LITERAL_ISO_DATE_RANGE_RE, ' DATE_RANGE ')
    .replace(LITERAL_ISO_DATE_RE, ' DATE ')
    .replace(LITERAL_SLASH_DATE_RE, ' DATE ')
    .replace(LITERAL_MONTH_YEAR_RE, ' DATE ')
    .replace(LITERAL_DAY_MONTH_RE, ' DATE ')
    .replace(LITERAL_YEAR_TOKEN_RE, ' YEAR ')
    .replace(LITERAL_FR_COUNT_RE, ' COUNT ')
    .replace(AMBIGUOUS_COUNT_RE, ' COUNT ')
    .replace(LITERAL_CHART_HOST_RE, ' CHART ')
    .replace(LITERAL_SECTION_NUM_RE, ' SECTION ')
    .replace(LITERAL_ORDINAL_RE, ' ORD ')
    .replace(LITERAL_LIST_INDEX_RE, ' LIST ')
    .replace(LITERAL_PAGE_FRAC_RE, ' PAGE ')
    .replace(LITERAL_UNIT_PAIR_RE, ' UNIT ')
    .replace(LITERAL_SCALE_RANGE_RE, ' SCALE ')

const stripLinkedNumberSpansForAudit = (html: string): string =>
  html.replace(/<span\b[^>]*\bdata-fact=["'][^"']+["'][^>]*>[\s\S]*?<\/span>/gi, ' ')

export const auditLiteralNumbersOutsideFacts = (html: string): FactGroundingHit[] => {
  const withoutFacts = stripLinkedNumberSpansForAudit(html)
  const plain = withoutFacts
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return []
  const masked = maskAllowedNumericContexts(plain)
  const violations: FactGroundingHit[] = []
  const tokenRe = /(?<![A-Za-z0-9_])(-?\d+(?:[.,]\d+)?)(?![A-Za-z0-9_])/g
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(masked)) !== null) {
    const raw = match[1] ?? ''
    const normalized = raw.replace(',', '.')
    const value = Number(normalized)
    if (!Number.isFinite(value)) continue
    violations.push({
      code: 'literal_number',
      message: 'Literal number in prose outside data-fact span',
      evidence: raw,
    })
  }
  return violations
}
