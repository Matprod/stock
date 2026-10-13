import { REPORT_FORMULA_ID, type ReportFormulaId } from '#constants/report_builder.constants'
import type { ReportFormulaSpec } from '#contracts/report_builder'

type FormulaSeries = Array<number | null>

type FormulaResult = {
  series: FormulaSeries
  scalar?: number | null
}

type FormulaKind = 'series' | 'reduce'
export type FormulaGroup = 'stats' | 'rolling' | 'load' | 'baseline'
export type ReportFormulaParams = Record<string, number | boolean>

type FormulaDef = {
  id: ReportFormulaId
  kind: FormulaKind
  defaults: ReportFormulaParams
  params: string[]
  useWhen: string
  group: FormulaGroup
  apply: (series: FormulaSeries, params: ReportFormulaParams) => FormulaResult
  titleSuffix?: (params: ReportFormulaParams) => string
}

export const isReportFormulaId = (value: string): value is ReportFormulaId =>
  value in REPORT_FORMULAS

export const mergeFormulaParams = (
  id: ReportFormulaId,
  params?: ReportFormulaParams
): ReportFormulaParams => ({
  ...REPORT_FORMULAS[id].defaults,
  ...(params ?? {}),
})

export const isReduceFormula = (formula: ReportFormulaSpec | null | undefined): boolean =>
  formula != null && REPORT_FORMULAS[formula.id]?.kind === 'reduce'

export const isAllReduceSeries = (
  series: Array<{ formula?: ReportFormulaSpec | null }>
): boolean => series.length > 0 && series.every((spec) => isReduceFormula(spec.formula))

export const applyFormula = (series: FormulaSeries, spec: ReportFormulaSpec): FormulaResult =>
  REPORT_FORMULAS[spec.id].apply(series, mergeFormulaParams(spec.id, spec.params))

export const formulaTitleSuffix = (spec: ReportFormulaSpec): string => {
  const params = mergeFormulaParams(spec.id, spec.params)
  return REPORT_FORMULAS[spec.id].titleSuffix?.(params) ?? ` · ${spec.id}`
}

export const normalizeFormulaSpec = (spec: ReportFormulaSpec): ReportFormulaSpec => ({
  id: spec.id,
  params: mergeFormulaParams(spec.id, spec.params),
})

const round = (value: number): number => Math.round(value * 1000) / 1000

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const valuesOf = (series: FormulaSeries): number[] => series.filter(finite)

const meanOf = (values: number[]): number | null => {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const varianceSample = (values: number[]): number | null => {
  if (values.length < 2) return null
  const mean = meanOf(values)
  if (mean === null) return null
  const sumSq = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return sumSq / (values.length - 1)
}

const sdOf = (values: number[]): number | null => {
  const variance = varianceSample(values)
  return variance === null ? null : Math.sqrt(variance)
}

const medianOf = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid]!
}

const percentileOf = (values: number[], percentile: number): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 1) return sorted[0]!
  const index = (percentile / 100) * (sorted.length - 1)
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sorted[low]!
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low)
}

const num = (params: ReportFormulaParams, key: string, fallback: number): number => {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

const bool = (params: ReportFormulaParams, key: string, fallback: boolean): boolean => {
  const value = params[key]
  return typeof value === 'boolean' ? value : fallback
}

const windowSlice = (series: FormulaSeries, endIndex: number, size: number): FormulaSeries => {
  const start = Math.max(0, endIndex - size + 1)
  return series.slice(start, endIndex + 1)
}

const lastFinite = (series: FormulaSeries): number | null => {
  for (let index = series.length - 1; index >= 0; index--) {
    if (finite(series[index])) return series[index]!
  }
  return null
}

const seriesResult = (out: FormulaSeries): FormulaResult => ({
  series: out,
  scalar: lastFinite(out),
})

const reduceResult = (series: FormulaSeries, scalar: number | null): FormulaResult => ({
  series: Array.from({ length: series.length }, () => (finite(scalar) ? round(scalar) : null)),
  scalar: finite(scalar) ? round(scalar) : null,
})

const windowParams = (params: ReportFormulaParams, fallbackN: number) => {
  const n = num(params, 'n', fallbackN)
  const minPoints =
    typeof params.minPoints === 'number' && params.minPoints > 0 ? params.minPoints : Math.min(4, n)
  return { n, minPoints }
}

const mapWindow = (
  series: FormulaSeries,
  params: ReportFormulaParams,
  fallbackN: number,
  aggregate: (values: number[]) => number | null
): FormulaResult => {
  const { n, minPoints } = windowParams(params, fallbackN)
  return seriesResult(
    series.map((_, index) => {
      const values = valuesOf(windowSlice(series, index, n))
      if (values.length < minPoints) return null
      const value = aggregate(values)
      return value === null ? null : round(value)
    })
  )
}

const applyMovingAverage = (
  series: FormulaSeries,
  params: ReportFormulaParams = {}
): FormulaResult => mapWindow(series, params, 7, meanOf)

const applyMedianMovingAverage = (
  series: FormulaSeries,
  params: ReportFormulaParams = {}
): FormulaResult => mapWindow(series, params, 7, medianOf)

const applyEwma = (series: FormulaSeries, params: ReportFormulaParams = {}): FormulaResult => {
  const n = num(params, 'n', 7)
  const lambda = 2 / (n + 1)
  const out: FormulaSeries = Array.from({ length: series.length }, () => null)
  let state: number | null = null
  for (let index = 0; index < series.length; index++) {
    const value = series[index]
    if (!finite(value)) continue
    state = state === null ? value : lambda * value + (1 - lambda) * state
    out[index] = round(state)
  }
  return seriesResult(out)
}

const applyCumulative = (series: FormulaSeries): FormulaResult => {
  let total = 0
  let hasValue = false
  return seriesResult(
    series.map((value) => {
      if (!finite(value)) return hasValue ? round(total) : null
      total += value
      hasValue = true
      return round(total)
    })
  )
}

const rollingAcwr = (
  acute: FormulaSeries,
  chronic: FormulaSeries,
  series: FormulaSeries,
  opts: { acute: number; uncoupled: boolean; minDenomRatio: number }
): FormulaResult => {
  const ref = meanOf(valuesOf(series).map(Math.abs)) ?? 0
  const minDenom = opts.minDenomRatio * ref
  return seriesResult(
    series.map((_, index) => {
      const chronicIndex = opts.uncoupled ? index - opts.acute : index
      if (chronicIndex < 0) return null
      const a = acute[index]
      const c = chronic[chronicIndex]
      if (!finite(a) || !finite(c) || c === 0 || Math.abs(c) < minDenom) return null
      return round(a / c)
    })
  )
}

const applyAcwr = (
  series: FormulaSeries,
  params: ReportFormulaParams,
  smooth: (series: FormulaSeries, params: ReportFormulaParams) => FormulaResult
): FormulaResult => {
  const acute = num(params, 'acute', 7)
  const chronic = num(params, 'chronic', 28)
  const minPoints = num(params, 'minPoints', 4)
  return rollingAcwr(
    smooth(series, { n: acute, minPoints }).series,
    smooth(series, { n: chronic, minPoints }).series,
    series,
    {
      acute,
      uncoupled: bool(params, 'uncoupled', false),
      minDenomRatio: num(params, 'minDenomRatio', 0.1),
    }
  )
}

const applyMonotony = (series: FormulaSeries, params: ReportFormulaParams = {}): FormulaResult =>
  mapWindow(series, params, 7, (values) => {
    const mean = meanOf(values)
    const sd = sdOf(values)
    if (!finite(mean) || !finite(sd) || sd === 0) return null
    return mean / sd
  })

const applyStrain = (series: FormulaSeries, params: ReportFormulaParams = {}): FormulaResult => {
  const { n, minPoints } = windowParams(params, 7)
  const monotony = applyMonotony(series, { n, minPoints }).series
  return seriesResult(
    series.map((_, index) => {
      const values = valuesOf(windowSlice(series, index, n))
      const mono = monotony[index]
      if (values.length < minPoints || !finite(mono)) return null
      return round(values.reduce((sum, value) => sum + value, 0) * mono)
    })
  )
}

const mapVsBaseline = (
  series: FormulaSeries,
  params: ReportFormulaParams,
  map: (value: number, mean: number, sd: number | null) => number | null
): FormulaResult => {
  const { n, minPoints } = windowParams(params, 28)
  return seriesResult(
    series.map((value, index) => {
      if (!finite(value)) return null
      const baseline = valuesOf(windowSlice(series, index, n))
      if (baseline.length < minPoints) return null
      const mean = meanOf(baseline)
      if (!finite(mean)) return null
      const mapped = map(value, mean, sdOf(baseline))
      return mapped === null ? null : round(mapped)
    })
  )
}

const reduce = (
  id: ReportFormulaId,
  useWhen: string,
  compute: (values: number[]) => number | null
): FormulaDef => ({
  id,
  kind: 'reduce',
  defaults: {},
  params: [],
  useWhen,
  group: 'stats',
  apply: (series) => reduceResult(series, compute(valuesOf(series))),
})

const rolling = (
  id: ReportFormulaId,
  defaults: ReportFormulaParams,
  params: string[],
  useWhen: string,
  apply: FormulaDef['apply'],
  titleSuffix?: FormulaDef['titleSuffix']
): FormulaDef => ({
  id,
  kind: 'series',
  defaults,
  params,
  useWhen,
  group: 'rolling',
  apply,
  titleSuffix,
})

const load = (
  id: ReportFormulaId,
  defaults: ReportFormulaParams,
  params: string[],
  useWhen: string,
  apply: FormulaDef['apply'],
  titleSuffix?: FormulaDef['titleSuffix']
): FormulaDef => ({
  id,
  kind: 'series',
  defaults,
  params,
  useWhen,
  group: 'load',
  apply,
  titleSuffix,
})

const baseline = (
  id: ReportFormulaId,
  defaults: ReportFormulaParams,
  useWhen: string,
  apply: FormulaDef['apply'],
  titleSuffix: (params: ReportFormulaParams) => string
): FormulaDef => ({
  id,
  kind: 'series',
  defaults,
  params: ['n'],
  useWhen,
  group: 'baseline',
  apply,
  titleSuffix,
})

const windowDefaults = { n: 7, minPoints: 4 }
const acwrDefaults = { acute: 7, chronic: 28, uncoupled: false, minDenomRatio: 0.1 }
const baselineDefaults = { n: 28, minPoints: 4 }

export const REPORT_FORMULAS: Record<ReportFormulaId, FormulaDef> = {
  [REPORT_FORMULA_ID.MEAN]: reduce(
    REPORT_FORMULA_ID.MEAN,
    'KPI / pie: average over the bloc period',
    meanOf
  ),
  [REPORT_FORMULA_ID.MEDIAN]: reduce(
    REPORT_FORMULA_ID.MEDIAN,
    'KPI robust to outliers (GPS spikes)',
    medianOf
  ),
  [REPORT_FORMULA_ID.MIN]: reduce(
    REPORT_FORMULA_ID.MIN,
    'Lowest value in period',
    (values) => (values.length ? Math.min(...values) : null)
  ),
  [REPORT_FORMULA_ID.MAX]: reduce(
    REPORT_FORMULA_ID.MAX,
    'Peak value in period',
    (values) => (values.length ? Math.max(...values) : null)
  ),
  [REPORT_FORMULA_ID.SUM]: reduce(
    REPORT_FORMULA_ID.SUM,
    'Total load / volume over period (KPI)',
    (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) : null)
  ),
  [REPORT_FORMULA_ID.SD]: reduce(
    REPORT_FORMULA_ID.SD,
    'Variability / stability KPI',
    sdOf
  ),
  [REPORT_FORMULA_ID.CV]: reduce(
    REPORT_FORMULA_ID.CV,
    'Wellness / CMJ stability (%); prefer over raw sd when scales differ',
    (values) => {
      const mean = meanOf(values)
      const sd = sdOf(values)
      if (!finite(mean) || !finite(sd) || mean === 0) return null
      return (sd / mean) * 100
    }
  ),
  [REPORT_FORMULA_ID.P25]: reduce(
    REPORT_FORMULA_ID.P25,
    'Lower quartile KPI',
    (values) => percentileOf(values, 25)
  ),
  [REPORT_FORMULA_ID.P75]: reduce(
    REPORT_FORMULA_ID.P75,
    'Upper quartile KPI',
    (values) => percentileOf(values, 75)
  ),
  [REPORT_FORMULA_ID.P90]: reduce(
    REPORT_FORMULA_ID.P90,
    'High-end exposure KPI',
    (values) => percentileOf(values, 90)
  ),
  [REPORT_FORMULA_ID.P95]: reduce(
    REPORT_FORMULA_ID.P95,
    'Near-max exposure KPI',
    (values) => percentileOf(values, 95)
  ),
  [REPORT_FORMULA_ID.MA]: rolling(
    REPORT_FORMULA_ID.MA,
    windowDefaults,
    ['n'],
    'Line/bar smoothing only when needed; choose n from 7/14/28 — do not default every chart to n=7',
    applyMovingAverage,
    (params) => ` · MA${params.n}`
  ),
  [REPORT_FORMULA_ID.MEDIAN_MA]: rolling(
    REPORT_FORMULA_ID.MEDIAN_MA,
    windowDefaults,
    ['n'],
    'Robust GPS smoothing when outliers matter (prefer over ma)',
    applyMedianMovingAverage,
    (params) => ` · MedMA${params.n}`
  ),
  [REPORT_FORMULA_ID.EWMA]: rolling(
    REPORT_FORMULA_ID.EWMA,
    { n: 7 },
    ['n'],
    'Preferred load trend (n=7 acute / n=28 chronic); prefer over ma',
    applyEwma,
    (params) => ` · EWMA${params.n}`
  ),
  [REPORT_FORMULA_ID.CUMULATIVE]: rolling(
    REPORT_FORMULA_ID.CUMULATIVE,
    {},
    [],
    'Month/season cumulative load or volume (prefer over ma for totals)',
    (series) => applyCumulative(series),
    () => ' · Cumulative'
  ),
  [REPORT_FORMULA_ID.ACWR_MA]: load(
    REPORT_FORMULA_ID.ACWR_MA,
    acwrDefaults,
    ['acute', 'chronic', 'uncoupled'],
    'Training-load spike risk (MA variant)',
    (series, params) => applyAcwr(series, params, applyMovingAverage),
    (params) => (params.uncoupled ? ' · ACWR MA (uncoupled)' : ' · ACWR MA')
  ),
  [REPORT_FORMULA_ID.ACWR_EWMA]: load(
    REPORT_FORMULA_ID.ACWR_EWMA,
    acwrDefaults,
    ['acute', 'chronic', 'uncoupled'],
    'Default ACWR request / acute:chronic ratio',
    (series, params) => applyAcwr(series, params, applyEwma),
    (params) => (params.uncoupled ? ' · ACWR EWMA (uncoupled)' : ' · ACWR EWMA')
  ),
  [REPORT_FORMULA_ID.MONOTONY]: load(
    REPORT_FORMULA_ID.MONOTONY,
    windowDefaults,
    ['n'],
    'Training monotony (Foster) from daily load',
    applyMonotony,
    (params) => ` · Monotony${params.n}`
  ),
  [REPORT_FORMULA_ID.STRAIN]: load(
    REPORT_FORMULA_ID.STRAIN,
    windowDefaults,
    ['n'],
    'Training strain (Foster) with monotony',
    applyStrain,
    (params) => ` · Strain${params.n}`
  ),
  [REPORT_FORMULA_ID.ZSCORE]: baseline(
    REPORT_FORMULA_ID.ZSCORE,
    { ...baselineDefaults, minSd: 1e-6 },
    'Player vs himself (individualization)',
    (series, params) =>
      mapVsBaseline(series, params, (value, mean, sd) => {
        if (!finite(sd)) return null
        return (value - mean) / Math.max(sd, num(params, 'minSd', 1e-6))
      }),
    (params) => ` · Z${params.n}`
  ),
  [REPORT_FORMULA_ID.PCT_BASELINE]: baseline(
    REPORT_FORMULA_ID.PCT_BASELINE,
    baselineDefaults,
    'Express daily value vs baseline %',
    (series, params) =>
      mapVsBaseline(series, params, (value, mean) => (mean === 0 ? null : (value / mean) * 100)),
    (params) => ` · %base${params.n}`
  ),
  [REPORT_FORMULA_ID.DELTA_PCT]: baseline(
    REPORT_FORMULA_ID.DELTA_PCT,
    baselineDefaults,
    'Change vs baseline % (CMJ, force)',
    (series, params) =>
      mapVsBaseline(series, params, (value, mean) =>
        mean === 0 ? null : ((value - mean) / mean) * 100
      ),
    (params) => ` · Δ%${params.n}`
  ),
}
