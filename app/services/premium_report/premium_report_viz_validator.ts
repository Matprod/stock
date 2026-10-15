const LINE_DATE_RE = /date|jour|day/i
const DERIVED_METRIC_RE = /ewma_|monotony|strain|acwr/i
const RAW_METRIC_RE =
  /performance_score|injury_risk|soreness|distance|rpe|duration|load|body_|gps|hr_|heart/i

type VizValidationResult = {
  isValid: boolean
  reason?: string
  suggestion?: string
}

type VizGateArgs = {
  toolName: 'add_chart' | 'add_table' | 'correlate'
  title?: string
  datasetColumns: string[]
  datasetRowCount: number
  mode?: 'matrix' | 'pair'
  chartType?: string
  uniqueCategories?: number
}

const ok = (): VizValidationResult => ({ isValid: true })
const reject = (reason: string, suggestion: string): VizValidationResult => ({
  isValid: false,
  reason,
  suggestion,
})

const onlyDerivedMetrics = (columns: string[]): boolean => {
  const metrics = columns.filter((c) => !LINE_DATE_RE.test(c) && !/^id$|player|athlete|name/i.test(c))
  return (
    metrics.length > 0 &&
    metrics.every((c) => DERIVED_METRIC_RE.test(c)) &&
    !metrics.some((c) => RAW_METRIC_RE.test(c))
  )
}

const validateVisualizationIdea = (args: VizGateArgs): VizValidationResult => {
  if (args.chartType === 'scatter' || args.chartType === 'heatmap') return ok()

  if (args.chartType === 'line' && !args.datasetColumns.some((col) => LINE_DATE_RE.test(col))) {
    return reject(
      'Line charts require a date/time column',
      'Use bar for rankings or scatter for relationships'
    )
  }

  const barLike =
    args.chartType === 'bar' ||
    args.chartType === 'bar-line' ||
    args.chartType === 'donut' ||
    args.chartType === 'radar'
  if (
    args.toolName === 'add_chart' &&
    barLike &&
    args.uniqueCategories != null &&
    args.uniqueCategories < 2
  ) {
    return reject(
      `Bar/ranking chart has ${args.uniqueCategories} category (need ≥2)`,
      'Use a category with ≥2 values, or use a table / line on a daily series'
    )
  }

  if (args.toolName === 'correlate' && args.mode === 'matrix' && args.datasetColumns.length > 6) {
    return reject(
      `Matrix with ${args.datasetColumns.length} vars (max 6)`,
      'Select 3-5 metrics or use mode=pair'
    )
  }

  if (args.toolName === 'correlate' && onlyDerivedMetrics(args.datasetColumns)) {
    return reject(
      'Derived-only correlations (ewma/strain/monotony/acwr) are not actionable',
      'Correlate raw metrics instead'
    )
  }

  return ok()
}

export const runVizGate = (
  state: { jevValidations: number; jevBlocked: number },
  args: VizGateArgs
): string | null => {
  state.jevValidations++
  const validation = validateVisualizationIdea(args)
  if (validation.isValid) return null
  state.jevBlocked++
  return JSON.stringify({
    error: validation.reason,
    suggestion: validation.suggestion,
    jevBlocked: true,
  })
}

export const chartDisplayRowCap = (chartType: string | undefined, columns: string[]): number => {
  const hasDate = columns.some((col) => LINE_DATE_RE.test(col))
  if (chartType === 'bar' || chartType === 'radar' || chartType === 'donut') return 20
  if (chartType === 'line' || chartType === 'bar-line' || (chartType === 'auto' && hasDate) || hasDate) {
    return 62
  }
  if (chartType === 'scatter') return 80
  return 25
}
