import {
  acwrChart,
  columnsLine,
  deviation,
  dotStrip,
  hbars,
  lineChart,
  linesBand,
  perfClass,
  radar,
  riskClass,
  scatter,
  smallMultiples,
  sparkline,
  stacked,
  timeline,
} from '#services/report_v4/chart_svg/charts'
import { mean, stampChart } from '#services/report_v4/chart_svg/format'
import { matrixHeatmap } from '#services/report_v4/chart_svg/matrix'
import {
  CHART_SVG_TYPE,
  type ChartSvgRequest,
  type ChartSvgResult,
  type ChartSvgType,
  type MatrixInput,
} from '#services/report_v4/chart_svg/types'

export {
  acwrChart,
  columnsLine,
  deviation,
  dotStrip,
  hbars,
  lineChart,
  matrixHeatmap,
  mean,
  perfClass,
  riskClass,
  scatter,
  smallMultiples,
  sparkline,
  stacked,
  timeline,
  radar,
  linesBand,
  CHART_SVG_TYPE,
}

export type { ChartSvgRequest, ChartSvgResult, ChartSvgType }

const merge = (dataset?: Record<string, unknown>, options?: Record<string, unknown>) => ({
  ...(dataset ?? {}),
  ...(options ?? {}),
})

const asNumberArray = (v: unknown): number[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : null

export const renderChartSvg = ({
  type,
  datasetId,
  dataset,
  options,
}: ChartSvgRequest): ChartSvgResult => {
  if (!datasetId) return { svg: '', error: 'datasetId is required' }
  if (!type) return { svg: '', error: 'type is required' }

  try {
    const input = merge(dataset, options)
    let markup = ''

    switch (type) {
      case CHART_SVG_TYPE.SPARKLINE: {
        const values = asNumberArray(input.values) ?? asNumberArray(dataset?.values)
        if (!values?.length) return { svg: '', error: 'sparkline requires values' }
        const rest = { ...input }
        delete rest.values
        markup = sparkline(values, rest as Parameters<typeof sparkline>[1])
        break
      }
      case CHART_SVG_TYPE.LINES: {
        markup = lineChart(input as Parameters<typeof lineChart>[0])
        break
      }
      case CHART_SVG_TYPE.SORTED_BARS: {
        markup = hbars(input as Parameters<typeof hbars>[0])
        break
      }
      case CHART_SVG_TYPE.GAP_TO_REFERENCE: {
        markup = deviation(input as Parameters<typeof deviation>[0])
        break
      }
      case CHART_SVG_TYPE.SMALL_MULTIPLES: {
        markup = smallMultiples(input as Parameters<typeof smallMultiples>[0])
        break
      }
      case CHART_SVG_TYPE.SCATTER: {
        markup = scatter(input as Parameters<typeof scatter>[0])
        break
      }
      case CHART_SVG_TYPE.ACWR: {
        markup = acwrChart(input as Parameters<typeof acwrChart>[0])
        break
      }
      case CHART_SVG_TYPE.COLUMNS_LINE: {
        markup = columnsLine(input as Parameters<typeof columnsLine>[0])
        break
      }
      case CHART_SVG_TYPE.STACKED_COLUMNS: {
        markup = stacked(input as Parameters<typeof stacked>[0])
        break
      }
      case CHART_SVG_TYPE.TIMELINE: {
        markup = timeline(input as Parameters<typeof timeline>[0])
        break
      }
      case CHART_SVG_TYPE.DISTRIBUTION: {
        markup = dotStrip(input as Parameters<typeof dotStrip>[0])
        break
      }
      case CHART_SVG_TYPE.MATRIX: {
        markup = matrixHeatmap(input as MatrixInput)
        break
      }
      case CHART_SVG_TYPE.RADAR: {
        markup = radar(input as Parameters<typeof radar>[0])
        break
      }
      case CHART_SVG_TYPE.LINES_BAND: {
        markup = linesBand(input as Parameters<typeof linesBand>[0])
        break
      }
      default:
        return { svg: '', error: `unknown chart type: ${type}` }
    }

    if (!markup) return { svg: '', error: 'empty chart output' }
    return { svg: stampChart(markup, datasetId, type) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'chart render failed'
    return { svg: '', error: message }
  }
}
