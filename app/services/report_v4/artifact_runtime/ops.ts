import type { PremiumReportDocument } from '#contracts/premium_report'
import { attachAbsoluteMarkLines } from '#services/premium_report/charts/echarts_options'
import { asEchartsOption } from '#services/premium_report/charts/echarts_types'
import {
  dropEmptyMetricDays,
  pickDateColumn,
  toNumber,
} from '#services/premium_report/dataset_ops'
import type {
  ArtifactContracts,
  ArtifactOpResult,
  ArtifactVizOp,
} from '#services/report_v4/artifact_runtime/types'

const chartTitleMentions = (title: string, hint?: string): boolean => {
  if (!hint) return true
  return new RegExp(hint, 'i').test(title)
}

const datasetFromOption = (
  option: Record<string, unknown>
): { columns: string[]; rows: Array<Record<string, unknown>> } | null => {
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return null
  const source = (dataset as { source?: unknown }).source
  if (!Array.isArray(source) || source.length < 2 || !Array.isArray(source[0])) return null
  const header = (source[0] as unknown[]).map((col) => String(col ?? ''))
  const rows = source.slice(1).map((row) => {
    const out: Record<string, unknown> = {}
    if (!Array.isArray(row)) return out
    for (let i = 0; i < header.length; i++) out[header[i]!] = row[i]
    return out
  })
  return { columns: header, rows }
}

const writeDatasetSource = (
  option: Record<string, unknown>,
  columns: string[],
  rows: Array<Record<string, unknown>>
): Record<string, unknown> => {
  const source = [columns, ...rows.map((row) => columns.map((col) => row[col] ?? null))]
  const prev =
    option.dataset && typeof option.dataset === 'object' && !Array.isArray(option.dataset)
      ? (option.dataset as Record<string, unknown>)
      : {}
  return { ...option, dataset: { ...prev, source } }
}

const swapAxisPair = (axis: unknown): unknown => {
  if (!axis || typeof axis !== 'object' || Array.isArray(axis)) return axis
  const raw = axis as Record<string, unknown>
  if (raw.type === 'category') return { ...raw, type: 'value' }
  if (raw.type === 'value' || raw.type == null) return { ...raw, type: 'category' }
  return axis
}

const swapEncodeAxes = (option: Record<string, unknown>): { option: Record<string, unknown>; changed: boolean } => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  let changed = false
  const series = seriesRaw.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
    const row = entry as Record<string, unknown>
    const encode =
      row.encode && typeof row.encode === 'object' && !Array.isArray(row.encode)
        ? (row.encode as Record<string, unknown>)
        : null
    if (!encode || (encode.x == null && encode.y == null)) return entry
    changed = true
    return {
      ...row,
      encode: {
        ...encode,
        x: encode.y,
        y: encode.x,
      },
    }
  })
  if (!changed) return { option, changed: false }
  return {
    option: {
      ...option,
      series,
      xAxis: swapAxisPair(option.xAxis),
      yAxis: swapAxisPair(option.yAxis),
    },
    changed: true,
  }
}

const applyVizOpToChartOption = (
  option: Record<string, unknown>,
  title: string,
  op: ArtifactVizOp
): { option: Record<string, unknown>; changed: boolean } => {
  if (op.kind === 'mark_lines') {
    if (op.metricHint && !chartTitleMentions(title, op.metricHint) && !/acwr/i.test(title)) {
      return { option, changed: false }
    }
    const next = attachAbsoluteMarkLines(asEchartsOption(option), op.values, 'yAxis')
    return { option: next as Record<string, unknown>, changed: true }
  }
  if (op.kind === 'drop_empty_days') {
    const parsed = datasetFromOption(option)
    if (!parsed) return { option, changed: false }
    const dateCol = pickDateColumn(parsed.columns)
    if (!dateCol) return { option, changed: false }
    const metricCols =
      op.columns?.filter((col) => parsed.columns.includes(col)) ??
      parsed.columns.filter(
        (col) => col !== dateCol && parsed.rows.some((row) => toNumber(row[col]) != null)
      )
    const dropped = dropEmptyMetricDays(
      { id: 'tmp', columns: parsed.columns, rows: parsed.rows },
      metricCols
    )
    if (dropped.dropped <= 0) return { option, changed: false }
    return {
      option: writeDatasetSource(option, dropped.dataset.columns, dropped.dataset.rows),
      changed: true,
    }
  }
  if (op.kind === 'strip_visualMap') {
    if (option.visualMap == null) return { option, changed: false }
    const { visualMap: _removed, ...rest } = option
    return { option: rest, changed: true }
  }
  if (op.kind === 'remap_encode') {
    if (op.mode !== 'swap_axes') return { option, changed: false }
    return swapEncodeAxes(option)
  }
  return { option, changed: false }
}

export const applyArtifactOpsToDocument = (
  document: PremiumReportDocument,
  contracts: ArtifactContracts
): { document: PremiumReportDocument } & ArtifactOpResult => {
  const ops = contracts.vizOps
  if (!ops.length) return { document, patched: 0, applied: [] }
  let patched = 0
  const applied: string[] = []
  const blocks = document.blocks.map((block) => {
    if (block.type !== 'chart' || !block.option || typeof block.option !== 'object') return block
    let option = { ...(block.option as Record<string, unknown>) }
    let changed = false
    for (const op of ops) {
      const next = applyVizOpToChartOption(option, String(block.title ?? ''), op)
      if (next.changed) {
        option = next.option
        changed = true
        if (!applied.includes(op.kind)) applied.push(op.kind)
      }
    }
    if (!changed) return block
    patched += 1
    return { ...block, option }
  })
  return {
    document: { ...document, blocks },
    patched,
    applied,
  }
}
