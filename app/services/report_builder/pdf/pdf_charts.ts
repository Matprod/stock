import type { AppLanguage } from '#utils/localize'
import type { FrontendChart } from '#utils/chart'
import { formatChartAxisLabel } from '#services/report_builder/pdf/pdf_copy'
import {
  colorForIndex,
  fitPdfText,
  PDF_THEME,
  type PdfRect,
} from '#services/report_builder/pdf/pdf_theme'

type NumericScale = {
  min: number
  max: number
  integer: boolean
}

type DoughnutSlice = {
  label: string
  value: number
  color: string
}

const PLOT_PAD_LEFT = 36
const PLOT_PAD_RIGHT = 36
const PLOT_PAD_TOP = 8
const PLOT_PAD_BOTTOM = 22
const LEGEND_ROW = 14
const TICK_COUNT = 4

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isIntegerSeries = (values: number[]): boolean =>
  values.length > 0 && values.every((value) => Number.isInteger(value))

const niceScale = (values: number[]): NumericScale => {
  if (values.length === 0) return { min: 0, max: 1, integer: true }
  const integer = isIntegerSeries(values)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  if (integer) {
    const min = rawMin >= 0 ? 0 : Math.floor(rawMin)
    const max = Math.max(Math.ceil(rawMax), min + 1)
    return { min, max, integer: true }
  }

  if (rawMin === rawMax) {
    const delta = Math.abs(rawMin) * 0.1 || 1
    return { min: rawMin - delta, max: rawMax + delta, integer: false }
  }
  const pad = (rawMax - rawMin) * 0.08
  let min = rawMin - pad
  const max = rawMax + pad
  if (rawMin >= 0 && min < 0) min = 0
  return { min, max, integer: false }
}

const scaleTicks = (scale: NumericScale): number[] => {
  if (scale.integer) {
    const span = scale.max - scale.min
    const step = Math.max(1, Math.ceil(span / TICK_COUNT))
    const ticks: number[] = []
    for (let value = scale.min; value <= scale.max; value += step) ticks.push(value)
    if (ticks.at(-1) !== scale.max) ticks.push(scale.max)
    return ticks
  }
  return Array.from(
    { length: TICK_COUNT + 1 },
    (_, index) => scale.min + ((scale.max - scale.min) * index) / TICK_COUNT
  )
}

const toPlotY = (value: number, scale: NumericScale, plot: PdfRect): number => {
  const span = scale.max - scale.min || 1
  const t = (value - scale.min) / span
  return plot.y + plot.height - t * plot.height
}

const toPlotX = (index: number, count: number, plot: PdfRect): number => {
  if (count <= 1) return plot.x + plot.width / 2
  return plot.x + (index / (count - 1)) * plot.width
}

const formatTick = (value: number, integer: boolean): string => {
  if (integer) return String(Math.round(value))
  const abs = Math.abs(value)
  if (abs >= 1000) return value.toLocaleString('en', { maximumFractionDigits: 0 })
  if (Number.isInteger(value)) return String(value)
  return value.toLocaleString('en', { maximumFractionDigits: 1 })
}

const collectValues = (chart: FrontendChart, axisId: string | null): number[] => {
  const datasets =
    axisId === null
      ? chart.datasets
      : chart.datasets.filter((dataset) => (dataset.yAxisID ?? chart.yAxes?.[0]?.id) === axisId)
  return datasets.flatMap((dataset) => dataset.data.filter(isFiniteNumber))
}

const axisScale = (chart: FrontendChart, axisId: string | null): NumericScale =>
  niceScale(collectValues(chart, axisId))

const legendEntries = (chart: FrontendChart): Array<{ label: string; color: string }> => {
  if (chart.type === 'doughnut') {
    return doughnutSlices(chart).map((slice) => ({ label: slice.label, color: slice.color }))
  }
  return chart.datasets.map((dataset, index) => ({
    label: dataset.label,
    color: dataset.color ?? colorForIndex(index),
  }))
}

const polar = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
})

const appendArc = (
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number
) => {
  const sweep = end - start
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)))
  for (let i = 0; i < steps; i++) {
    const a0 = start + (sweep * i) / steps
    const a1 = start + (sweep * (i + 1)) / steps
    const delta = a1 - a0
    const k = (4 / 3) * Math.tan(delta / 4)
    const p0 = polar(cx, cy, radius, a0)
    const p1 = polar(cx, cy, radius, a1)
    doc.bezierCurveTo(
      p0.x - k * radius * Math.sin(a0),
      p0.y + k * radius * Math.cos(a0),
      p1.x + k * radius * Math.sin(a1),
      p1.y - k * radius * Math.cos(a1),
      p1.x,
      p1.y
    )
  }
}

const drawPieSlice = (
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  radius: number,
  start: number,
  sweep: number,
  color: string
) => {
  const startPoint = polar(cx, cy, radius, start)
  doc.save()
  doc.moveTo(cx, cy)
  doc.lineTo(startPoint.x, startPoint.y)
  appendArc(doc, cx, cy, radius, start, start + sweep)
  doc.closePath()
  doc.fillColor(color).fill()
  doc.restore()
}

const doughnutSlices = (chart: FrontendChart): DoughnutSlice[] => {
  if (chart.datasets.length <= 1) {
    const dataset = chart.datasets[0]
    if (!dataset) return []
    return chart.labels.flatMap((label, index) => {
      const value = dataset.data[index]
      if (!isFiniteNumber(value) || value <= 0) return []
      return [{ label, value, color: colorForIndex(index) }]
    })
  }

  return chart.datasets.flatMap((dataset, index) => {
    const value = dataset.data.find(isFiniteNumber)
    if (!isFiniteNumber(value) || value <= 0) return []
    return [
      {
        label: dataset.label,
        value,
        color: dataset.color ?? colorForIndex(index),
      },
    ]
  })
}

const drawLegend = (
  doc: PDFKit.PDFDocument,
  entries: Array<{ label: string; color: string }>,
  rect: PdfRect
): number => {
  if (entries.length === 0) return 0
  doc.font('Helvetica').fontSize(8)
  let x = rect.x
  let y = rect.y
  let rows = 1
  const maxX = rect.x + rect.width

  for (const entry of entries) {
    const label = fitPdfText(doc, entry.label, Math.min(140, rect.width - 14))
    const width = 10 + doc.widthOfString(label) + 12
    if (x + width > maxX && x > rect.x) {
      x = rect.x
      y += LEGEND_ROW
      rows += 1
    }
    doc
      .rect(x, y + 2, 7, 7)
      .fillColor(entry.color)
      .fill()
    doc.fillColor(PDF_THEME.muted).text(label, x + 10, y, { lineBreak: false })
    x += width
  }

  return rows * LEGEND_ROW
}

const drawEmpty = (doc: PDFKit.PDFDocument, rect: PdfRect, noData: string) => {
  doc.roundedRect(rect.x, rect.y, rect.width, rect.height, 4).fillColor(PDF_THEME.card).fill()
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(PDF_THEME.muted)
    .text(noData, rect.x, rect.y + rect.height / 2 - 6, {
      width: rect.width,
      align: 'center',
    })
}

const drawGrid = (doc: PDFKit.PDFDocument, plot: PdfRect, scale: NumericScale) => {
  doc.font('Helvetica').fontSize(7)
  for (const value of scaleTicks(scale)) {
    const y = toPlotY(value, scale, plot)
    doc
      .moveTo(plot.x, y)
      .lineTo(plot.x + plot.width, y)
      .strokeColor(PDF_THEME.grid)
      .lineWidth(0.5)
      .stroke()
    doc
      .fillColor(PDF_THEME.muted)
      .text(formatTick(value, scale.integer), plot.x - PLOT_PAD_LEFT + 2, y - 4, {
        width: PLOT_PAD_LEFT - 6,
        align: 'right',
        lineBreak: false,
      })
  }
  doc
    .moveTo(plot.x, plot.y)
    .lineTo(plot.x, plot.y + plot.height)
    .lineTo(plot.x + plot.width, plot.y + plot.height)
    .strokeColor(PDF_THEME.line)
    .lineWidth(0.8)
    .stroke()
}

const drawRightAxis = (
  doc: PDFKit.PDFDocument,
  plot: PdfRect,
  scale: NumericScale,
  label: string | undefined
) => {
  doc.font('Helvetica').fontSize(7)
  for (const value of scaleTicks(scale)) {
    const y = toPlotY(value, scale, plot)
    doc
      .fillColor(PDF_THEME.muted)
      .text(formatTick(value, scale.integer), plot.x + plot.width + 4, y - 4, {
        width: PLOT_PAD_RIGHT - 6,
        lineBreak: false,
      })
  }
  if (label) {
    doc
      .fillColor(PDF_THEME.muted)
      .text(fitPdfText(doc, label, PLOT_PAD_RIGHT - 4), plot.x + plot.width + 4, plot.y - 10, {
        width: PLOT_PAD_RIGHT - 4,
        lineBreak: false,
      })
  }
}

const drawXLabels = (
  doc: PDFKit.PDFDocument,
  labels: string[],
  plot: PdfRect,
  language: AppLanguage
) => {
  if (labels.length === 0) return
  const maxLabels = Math.min(labels.length, 8)
  const step = Math.max(1, Math.ceil(labels.length / maxLabels))
  doc.font('Helvetica').fontSize(7).fillColor(PDF_THEME.muted)
  for (let i = 0; i < labels.length; i += step) {
    const text = formatChartAxisLabel(labels[i], language)
    const x = toPlotX(i, labels.length, plot)
    const width = 48
    doc.text(fitPdfText(doc, text, width), x - width / 2, plot.y + plot.height + 4, {
      width,
      align: 'center',
      lineBreak: false,
    })
  }
}

const datasetScale = (
  chart: FrontendChart,
  dataset: FrontendChart['datasets'][number]
): NumericScale => {
  const axisId = chart.yAxes?.length ? (dataset.yAxisID ?? chart.yAxes[0].id) : null
  return axisScale(chart, axisId)
}

const drawLineSeries = (doc: PDFKit.PDFDocument, chart: FrontendChart, plot: PdfRect) => {
  const count = chart.labels.length
  chart.datasets.forEach((dataset, datasetIndex) => {
    const scale = datasetScale(chart, dataset)
    const color = dataset.color ?? colorForIndex(datasetIndex)
    const segments: Array<Array<{ x: number; y: number }>> = []
    let current: Array<{ x: number; y: number }> = []

    dataset.data.forEach((value, index) => {
      if (!isFiniteNumber(value)) {
        if (current.length > 0) segments.push(current)
        current = []
        return
      }
      current.push({ x: toPlotX(index, count, plot), y: toPlotY(value, scale, plot) })
    })
    if (current.length > 0) segments.push(current)

    for (const segment of segments) {
      if (segment.length === 1) {
        doc.circle(segment[0].x, segment[0].y, 1.6).fillColor(color).fill()
        continue
      }
      doc.moveTo(segment[0].x, segment[0].y)
      for (let i = 1; i < segment.length; i++) {
        doc.lineTo(segment[i].x, segment[i].y)
      }
      doc.strokeColor(color).lineWidth(1.6)
      if (dataset.borderDash?.length) {
        doc.dash(dataset.borderDash[0] ?? 6, { space: dataset.borderDash[1] ?? 4 })
      }
      doc.stroke()
      if (dataset.borderDash?.length) doc.undash()
    }
  })
}

const drawBarSeries = (doc: PDFKit.PDFDocument, chart: FrontendChart, plot: PdfRect) => {
  const groupCount = Math.max(chart.labels.length, 1)
  const seriesCount = Math.max(chart.datasets.length, 1)
  const groupWidth = plot.width / groupCount
  const barWidth = Math.max(2, (groupWidth * 0.72) / seriesCount)
  const groupPad = (groupWidth - barWidth * seriesCount) / 2

  chart.datasets.forEach((dataset, datasetIndex) => {
    const scale = datasetScale(chart, dataset)
    const color = dataset.color ?? colorForIndex(datasetIndex)
    dataset.data.forEach((value, index) => {
      if (!isFiniteNumber(value)) return
      const x = plot.x + index * groupWidth + groupPad + datasetIndex * barWidth
      const y = toPlotY(value, scale, plot)
      const zeroY = toPlotY(Math.max(scale.min, 0), scale, plot)
      const top = Math.min(y, zeroY)
      const height = Math.max(0.8, Math.abs(zeroY - y))
      doc
        .rect(x, top, barWidth - 1, height)
        .fillColor(color)
        .fill()
    })
  })
}

const drawDoughnut = (
  doc: PDFKit.PDFDocument,
  chart: FrontendChart,
  rect: PdfRect,
  noData: string
) => {
  const slices = doughnutSlices(chart)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (slices.length === 0 || total <= 0) {
    drawEmpty(doc, rect, noData)
    return
  }

  const legendWidth = Math.min(160, rect.width * 0.38)
  const chartBox = {
    x: rect.x,
    y: rect.y,
    width: rect.width - legendWidth - 8,
    height: rect.height,
  }
  const radius = Math.min(chartBox.width, chartBox.height) / 2 - 8
  const cx = chartBox.x + chartBox.width / 2
  const cy = chartBox.y + chartBox.height / 2

  if (slices.length === 1) {
    const only = slices[0]
    if (only) doc.circle(cx, cy, radius).fillColor(only.color).fill()
  } else {
    let angle = -Math.PI / 2
    for (const slice of slices) {
      const sweep = (slice.value / total) * Math.PI * 2
      drawPieSlice(doc, cx, cy, radius, angle, sweep, slice.color)
      angle += sweep
    }
  }

  doc
    .circle(cx, cy, radius * 0.55)
    .fillColor(PDF_THEME.page)
    .fill()

  const legendRect: PdfRect = {
    x: rect.x + rect.width - legendWidth,
    y: rect.y + 8,
    width: legendWidth,
    height: rect.height - 8,
  }
  drawLegend(
    doc,
    slices.map((slice) => ({
      label: `${slice.label}  ${formatTick(slice.value, Number.isInteger(slice.value))}`,
      color: slice.color,
    })),
    legendRect
  )
}

const hasRenderableData = (chart: FrontendChart): boolean => {
  if (chart.type === 'doughnut') return doughnutSlices(chart).length > 0
  return chart.datasets.some((dataset) => dataset.data.some(isFiniteNumber))
}

export const drawChart = (
  doc: PDFKit.PDFDocument,
  chart: FrontendChart,
  rect: PdfRect,
  noData: string,
  language: AppLanguage
) => {
  if (chart.type !== 'line' && chart.type !== 'bar' && chart.type !== 'doughnut') {
    drawEmpty(doc, rect, noData)
    return
  }
  if (!hasRenderableData(chart)) {
    drawEmpty(doc, rect, noData)
    return
  }
  if (chart.type === 'doughnut') {
    drawDoughnut(doc, chart, rect, noData)
    return
  }

  const entries = legendEntries(chart)
  const showLegend = entries.length > 1
  const legendHeight = showLegend
    ? drawLegend(doc, entries, { x: rect.x, y: rect.y, width: rect.width, height: LEGEND_ROW * 3 })
    : 0

  const plot: PdfRect = {
    x: rect.x + PLOT_PAD_LEFT,
    y: rect.y + legendHeight + PLOT_PAD_TOP,
    width: rect.width - PLOT_PAD_LEFT - PLOT_PAD_RIGHT,
    height: rect.height - legendHeight - PLOT_PAD_TOP - PLOT_PAD_BOTTOM,
  }
  if (plot.width < 40 || plot.height < 40) {
    drawEmpty(doc, rect, noData)
    return
  }

  const leftAxisId = chart.yAxes?.[0]?.id ?? null
  const leftScale = axisScale(chart, leftAxisId)
  drawGrid(doc, plot, leftScale)

  const rightAxis = chart.yAxes?.[1]
  if (rightAxis) {
    drawRightAxis(doc, plot, axisScale(chart, rightAxis.id), rightAxis.label)
  }

  if (chart.type === 'bar') drawBarSeries(doc, chart, plot)
  else drawLineSeries(doc, chart, plot)

  drawXLabels(doc, chart.labels, plot, language)
}
