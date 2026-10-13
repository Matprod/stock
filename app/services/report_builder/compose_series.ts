import {
  REPORT_BINARY_SERIES_OPS,
  REPORT_SERIES_OP,
  type ReportBinarySeriesOp,
  type ReportSeriesOp,
} from '#constants/report_builder.constants'
import type { ReportBlocSpec, ReportData, ReportSeriesSpec } from '#contracts/report_builder'
import { applyFormula, formulaTitleSuffix } from '#services/report_builder/formulas'
import { getMeta, getSeries, getTotal } from '#services/report_builder/load_report_data'
import { convertSeriesValues, unitConversionFactor } from '#services/report_builder/report_units'

export const resolveBlocSeries = (bloc: ReportBlocSpec): ReportSeriesSpec[] => {
  if (bloc.series?.length) return bloc.series
  return (bloc.variables ?? []).map((key) => ({
    id: key,
    op: REPORT_SERIES_OP.IDENTITY,
    variables: [key],
  }))
}

export const seriesTitle = (data: ReportData, spec: ReportSeriesSpec): string => {
  const names = spec.variables.map((key) => getMeta(data, key)?.name ?? key)
  const autoBase =
    spec.op === REPORT_SERIES_OP.IDENTITY || !spec.op
      ? (names[0] ?? spec.id)
      : names.join(combineOpLabel(spec.op))
  const custom = spec.label?.trim()
  if (custom) return custom
  return spec.formula ? `${autoBase}${formulaTitleSuffix(spec.formula)}` : autoBase
}

export const getSeriesUnit = (data: ReportData, spec: ReportSeriesSpec): string | null =>
  spec.convert ?? getMeta(data, spec.variables[0])?.unit ?? null

const sourceUnit = (data: ReportData, spec: ReportSeriesSpec): string | null =>
  getMeta(data, spec.variables[0])?.unit ?? null

const applyConvert = (
  data: ReportData,
  spec: ReportSeriesSpec,
  series: Array<number | null>
): Array<number | null> => {
  if (!spec.convert) return series
  const factor = unitConversionFactor(sourceUnit(data, spec), spec.convert)
  if (factor === null || factor === 1) return series
  return convertSeriesValues(series, factor)
}

export const getComposedSeries = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds?: string[]
): Array<number | null> => {
  const combined = applyConvert(data, spec, combineSources(data, spec, athleteIds))
  if (!spec.formula) return combined
  return applyFormula(combined, spec.formula).series
}

export const getComposedTotal = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds?: string[]
): number | null => {
  if (!spec.formula) {
    const op = spec.op ?? REPORT_SERIES_OP.IDENTITY
    if (op === REPORT_SERIES_OP.IDENTITY || spec.variables.length === 1) {
      return convertScalar(data, spec, getTotal(data, spec.variables[0], athleteIds))
    }
    return sumNullable(applyConvert(data, spec, combineSources(data, spec, athleteIds)))
  }

  const combined = applyConvert(data, spec, combineSources(data, spec, athleteIds))
  return applyFormula(combined, spec.formula).scalar ?? null
}

const convertScalar = (
  data: ReportData,
  spec: ReportSeriesSpec,
  value: number | null
): number | null => {
  if (value === null || !spec.convert) return value
  const factor = unitConversionFactor(sourceUnit(data, spec), spec.convert)
  if (factor === null || factor === 1) return value
  return Math.round(value * factor * 1000) / 1000
}

const roundMetricValue = (value: number): number => Math.round(value * 100) / 100

const sumNullable = (values: Array<number | null>): number | null => {
  let sum = 0
  let hasValue = false
  for (const value of values) {
    if (value === null) continue
    sum += value
    hasValue = true
  }
  return hasValue ? roundMetricValue(sum) : null
}

const binaryNullable = (
  left: number | null,
  right: number | null,
  op: ReportBinarySeriesOp
): number | null => {
  if (left === null || right === null) return null
  if (op === REPORT_SERIES_OP.SUB) return roundMetricValue(left - right)
  if (op === REPORT_SERIES_OP.MUL) return roundMetricValue(left * right)
  if (right === 0) return null
  return roundMetricValue(left / right)
}

const isBinaryOp = (op: ReportSeriesOp | undefined): op is ReportBinarySeriesOp =>
  REPORT_BINARY_SERIES_OPS.includes(op as ReportBinarySeriesOp)

const combineOpLabel = (op: ReportSeriesOp | undefined): string => {
  if (op === REPORT_SERIES_OP.SUM) return ' + '
  if (op === REPORT_SERIES_OP.SUB) return ' - '
  if (op === REPORT_SERIES_OP.MUL) return ' × '
  if (op === REPORT_SERIES_OP.DIV) return ' ÷ '
  return ' + '
}

const combineSources = (
  data: ReportData,
  spec: ReportSeriesSpec,
  athleteIds?: string[]
): Array<number | null> => {
  const op = spec.op ?? REPORT_SERIES_OP.IDENTITY

  if (op === REPORT_SERIES_OP.IDENTITY || spec.variables.length === 1) {
    return getSeries(data, spec.variables[0], athleteIds)
  }

  if (op === REPORT_SERIES_OP.SUM) {
    const components = spec.variables.map((key) => getSeries(data, key, athleteIds))
    return data.dates.map((_, index) =>
      sumNullable(components.map((series) => series[index] ?? null))
    )
  }

  if (isBinaryOp(op) && spec.variables.length >= 2) {
    const left = getSeries(data, spec.variables[0], athleteIds)
    const right = getSeries(data, spec.variables[1], athleteIds)
    return data.dates.map((_, index) =>
      binaryNullable(left[index] ?? null, right[index] ?? null, op)
    )
  }

  return getSeries(data, spec.variables[0], athleteIds)
}
