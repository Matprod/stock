import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import type { AppLanguage } from '#utils/localize'
import {
  REPORT_V4_DATA_PROFILE_DEFAULT_SHARE,
  REPORT_V4_DATA_PROFILE_ENABLED,
  REPORT_V4_SQL_ROW_CAP_HINT,
} from '#services/report_v4/report_v4_constants'

export type DataProfileVerdict = 'usable' | 'partial' | 'unusable' | 'empty'

export type ColumnProfile = {
  column: string
  rowCount: number
  nonNullCount: number
  fillRate: number
  constant: boolean
  constantValue?: string | number | boolean | null
  suspiciousDefault: boolean
  suspiciousDefaultValue?: string | number | boolean | null
  suspiciousDefaultShare?: number
  measurementCeiling: boolean
  ceilingValue?: number
  ceilingCount?: number
  groupKey?: string
  groupValue?: string
}

export type DatasetProfile = {
  datasetId: string
  domain: PremiumDomain | 'roster' | 'unknown'
  rowCount: number
  columns: ColumnProfile[]
  truncated: boolean
  truncationReasons: string[]
  dateMin?: string
  dateMax?: string
  verdict: DataProfileVerdict
  reasons: string[]
}

export type DomainProfile = {
  domain: PremiumDomain | 'roster' | 'unknown'
  verdict: DataProfileVerdict
  reasons: string[]
  datasetIds: string[]
}

export type HarvestDataProfile = {
  window?: { from: string; to: string }
  datasets: DatasetProfile[]
  domains: DomainProfile[]
  unusableDomains: Array<PremiumDomain | 'roster' | 'unknown'>
  emptyDomains: Array<PremiumDomain | 'roster' | 'unknown'>
}

export type SubjectiveScaleHint = {
  field: string
  label?: string
  min: number
  max: number
  higherIsBetter: boolean
}

export type ProfileHarvestArgs = {
  datasets: Iterable<PremiumDataset>
  window?: { from: string; to: string }
  defaultShareThreshold?: number
  sqlRowCapHint?: number
  subjectiveScales?: SubjectiveScaleHint[]
}

const IDENTITY_COL_RE =
  /^(joueur|player_key|athlete_id|athlete|date_of_day|date|poste|position|unit|n|jersey_number|gender|start_date|end_date|biomarker|metric|player|name|nom)$/i

const DATE_COL_RE = /^(date_of_day|date)$/i

const ROUND_ROW_CAPS = new Set([1_000, 5_000, 10_000, 25_000, 50_000, 100_000])

const DATASET_DOMAIN_HINTS: Array<{ re: RegExp; domain: PremiumDomain | 'roster' }> = [
  { re: /roster/i, domain: 'roster' },
  { re: /srpe|load|acwr/i, domain: PREMIUM_DOMAIN.LOAD },
  { re: /gps/i, domain: PREMIUM_DOMAIN.GPS },
  { re: /match/i, domain: PREMIUM_DOMAIN.MATCH },
  { re: /wellness/i, domain: PREMIUM_DOMAIN.WELLNESS },
  { re: /sleep/i, domain: PREMIUM_DOMAIN.SLEEP },
  { re: /vald|cmj/i, domain: PREMIUM_DOMAIN.VALD },
  { re: /biomarker/i, domain: PREMIUM_DOMAIN.BIOMARKERS },
  { re: /body/i, domain: PREMIUM_DOMAIN.BODY },
  { re: /score/i, domain: PREMIUM_DOMAIN.SCORES },
  { re: /injur/i, domain: PREMIUM_DOMAIN.INJURY },
]

const VERDICT_RANK: Record<DataProfileVerdict, number> = {
  empty: 0,
  unusable: 1,
  partial: 2,
  usable: 3,
}

export const isReportV4DataProfileEnabled = (): boolean => {
  const raw = process.env.REPORT_V4_DATA_PROFILE?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return REPORT_V4_DATA_PROFILE_ENABLED
}

export const isIdentityProfileColumn = (column: string): boolean => IDENTITY_COL_RE.test(column)

export const inferDatasetDomain = (
  datasetId: string,
  columns: string[]
): PremiumDomain | 'roster' | 'unknown' => {
  for (const hint of DATASET_DOMAIN_HINTS) {
    if (hint.re.test(datasetId)) return hint.domain
  }
  const joined = columns.join(' ')
  if (/srpe|acwr/i.test(joined)) return PREMIUM_DOMAIN.LOAD
  if (/performance_score|injury_risk_score/i.test(joined)) return PREMIUM_DOMAIN.SCORES
  if (/distance|hmld|hsr|sprint/i.test(joined)) return PREMIUM_DOMAIN.GPS
  if (/mood|soreness|stress|energy/i.test(joined)) return PREMIUM_DOMAIN.WELLNESS
  if (/sleep/i.test(joined)) return PREMIUM_DOMAIN.SLEEP
  if (/ck|biomark|ferritin|cortisol/i.test(joined)) return PREMIUM_DOMAIN.BIOMARKERS
  if (/weight_kg|height_cm|fat_percentage/i.test(joined)) return 'roster'
  return 'unknown'
}

const normalizeScalar = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed)
      if (Number.isFinite(n)) return n
    }
    return trimmed
  }
  return String(value)
}

const isRoundCeiling = (value: number): boolean => {
  if (!Number.isFinite(value) || value === 0) return false
  const abs = Math.abs(value)
  if (abs >= 100 && abs % 1000 === 0) return true
  if (abs >= 100 && abs % 100 === 0 && abs === Math.round(abs)) return true
  return false
}

const isRoundRowCap = (rowCount: number, sqlRowCapHint: number): boolean =>
  ROUND_ROW_CAPS.has(rowCount) ||
  rowCount === sqlRowCapHint ||
  (rowCount >= 10_000 && rowCount % 10_000 === 0)

const foldScaleToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const matchSubjectiveScale = (
  column: string,
  scales?: SubjectiveScaleHint[]
): SubjectiveScaleHint | null => {
  if (!scales?.length) return null
  const col = foldScaleToken(column)
  if (col.length < 3) return null
  let best: SubjectiveScaleHint | null = null
  let bestLen = 0
  for (const scale of scales) {
    const field = foldScaleToken(scale.field)
    const stem = foldScaleToken(scale.field.replace(/_?rating$/i, ''))
    const label = foldScaleToken(scale.label ?? '')
    for (const token of [field, stem, label]) {
      if (token.length < 3) continue
      if (!col.includes(token) && !token.includes(col)) continue
      if (token.length > bestLen) {
        best = scale
        bestLen = token.length
      }
    }
  }
  return best
}

const isGoodEndOfScale = (value: number, scale: SubjectiveScaleHint): boolean =>
  scale.higherIsBetter ? value === scale.max : value === scale.min

const profileColumnValues = (args: {
  column: string
  values: unknown[]
  rowCount: number
  defaultShareThreshold: number
  groupKey?: string
  groupValue?: string
  subjectiveScales?: SubjectiveScaleHint[]
}): ColumnProfile => {
  const nonNull = args.values.map(normalizeScalar).filter((v) => v !== null)
  const nonNullCount = nonNull.length
  const fillRate = args.rowCount > 0 ? nonNullCount / args.rowCount : 0
  const counts = new Map<string, { count: number; value: string | number | boolean | null }>()
  for (const value of nonNull) {
    const key = typeof value === 'number' ? `n:${value}` : `s:${String(value)}`
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { count: 1, value })
  }

  let mode: { count: number; value: string | number | boolean | null } | null = null
  for (const entry of counts.values()) {
    if (!mode || entry.count > mode.count) mode = entry
  }

  const constant = nonNullCount > 0 && counts.size === 1
  const modeShare = nonNullCount > 0 && mode ? mode.count / nonNullCount : 0
  const scale = matchSubjectiveScale(args.column, args.subjectiveScales)
  const modeNumber = typeof mode?.value === 'number' ? mode.value : null
  const modeAtGoodEnd =
    scale && modeNumber !== null ? isGoodEndOfScale(modeNumber, scale) : false
  const suspiciousDefault =
    !constant &&
    !modeAtGoodEnd &&
    Boolean(mode) &&
    modeShare > args.defaultShareThreshold &&
    nonNullCount >= 5

  const numeric = nonNull
    .map((v) => (typeof v === 'number' ? v : null))
    .filter((v): v is number => v !== null)
  let measurementCeiling = false
  let ceilingValue: number | undefined
  let ceilingCount: number | undefined
  if (numeric.length >= 5) {
    const max = Math.max(...numeric)
    const atMax = numeric.filter((v) => v === max).length
    const share = atMax / numeric.length
    const scaleCeiling = scale && max === scale.max && scale.higherIsBetter
    if (!scaleCeiling && atMax >= 3 && (share >= 0.05 || isRoundCeiling(max))) {
      measurementCeiling = true
      ceilingValue = max
      ceilingCount = atMax
    }
  }

  return {
    column: args.column,
    rowCount: args.rowCount,
    nonNullCount,
    fillRate,
    constant,
    ...(constant ? { constantValue: mode?.value ?? null } : {}),
    suspiciousDefault,
    ...(suspiciousDefault
      ? {
          suspiciousDefaultValue: mode?.value ?? null,
          suspiciousDefaultShare: modeShare,
        }
      : {}),
    measurementCeiling,
    ...(measurementCeiling
      ? { ceilingValue, ceilingCount }
      : {}),
    ...(args.groupKey ? { groupKey: args.groupKey, groupValue: args.groupValue } : {}),
  }
}

const collectDateBounds = (
  rows: Array<Record<string, unknown>>,
  columns: string[]
): { dateMin?: string; dateMax?: string } => {
  const dateCol = columns.find((c) => DATE_COL_RE.test(c))
  if (!dateCol) return {}
  let dateMin: string | undefined
  let dateMax: string | undefined
  for (const row of rows) {
    const raw = row[dateCol]
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw)) continue
    const day = raw.slice(0, 10)
    if (!dateMin || day < dateMin) dateMin = day
    if (!dateMax || day > dateMax) dateMax = day
  }
  return { dateMin, dateMax }
}

const profileLongValueGroups = (args: {
  rows: Array<Record<string, unknown>>
  labelColumn: string
  valueColumn: string
  defaultShareThreshold: number
  subjectiveScales?: SubjectiveScaleHint[]
}): ColumnProfile[] => {
  const byGroup = new Map<string, unknown[]>()
  for (const row of args.rows) {
    const label = normalizeScalar(row[args.labelColumn])
    if (label === null) continue
    const key = String(label)
    const bucket = byGroup.get(key) ?? []
    bucket.push(row[args.valueColumn])
    byGroup.set(key, bucket)
  }
  const profiles: ColumnProfile[] = []
  for (const [groupValue, values] of byGroup) {
    profiles.push(
      profileColumnValues({
        column: args.valueColumn,
        values,
        rowCount: values.length,
        defaultShareThreshold: args.defaultShareThreshold,
        groupKey: args.labelColumn,
        groupValue,
        subjectiveScales: args.subjectiveScales,
      })
    )
  }
  return profiles
}

const msPerDay = 86_400_000

const isMeaningfulDateTruncation = (args: {
  dateMax: string
  windowTo: string
  windowFrom?: string
}): boolean => {
  const maxMs = Date.parse(`${args.dateMax}T00:00:00Z`)
  const toMs = Date.parse(`${args.windowTo}T00:00:00Z`)
  if (!Number.isFinite(maxMs) || !Number.isFinite(toMs) || maxMs >= toMs) return false
  const gapDays = Math.round((toMs - maxMs) / msPerDay)
  if (gapDays <= 2) return false
  if (args.windowFrom) {
    const fromMs = Date.parse(`${args.windowFrom}T00:00:00Z`)
    if (Number.isFinite(fromMs) && toMs > fromMs) {
      const windowDays = Math.max(1, Math.round((toMs - fromMs) / msPerDay))
      if (gapDays / windowDays < 0.2) return false
    }
  }
  return true
}

const decideDatasetVerdict = (args: {
  rowCount: number
  metricProfiles: ColumnProfile[]
  truncated: boolean
  truncationReasons: string[]
}): { verdict: DataProfileVerdict; reasons: string[] } => {
  const reasons: string[] = [...args.truncationReasons]
  if (args.rowCount === 0) {
    return { verdict: 'empty', reasons: ['no_rows'] }
  }
  if (args.metricProfiles.length === 0) {
    return { verdict: 'usable', reasons: reasons.length ? reasons : ['identity_only'] }
  }

  const populatedMetrics = args.metricProfiles.filter((p) => p.nonNullCount > 0)
  const emptyMetrics = args.metricProfiles.filter((p) => p.nonNullCount === 0)

  if (populatedMetrics.length === 0) {
    reasons.push('all_metric_columns_empty')
    return { verdict: 'partial', reasons }
  }

  const allConstant = populatedMetrics.every((p) => p.constant)
  if (allConstant && emptyMetrics.length === 0) {
    const zeroish = populatedMetrics.every((p) => p.constantValue === 0)
    reasons.push(zeroish ? 'all_metric_columns_constant_zero' : 'all_metric_columns_constant')
    return { verdict: 'unusable', reasons }
  }

  let caveats = 0
  if (emptyMetrics.length > 0) {
    if (emptyMetrics.length >= 8) {
      reasons.push(`many_empty_metric_columns:${emptyMetrics.length}`)
      caveats += 1
    } else {
      for (const profile of emptyMetrics) {
        reasons.push(`empty_column:${profile.column}`)
        caveats += 1
      }
    }
  }
  for (const profile of populatedMetrics) {
    if (profile.constant) {
      reasons.push(
        `constant:${profile.column}=${String(profile.constantValue)}${profile.groupValue ? `@${profile.groupValue}` : ''}`
      )
      caveats += 1
    }
    if (profile.suspiciousDefault) {
      reasons.push(
        `suspicious_default:${profile.column}=${String(profile.suspiciousDefaultValue)}@${Math.round((profile.suspiciousDefaultShare ?? 0) * 100)}%`
      )
      caveats += 1
    }
    if (profile.measurementCeiling) {
      reasons.push(
        `measurement_ceiling:${profile.column}=${String(profile.ceilingValue)}x${String(profile.ceilingCount)}${profile.groupValue ? `@${profile.groupValue}` : ''}`
      )
      caveats += 1
    }
  }
  if (args.truncated || caveats > 0) {
    return { verdict: 'partial', reasons: reasons.length ? reasons : ['quality_caveats'] }
  }
  return { verdict: 'usable', reasons: [] }
}

export const profileDataset = (
  dataset: PremiumDataset,
  args?: {
    window?: { from: string; to: string }
    defaultShareThreshold?: number
    sqlRowCapHint?: number
    subjectiveScales?: SubjectiveScaleHint[]
  }
): DatasetProfile => {
  const defaultShareThreshold = args?.defaultShareThreshold ?? REPORT_V4_DATA_PROFILE_DEFAULT_SHARE
  const sqlRowCapHint = args?.sqlRowCapHint ?? REPORT_V4_SQL_ROW_CAP_HINT
  const columns =
    dataset.columns.length > 0
      ? dataset.columns
      : dataset.rows[0]
        ? Object.keys(dataset.rows[0])
        : []
  const domain = inferDatasetDomain(dataset.id, columns)
  const rowCount = dataset.rows.length
  const { dateMin, dateMax } = collectDateBounds(dataset.rows, columns)

  const truncationReasons: string[] = []
  if (rowCount > 0 && isRoundRowCap(rowCount, sqlRowCapHint)) {
    truncationReasons.push(`row_cap:${rowCount}`)
  }
  if (
    args?.window?.to &&
    dateMax &&
    isMeaningfulDateTruncation({
      dateMax,
      windowTo: args.window.to,
      windowFrom: args.window.from,
    })
  ) {
    truncationReasons.push(`date_ends_before_window:${dateMax}<${args.window.to}`)
  }
  const truncated = truncationReasons.length > 0

  const metricColumns = columns.filter((c) => !isIdentityProfileColumn(c))
  const columnProfiles: ColumnProfile[] = metricColumns.map((column) =>
    profileColumnValues({
      column,
      values: dataset.rows.map((row) => row[column]),
      rowCount,
      defaultShareThreshold,
      subjectiveScales: args?.subjectiveScales,
    })
  )

  if (columns.includes('biomarker') && columns.includes('value')) {
    columnProfiles.push(
      ...profileLongValueGroups({
        rows: dataset.rows,
        labelColumn: 'biomarker',
        valueColumn: 'value',
        defaultShareThreshold,
        subjectiveScales: args?.subjectiveScales,
      })
    )
  } else if (columns.includes('metric') && columns.includes('value')) {
    columnProfiles.push(
      ...profileLongValueGroups({
        rows: dataset.rows,
        labelColumn: 'metric',
        valueColumn: 'value',
        defaultShareThreshold,
        subjectiveScales: args?.subjectiveScales,
      })
    )
  }

  const { verdict, reasons } = decideDatasetVerdict({
    rowCount,
    metricProfiles: columnProfiles,
    truncated,
    truncationReasons,
  })

  return {
    datasetId: dataset.id,
    domain,
    rowCount,
    columns: columnProfiles,
    truncated,
    truncationReasons,
    ...(dateMin ? { dateMin } : {}),
    ...(dateMax ? { dateMax } : {}),
    verdict,
    reasons,
  }
}

const rollupDomainVerdict = (profiles: DatasetProfile[]): DataProfileVerdict => {
  if (profiles.length === 0) return 'empty'
  if (profiles.every((p) => p.verdict === 'empty')) return 'empty'
  const live = profiles.filter((p) => p.verdict !== 'empty')
  if (live.length === 0) return 'empty'
  if (live.every((p) => p.verdict === 'unusable')) return 'unusable'
  if (live.every((p) => p.verdict === 'usable')) return 'usable'
  return 'partial'
}

export const profileHarvestDatasets = (args: ProfileHarvestArgs): HarvestDataProfile => {
  const defaultShareThreshold = args.defaultShareThreshold ?? REPORT_V4_DATA_PROFILE_DEFAULT_SHARE
  const sqlRowCapHint = args.sqlRowCapHint ?? REPORT_V4_SQL_ROW_CAP_HINT
  const datasets = [...args.datasets].map((dataset) =>
    profileDataset(dataset, {
      window: args.window,
      defaultShareThreshold,
      sqlRowCapHint,
      subjectiveScales: args.subjectiveScales,
    })
  )

  const byDomain = new Map<PremiumDomain | 'roster' | 'unknown', DatasetProfile[]>()
  for (const profile of datasets) {
    const list = byDomain.get(profile.domain) ?? []
    list.push(profile)
    byDomain.set(profile.domain, list)
  }

  const domains: DomainProfile[] = [...byDomain.entries()].map(([domain, list]) => {
    const verdict = rollupDomainVerdict(list)
    const reasons = list.flatMap((row) =>
      row.reasons.map((reason) => `${row.datasetId}:${reason}`)
    )
    return {
      domain,
      verdict,
      reasons,
      datasetIds: list.map((row) => row.datasetId),
    }
  })

  domains.sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.domain.localeCompare(b.domain))

  return {
    ...(args.window ? { window: args.window } : {}),
    datasets,
    domains,
    unusableDomains: domains.filter((d) => d.verdict === 'unusable').map((d) => d.domain),
    emptyDomains: domains.filter((d) => d.verdict === 'empty').map((d) => d.domain),
  }
}

export const compactDataProfileForLlm = (profile: HarvestDataProfile): Record<string, unknown> => ({
  window: profile.window ?? null,
  unusableDomains: profile.unusableDomains,
  emptyDomains: profile.emptyDomains,
  domains: profile.domains.map((d) => ({
    domain: d.domain,
    verdict: d.verdict,
    reasons: d.reasons.slice(0, 12),
    datasetIds: d.datasetIds,
  })),
  datasets: profile.datasets.map((d) => ({
    id: d.datasetId,
    domain: d.domain,
    verdict: d.verdict,
    rows: d.rowCount,
    dateMin: d.dateMin ?? null,
    dateMax: d.dateMax ?? null,
    truncated: d.truncated,
    reasons: d.reasons.slice(0, 12),
    flags: d.columns
      .filter(
        (c) =>
          c.constant || c.suspiciousDefault || c.measurementCeiling || c.nonNullCount === 0
      )
      .slice(0, 24)
      .map((c) => ({
        column: c.column,
        fillRate: Number(c.fillRate.toFixed(3)),
        constant: c.constant,
        constantValue: c.constant ? c.constantValue : undefined,
        suspiciousDefault: c.suspiciousDefault,
        suspiciousDefaultValue: c.suspiciousDefault ? c.suspiciousDefaultValue : undefined,
        suspiciousDefaultShare: c.suspiciousDefault
          ? Number((c.suspiciousDefaultShare ?? 0).toFixed(3))
          : undefined,
        measurementCeiling: c.measurementCeiling,
        ceilingValue: c.measurementCeiling ? c.ceilingValue : undefined,
        ceilingCount: c.measurementCeiling ? c.ceilingCount : undefined,
        groupValue: c.groupValue,
      })),
  })),
  rule: 'UNUSABLE domains only: do not interpret. PARTIAL (including empty KPI frames): still use populated columns/datasets in that domain. Never ban a whole domain because one harvest frame has empty optional KPIs. Never copy dataset ids or reason codes into staff narrative/signals.',
})

const PROFILE_REASON_BODY_RE =
  /^(date_ends_before_window|row_cap|empty_column|many_empty_metric_columns|suspicious_default|constant|measurement_ceiling|all_metric_columns_empty|all_metric_columns_constant_zero|all_metric_columns_constant|no_rows|identity_only|quality_caveats)(:|$)/i

const humanizeMetricLabel = (raw: string): string =>
  raw
    .replace(/@.*$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizeProfileReason = (reason: string): string => {
  const trimmed = reason.trim()
  if (PROFILE_REASON_BODY_RE.test(trimmed)) return trimmed
  const stripped = trimmed.replace(/^[^:]+:/, '')
  if (PROFILE_REASON_BODY_RE.test(stripped)) return stripped
  return trimmed
}

export const humanizeProfileReason = (reason: string, language: AppLanguage): string | null => {
  const raw = normalizeProfileReason(reason)
  if (!raw || raw === 'no_rows' || raw === 'identity_only' || raw === 'quality_caveats') {
    return null
  }
  if (raw === 'all_metric_columns_empty') {
    return language === 'fr'
      ? 'ce jeu GPS/métriques n’a pas de KPI renseignés — utiliser les autres sources peuplées du même domaine'
      : 'this metric frame has no populated KPIs — use other populated sources in the same domain'
  }
  const manyEmpty = raw.match(/^many_empty_metric_columns:(\d+)$/)
  if (manyEmpty) {
    return language === 'fr'
      ? `${manyEmpty[1]} colonnes KPI vides — interpréter seulement les métriques peuplées`
      : `${manyEmpty[1]} empty KPI columns — interpret populated metrics only`
  }
  if (raw === 'all_metric_columns_constant_zero') {
    return language === 'fr'
      ? 'toutes les métriques sont constantes à 0'
      : 'all metric columns are constant at 0'
  }
  if (raw === 'all_metric_columns_constant') {
    return language === 'fr'
      ? 'toutes les métriques sont constantes'
      : 'all metric columns are constant'
  }
  const dateEnd = raw.match(/^date_ends_before_window:([^<]+)<(.+)$/)
  if (dateEnd) {
    return language === 'fr'
      ? `couverture arrêtée au ${dateEnd[1]} (avant la fin demandée ${dateEnd[2]})`
      : `coverage stops on ${dateEnd[1]} (before requested end ${dateEnd[2]})`
  }
  const rowCap = raw.match(/^row_cap:(\d+)$/)
  if (rowCap) {
    return language === 'fr'
      ? `export probablement tronqué (plafond ~${rowCap[1]} lignes)`
      : `export likely truncated (about ${rowCap[1]} row cap)`
  }
  const emptyCol = raw.match(/^empty_column:(.+)$/)
  if (emptyCol) {
    const label = humanizeMetricLabel(emptyCol[1]!)
    return language === 'fr' ? `${label} sans valeurs` : `${label} has no values`
  }
  const suspicious = raw.match(/^suspicious_default:([^=]+)=(.+)@(\d+)%$/)
  if (suspicious) {
    const label = humanizeMetricLabel(suspicious[1]!)
    return language === 'fr'
      ? `${label} semble bloqué sur une valeur par défaut (${suspicious[2]}, ~${suspicious[3]} % des lignes)`
      : `${label} looks stuck on a default (${suspicious[2]}, ~${suspicious[3]}% of rows)`
  }
  const constant = raw.match(/^constant:([^=]+)=([^@]+)(?:@(.+))?$/)
  if (constant) {
    const label = humanizeMetricLabel(constant[1]!)
    return language === 'fr'
      ? `${label} est constant (${constant[2]}) — peu fiable`
      : `${label} is constant (${constant[2]}) — treat as unreliable`
  }
  const ceiling = raw.match(/^measurement_ceiling:([^=]+)=([^x]+)x(\d+)(?:@(.+))?$/)
  if (ceiling) {
    const label = humanizeMetricLabel(ceiling[1]!)
    const group = ceiling[4] ? `${ceiling[4]} ` : ''
    return language === 'fr'
      ? `${group}${label} plafonné à ${ceiling[2]} (${ceiling[3]} occurrences)`
      : `${group}${label} hits a measurement ceiling at ${ceiling[2]} (${ceiling[3]} hits)`
  }
  return null
}

export const collectCoachProfileLines = (
  profile: HarvestDataProfile,
  language: AppLanguage
): string[] => {
  const lines: string[] = []
  if (profile.unusableDomains.length) {
    lines.push(
      language === 'fr'
        ? `Non interprétable : ${profile.unusableDomains.join(', ')}.`
        : `Not interpretable: ${profile.unusableDomains.join(', ')}.`
    )
  }
  if (profile.emptyDomains.length) {
    lines.push(
      language === 'fr'
        ? `Sans données : ${profile.emptyDomains.join(', ')}.`
        : `No data: ${profile.emptyDomains.join(', ')}.`
    )
  }
  const seen = new Set<string>()
  for (const dataset of profile.datasets) {
    if (dataset.verdict !== 'partial' && dataset.verdict !== 'unusable') continue
    for (const reason of dataset.reasons) {
      const line = humanizeProfileReason(reason, language)
      if (!line || seen.has(line)) continue
      seen.add(line)
      lines.push(language === 'fr' ? `Limite : ${line}.` : `Limit: ${line}.`)
      if (lines.length >= 10) return lines
    }
  }
  return lines
}

export const formatDataProfileAnalystHint = (profile: HarvestDataProfile): string => {
  const coachLines = collectCoachProfileLines(profile, 'en')
  return [
    '## Data profile (deterministic — authoritative)',
    'For YOUR reasoning only. Do NOT paste dataset ids, reason codes, or raw flags into narrative, signals, or canvas prose.',
    'Staff-facing caveats must be plain language; prefer athlete/metric signals in the brief.',
    profile.unusableDomains.length
      ? `UNUSABLE (corrupt/constant — do not interpret): ${profile.unusableDomains.join(', ')}`
      : 'UNUSABLE: none',
    profile.emptyDomains.length
      ? `EMPTY (no rows): ${profile.emptyDomains.join(', ')}`
      : 'EMPTY: none',
    'PARTIAL ≠ unusable: empty optional GPS/KPI columns must not block charts on populated metrics.',
    coachLines.length ? `Coach caveats:\n- ${coachLines.join('\n- ')}` : 'Coach caveats: none',
  ].join('\n')
}

export const buildDataProfileCanvasText = (
  profile: HarvestDataProfile,
  language: AppLanguage
): { title: string; body: string } => {
  const title =
    language === 'fr' ? 'Ce que les données permettent' : 'What the data allows'
  const lines = collectCoachProfileLines(profile, language)
  if (!lines.length) {
    return {
      title,
      body:
        language === 'fr'
          ? 'Aucun signal qualité bloquant sur les données récupérées.'
          : 'No blocking quality signals on harvested data.',
    }
  }
  return { title, body: lines.join(' ') }
}

export const appendDataProfileBlocks = (
  document: PremiumReportDocument,
  profile: HarvestDataProfile,
  language: AppLanguage
): PremiumReportDocument => {
  const existing = document.blocks.some((b) => b.id === 'data_profile_heading')
  if (existing) return document
  const { title, body } = buildDataProfileCanvasText(profile, language)
  document.blocks.unshift(
    {
      id: 'data_profile_heading',
      type: PREMIUM_BLOCK_TYPE.HEADING,
      text: title,
      level: 2,
    },
    {
      id: 'data_profile_body',
      type: PREMIUM_BLOCK_TYPE.TEXT,
      text: body,
    }
  )
  return document
}

export const datasetsFromFixtureDomainPacks = (args: {
  domains: Record<string, { rows?: Array<Record<string, unknown>>; rowCount?: number }>
}): PremiumDataset[] =>
  Object.entries(args.domains).map(([id, pack]) => {
    const rows = Array.isArray(pack.rows) ? pack.rows : []
    const columns = rows[0] ? Object.keys(rows[0]) : []
    return { id, columns, rows }
  })
