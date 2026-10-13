import type { IChartSpec } from '#contracts/chatbot'

export type FrontendChart = {
  type: IChartSpec['kind']
  title: string
  labels: string[]
  datasets: Array<{
    label: string
    data: (number | null)[]
    color?: string
    yAxisID?: string
    borderDash?: number[]
  }>
  yAxes?: IChartSpec['yAxes']
  serieType?: string
  sessionDate?: string
}

export type StoredChart = IChartSpec | FrontendChart

export const toFrontendCharts = (charts: IChartSpec[]): FrontendChart[] =>
  charts.map((spec) => ({
    type: spec.kind,
    title: spec.title,
    labels: spec.labels,
    datasets: spec.datasets.map((d) => ({
      label: d.label,
      data: d.data,
      color: d.borderColor ?? d.backgroundColor,
      yAxisID: d.yAxisID,
      ...(d.borderDash?.length ? { borderDash: d.borderDash } : {}),
    })),
    yAxes: spec.yAxes,
    serieType: spec.serieType,
    sessionDate: spec.sessionDate,
  }))

export const chartsFromStored = (
  raw: StoredChart | StoredChart[] | null | undefined
): FrontendChart[] => {
  if (!raw) return []
  const items = Array.isArray(raw) ? raw : [raw]
  return items.flatMap((item) => ('kind' in item ? toFrontendCharts([item]) : [item]))
}
