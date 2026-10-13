import { randomUUID } from 'node:crypto'
import {
  PREMIUM_BLOCK_TYPE,
  PREMIUM_REPORT_MAX_BLOCKS,
  PREMIUM_REPORT_MAX_CHARTS,
  PREMIUM_REPORT_MAX_DATASET_ROWS,
  PREMIUM_REPORT_MAX_HEADING_LENGTH,
  PREMIUM_REPORT_MAX_TABLE_COLS,
  PREMIUM_REPORT_MAX_TABLE_ROWS,
  PREMIUM_REPORT_MAX_TEXT_LENGTH,
  isPremiumBlockType,
  type PremiumValueTransformOp,
} from '#constants/premium_report.constants'
import { parseReportColor } from '#constants/report_builder.constants'
import type {
  PremiumDataset,
  PremiumReportBlock,
  PremiumReportDocument,
  PremiumReportDocumentDraft,
  PremiumTableBlock,
  PremiumTableCellStyle,
} from '#contracts/premium_report'
import {
  aggregateRowsByCategory,
  asEchartsOption,
  maybeAppendSquadRangeBand,
  pickCategoryColumn,
  pickValueColumns,
  rebuildLineChartFromRows,
  lineChartNeedsTimeAxisRepair,
} from '#services/premium_report/chart_presets'
import { relabelDatasetColumns, relabelTableColumns } from '#services/premium_report/column_labels'
import { normalizeIsoDate, uniqueSortedIsoDates } from '#services/premium_report/dataset_ops'
import {
  columnStats,
  formatDisplayCell,
  isIdColumnName,
  pickDateColumn,
  pruneEmptyMetricColumns,
  rankTopRows,
  sortDatasetByDate,
  toNumber,
} from '#services/premium_report/dataset_ops'
import type { AppLanguage } from '#utils/localize'

export const implausibleMetricWarning = (
  dataset: PremiumDataset,
  dateRange: { from: string; to: string }
): string | undefined => {
  const days = daysInRange(dateRange.from, dateRange.to)
  const checks: Array<{ match: (c: string) => boolean; cap: number; unit: string }> = [
    { match: isMinutesColumnName, cap: days * 180, unit: 'min' },
    { match: isDistanceKmColumn, cap: days * 30, unit: 'km' },
    { match: isDistanceMetersColumn, cap: days * 30_000, unit: 'm' },
  ]
  for (const check of checks) {
    for (const column of dataset.columns) {
      if (!check.match(column)) continue
      const median = columnStats(dataset.rows, column)?.median
      if (median === undefined || median <= check.cap) continue
      return `"${column}" implausible (median ${Math.round(median)} ${check.unit} / ${days}d, cap ${check.cap}). Prefer fetch_* macros; avoid multi JOIN SUM.`
    }
  }
  return undefined
}

const daysInRange = (from: string, to: string): number => {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 31
  return Math.round((end - start) / 86_400_000) + 1
}

const isMinutesColumnName = (column: string): boolean =>
  /(^|_)min(ute|utes|s)?(_|$)|duree_min|minutes_jou|temps_de_jeu/i.test(column)

export const isDistanceMetersColumn = (column: string): boolean => {
  const name = column.toLowerCase()
  if (/\bkm\b|_km\b|\(km\)|per_?min|\/\s*min|hsr|band/.test(name)) return false
  return /distance/.test(name)
}

const isDistanceKmColumn = (column: string): boolean =>
  /distance.*_?km|km.*distance|total_distance_km|distance\s*\(km\)/i.test(column)

export const emptyPremiumDocument = (
  dateRange: PremiumReportDocument['dateRange'],
  athleteIds?: string[]
): PremiumReportDocument => ({
  title: '',
  dateRange: { from: dateRange.from, to: dateRange.to },
  ...(athleteIds?.length ? { athleteIds: [...athleteIds] } : {}),
  blocks: [],
})

export const clonePremiumDocument = (document: PremiumReportDocument): PremiumReportDocument =>
  structuredClone(document)

export const compactPremiumDocument = (document: PremiumReportDocument) => ({
  title: document.title,
  dateRange: document.dateRange,
  ...(document.athleteIds?.length ? { athleteCount: document.athleteIds.length } : {}),
  blocks: document.blocks.map((block) => {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      const columns = chartSourceColumns(block.option)
      return {
        id: block.id,
        type: block.type,
        title: block.title,
        series: compactChartSeries(block.option),
        hasSource: hasChartEmbeddedSource(block.option),
        ...(columns.length ? { columns } : {}),
      }
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      return {
        id: block.id,
        type: block.type,
        title: block.title,
        columns: block.columns,
        rowCount: block.rows.length,
        option: block.option ?? {},
      }
    }
    return {
      id: block.id,
      type: block.type,
      text: block.text.slice(0, 120),
      ...(block.type === PREMIUM_BLOCK_TYPE.HEADING ? { level: block.level ?? 1 } : {}),
    }
  }),
})

export const datasetFromChartOption = (
  option: Record<string, unknown>
): PremiumDataset | undefined => {
  const dataset = option.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && source.length >= 1) {
      const header = source[0]
      if (Array.isArray(header) && header.length > 0) {
        const columns = header.map((cell) => String(cell ?? ''))
        const rows = source.slice(1).flatMap((row) => {
          if (!Array.isArray(row)) return []
          const record: Record<string, unknown> = {}
          for (let i = 0; i < columns.length; i++) {
            record[columns[i]!] = row[i] ?? null
          }
          return [record]
        })
        return { id: 'embedded', columns, rows }
      }
    }
  }
  return datasetFromSeriesData(option)
}

const datasetFromSeriesData = (option: Record<string, unknown>): PremiumDataset | undefined => {
  const seriesRaw = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : []
  const series = seriesRaw.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const data = (item as { data?: unknown }).data
    if (!Array.isArray(data) || data.length === 0) return []
    const name =
      typeof (item as { name?: unknown }).name === 'string' &&
      String((item as { name: string }).name).trim()
        ? String((item as { name: string }).name).trim()
        : `series_${index}`
    return [{ name, data }]
  })
  if (series.length === 0) return undefined

  const xAxis = option.xAxis
  const categories =
    xAxis &&
    typeof xAxis === 'object' &&
    !Array.isArray(xAxis) &&
    Array.isArray((xAxis as { data?: unknown }).data)
      ? (xAxis as { data: unknown[] }).data.map((cell) => String(cell ?? ''))
      : undefined

  if (categories && categories.length > 0) {
    const indexByIso = new Map<string, number>()
    categories.forEach((category, index) => {
      const key = normalizeIsoDate(category) ?? category
      if (!indexByIso.has(key)) indexByIso.set(key, index)
    })
    const isoDates = uniqueSortedIsoDates(categories)
    const orderedCats =
      isoDates.length >= Math.max(2, Math.ceil(categories.length * 0.6)) ? isoDates : categories
    const columns = ['date_of_day', ...series.map((item) => item.name)]
    const rows = orderedCats.map((category) => {
      const key = normalizeIsoDate(category) ?? category
      const rowIndex = indexByIso.get(key)
      const record: Record<string, unknown> = {
        date_of_day: normalizeIsoDate(category) ?? category,
      }
      for (const item of series) {
        record[item.name] = rowIndex == null ? null : (item.data[rowIndex] ?? null)
      }
      return record
    })
    return { id: 'embedded', columns, rows }
  }

  if (series.length === 1) {
    const only = series[0]!
    const columns = ['index', only.name]
    const rows = only.data.map((value, index) => ({ index, [only.name]: value }))
    return { id: 'embedded', columns, rows }
  }

  const len = Math.max(...series.map((item) => item.data.length))
  const columns = ['index', ...series.map((item) => item.name)]
  const rows = Array.from({ length: len }, (_, rowIndex) => {
    const record: Record<string, unknown> = { index: rowIndex }
    for (const item of series) {
      record[item.name] = item.data[rowIndex] ?? null
    }
    return record
  })
  return { id: 'embedded', columns, rows }
}

export const hasChartEmbeddedSource = (option: Record<string, unknown>): boolean => {
  const dataset = option.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && source.length > 0) return true
  }
  return (
    Array.isArray(option.series) &&
    option.series.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        Array.isArray((item as { data?: unknown }).data)
    )
  )
}

export const insertBlock = (
  document: PremiumReportDocument,
  block: PremiumReportBlock,
  after?: string,
  limits?: { maxCharts?: number; maxBlocks?: number }
): string => {
  const maxBlocks = limits?.maxBlocks ?? PREMIUM_REPORT_MAX_BLOCKS
  const maxCharts = limits?.maxCharts ?? PREMIUM_REPORT_MAX_CHARTS
  if (document.blocks.length >= maxBlocks) {
    return JSON.stringify({
      error: `Report already has ${maxBlocks} blocks`,
    })
  }
  if (
    block.type === PREMIUM_BLOCK_TYPE.CHART &&
    document.blocks.filter((item) => item.type === PREMIUM_BLOCK_TYPE.CHART).length >= maxCharts
  ) {
    return JSON.stringify({
      error: `Report already has ${maxCharts} charts`,
    })
  }
  const index = insertIndex(document.blocks, after)
  document.blocks = [...document.blocks.slice(0, index), block, ...document.blocks.slice(index)]
  return JSON.stringify({ ok: true, id: block.id })
}

export const sanitizeIncomingDocument = (
  raw: PremiumReportDocumentDraft | undefined,
  fallbackRange: PremiumReportDocument['dateRange'],
  language: AppLanguage = 'fr'
): PremiumReportDocument => {
  if (!raw) return emptyPremiumDocument(fallbackRange)
  const dateRange = {
    from: raw.dateRange?.from || fallbackRange.from,
    to: raw.dateRange?.to || fallbackRange.to,
  }
  const blocks = (raw.blocks ?? [])
    .flatMap((block) => sanitizeBlock(block as PremiumReportBlock, language))
    .slice(0, PREMIUM_REPORT_MAX_BLOCKS)
  return {
    title: raw.title?.trim() ?? '',
    dateRange,
    ...(raw.athleteIds?.length ? { athleteIds: [...raw.athleteIds] } : {}),
    blocks,
  }
}

export const newBlockId = (): string => randomUUID()

const ISO_DATE_TIME_RE =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/

const pad2 = (n: number) => String(n).padStart(2, '0')
const formatUtcDate = (value: Date): string => {
  const date = `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  if (!value.getUTCHours() && !value.getUTCMinutes() && !value.getUTCSeconds()) return date
  return `${date} ${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`
}

const toDisplayDate = (value: unknown): unknown => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? value : formatUtcDate(value)
  if (typeof value !== 'string') return value
  const match = ISO_DATE_TIME_RE.exec(value.trim())
  if (!match) return value
  const date = match[1]
  const hour = match[2]
  const minute = match[3]
  const second = match[4]
  if (!hour || (hour === '00' && minute === '00' && (!second || second === '00'))) return date
  return `${date} ${hour}:${minute}`
}

export const sanitizePlainObject = (
  value: unknown,
  depth = 0
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 12) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    const cleaned = sanitizeJsonValue(entry, depth + 1)
    if (cleaned !== undefined) out[key] = cleaned
  }
  return out
}

export const datasetToSource = (dataset: PremiumDataset): unknown[] => {
  const rows = dataset.rows.slice(0, PREMIUM_REPORT_MAX_DATASET_ROWS)
  return [
    dataset.columns,
    ...rows.map((row) => dataset.columns.map((column) => toCell(row[column]))),
  ]
}

export const toDisplayChartDataset = (dataset: PremiumDataset): PremiumDataset => {
  const rows = dataset.rows.map((row) => {
    const next: Record<string, unknown> = { ...row }
    const joueur = playerLabel(row)
    if (joueur) next.joueur = joueur
    const seconds = firstDurationSeconds(next)
    if (seconds != null && next.minutes == null) next.minutes = Math.round(seconds / 60)
    for (const column of Object.keys(next)) {
      next[column] = toDisplayDate(next[column])
      if (shouldHideColumn(column, next[column], joueur)) delete next[column]
    }
    return next
  })
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      if (seen.has(column)) continue
      seen.add(column)
      columns.push(column)
    }
  }
  if (seen.has('joueur')) {
    columns.splice(columns.indexOf('joueur'), 1)
    columns.unshift('joueur')
  }
  return { ...dataset, columns, rows }
}

export const mergeChartDatasets = (datasets: PremiumDataset[]): PremiumDataset => {
  const prepared = datasets.map(toDisplayChartDataset)
  if (prepared.length === 1) return prepared[0]
  const category = pickCategoryColumn(prepared[0])
  const columns: string[] = [category]
  const columnSet = new Set(columns)
  const units: Record<string, string> = {}
  const labels: Record<string, string> = {}
  const rowsByKey = new Map<string, Record<string, unknown>>()
  for (const dataset of prepared) {
    if (dataset.units) Object.assign(units, dataset.units)
    if (dataset.labels) Object.assign(labels, dataset.labels)
    const cat = pickCategoryColumn(dataset, category)
    for (const column of dataset.columns) {
      if (column !== cat && column !== category && !columnSet.has(column)) {
        columnSet.add(column)
        columns.push(column)
      }
    }
    for (const row of dataset.rows) {
      const key = String(row[cat] ?? '').trim()
      if (!key || isUuidText(key)) continue
      const current = rowsByKey.get(key) ?? { [category]: key }
      for (const column of dataset.columns) {
        if (column === cat) continue
        current[column] = row[column]
      }
      current[category] = key
      rowsByKey.set(key, current)
    }
  }
  return {
    id: prepared.map((dataset) => dataset.id).join('+'),
    columns,
    rows: [...rowsByKey.values()],
    ...(Object.keys(units).length ? { units } : {}),
    ...(Object.keys(labels).length ? { labels } : {}),
  }
}

export const bindChartDataset = (
  option: Record<string, unknown>,
  dataset: PremiumDataset,
  language: AppLanguage = 'fr'
): Record<string, unknown> => {
  if (hasPrebuiltSeriesData(option) && chartOptionHasRenderableData(option)) {
    const stripped = stripUuidLabels({
      ...option,
      animation: false,
    })
    const seriesPreview = Array.isArray(stripped.series) ? stripped.series : []
    const isLineSeries =
      seriesPreview.length > 0 &&
      seriesPreview.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false
        const type = (item as { type?: unknown }).type
        return type === 'line' || type == null
      })
    if (!isLineSeries) return stripped
    return maybeAppendSquadRangeBand(asEchartsOption(stripped), language)
  }
  let display = sortDatasetByDate(relabelDatasetColumns(toDisplayChartDataset(dataset), language))
  const seriesPreview = Array.isArray(option.series) ? option.series : []
  const isLineSeries =
    seriesPreview.length > 0 &&
    seriesPreview.every((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      const type = (item as { type?: unknown }).type
      return type === 'line' || type == null
    })
  if (isLineSeries && pickDateColumn(display.columns)) {
    const encodedYs = seriesPreview
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined
        const encode = (item as { encode?: { y?: unknown } }).encode
        const name = (item as { name?: unknown }).name
        if (typeof encode?.y === 'string') return encode.y
        return typeof name === 'string' ? name : undefined
      })
      .filter((col): col is string => Boolean(col))
    const rebuilt = rebuildLineChartFromRows(display, language, {
      column: encodedYs[0],
      title: encodedYs.some(
        (col) => /_min$/i.test(col) || /_max$/i.test(col) || /_mean$/i.test(col)
      )
        ? 'team mean ± min-max'
        : undefined,
    })
    if (rebuilt) {
      return maybeAppendSquadRangeBand(
        asEchartsOption(stripUuidLabels({ ...rebuilt, animation: false })),
        language,
        rebuilt && encodedYs.length >= 2 ? 'team mean ± min-max' : ''
      )
    }
  }
  const category = pickCategoryColumn(display)
  const columns = new Set(display.columns)

  if (isBarLikeOption(option) && display.rows.length > 0) {
    const valueColumns = pickValueColumns(display, category)
    const aggregated = aggregateRowsByCategory(display.rows, category, valueColumns)
    if (aggregated.length !== display.rows.length) {
      display = { ...display, rows: aggregated }
    }
    display = {
      ...display,
      rows: pruneEmptyBarCategories(display.rows, valueColumns),
    }
  }

  const series = Array.isArray(option.series)
    ? option.series.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item
        const next = { ...(item as Record<string, unknown>) }
        next.encode = remapEncode(next.encode, columns, category)
        const encode = next.encode as Record<string, unknown> | undefined
        const boundY = encode?.y ?? encode?.value
        if (typeof boundY === 'string' && columns.has(boundY)) delete next.data
        return next
      })
    : option.series
  const bound = stripUuidLabels({
    ...option,
    animation: false,
    dataset: { source: datasetToSource(display) },
    ...(series !== undefined ? { series } : {}),
  })
  const seriesItems = Array.isArray(bound.series) ? bound.series : []
  const isLineEvolution =
    seriesItems.length > 0 &&
    seriesItems.every((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      const type = (item as { type?: unknown }).type
      return type === 'line' || type == null
    })
  if (!isLineEvolution) return bound
  return maybeAppendSquadRangeBand(asEchartsOption(bound), language)
}

const BAR_CHART_MAX_CATEGORIES = 12

const pruneEmptyBarCategories = (
  rows: Array<Record<string, unknown>>,
  valueColumns: string[]
): Array<Record<string, unknown>> => {
  if (!valueColumns.length) return rows
  const withValues = rows.filter((row) => valueColumns.some((col) => toNumber(row[col]) != null))
  if (withValues.length <= BAR_CHART_MAX_CATEGORIES) return withValues
  const sortCol = valueColumns[0]!
  return rankTopRows(withValues, sortCol, BAR_CHART_MAX_CATEGORIES, 'desc')
}

const isBarLikeOption = (option: Record<string, unknown>): boolean => {
  const series = option.series
  const items = Array.isArray(series) ? series : series ? [series] : []
  if (items.length === 0) return false
  return (
    items.every((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      const type = (item as { type?: unknown }).type
      return type === 'bar' || type === 'line'
    }) &&
    items.some((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      return (item as { type?: unknown }).type === 'bar'
    })
  )
}

/** True when a bound chart option has at least one numeric point to draw. */
const seriesHasFinitePoint = (data: unknown): boolean => {
  if (!Array.isArray(data)) return false
  return data.some((point) => {
    if (typeof point === 'number' && Number.isFinite(point)) return true
    if (Array.isArray(point) && point.some((v) => toNumber(v) != null)) return true
    if (point && typeof point === 'object') {
      const value = (point as { value?: unknown }).value
      if (toNumber(value) != null) return true
      if (Array.isArray(value) && value.some((v) => toNumber(v) != null)) return true
    }
    return false
  })
}

export const chartOptionHasRenderableData = (option: Record<string, unknown>): boolean => {
  const dataset = option.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && source.length > 0) {
      const header = source[0]
      if (Array.isArray(header) && source.length >= 2) {
        for (let r = 1; r < source.length; r++) {
          const row = source[r]
          if (!Array.isArray(row)) continue
          for (let c = 0; c < row.length; c++) {
            if (typeof header[c] === 'string' && toNumber(row[c]) != null) return true
          }
        }
      } else if (header && typeof header === 'object' && !Array.isArray(header)) {
        for (const row of source) {
          if (!row || typeof row !== 'object' || Array.isArray(row)) continue
          for (const value of Object.values(row as Record<string, unknown>)) {
            if (toNumber(value) != null) return true
          }
        }
      }
    }
  }
  const series = option.series
  const items = Array.isArray(series) ? series : series ? [series] : []
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    if (seriesHasFinitePoint((item as { data?: unknown }).data)) return true
  }
  return false
}

/** Drop chart blocks that would render as empty axes (categories without values). */
export const dropEmptyChartBlocks = (
  document: PremiumReportDocument
): { document: PremiumReportDocument; dropped: string[] } => {
  const dropped: string[] = []
  const blocks = document.blocks.filter((block) => {
    if (block.type !== PREMIUM_BLOCK_TYPE.CHART) return true
    if (chartOptionHasRenderableData(block.option)) return true
    dropped.push(block.title || block.id)
    return false
  })
  if (!dropped.length) return { document, dropped }
  return { document: { ...document, blocks }, dropped }
}

const hasPrebuiltSeriesData = (option: Record<string, unknown>): boolean => {
  const xAxis = option.xAxis
  const xData =
    xAxis && typeof xAxis === 'object' && !Array.isArray(xAxis)
      ? (xAxis as { data?: unknown }).data
      : undefined
  const series = option.series
  const items = Array.isArray(series) ? series : series ? [series] : []
  if (Array.isArray(xData) && xData.length > 0) {
    const hasLineData = items.some((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      const typed = item as { type?: unknown; data?: unknown }
      return typed.type === 'line' && seriesHasFinitePoint(typed.data)
    })
    if (hasLineData && !lineChartNeedsTimeAxisRepair(asEchartsOption(option))) return true
  }
  return items.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const type = (item as { type?: unknown }).type
    const data = (item as { data?: unknown }).data
    return (type === 'heatmap' || type === 'radar') && Array.isArray(data) && data.length > 0
  })
}

export const stripUuidLabels = (option: Record<string, unknown>): Record<string, unknown> =>
  sanitizePlainObject(replaceUuidValues(option)) ?? option

export const tableFromDataset = (
  dataset: PremiumDataset,
  language: AppLanguage = 'fr'
): Pick<PremiumTableBlock, 'columns' | 'rows'> & { droppedEmptyColumns?: string[] } => {
  const pruned = pruneEmptyMetricColumns(dataset)
  const display = relabelDatasetColumns(toDisplayChartDataset(pruned.dataset), language)
  return {
    columns: display.columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS),
    rows: display.rows
      .slice(0, PREMIUM_REPORT_MAX_TABLE_ROWS)
      .map((row) =>
        display.columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS).map((column) => toCell(row[column]))
      ),
    ...(pruned.dropped.length ? { droppedEmptyColumns: pruned.dropped } : {}),
  }
}

const COUNT_COLUMN_RE = /^(n|entries?|nb_?\s*sessions?|nb_[a-z0-9_]*|n_[a-z0-9_]*|count)$/i
const LABEL_COLUMN_RE =
  /^(joueur|player|name|athlete|biomarker|test_type|poste|position|unit|label|date|activity)$/i
const RISK_COLUMN_RE =
  /risk|soreness|body.?soreness|stress|sleep.?quality|sleep.?score|quality.?rating|monoton|strain|acwr|fatigue|mood|energy/i

const WORSE_WHEN_HIGH_COLUMN_RE =
  /acwr|monotony|strain|soreness|body.?soreness|stress|fatigue|risk|injury|decel|cumul|acute|hsr|hmld|sprint|accel|dsl|ewma|player.?load/i

const BETTER_WHEN_HIGH_COLUMN_RE =
  /performance|readiness|quality|mood|energy|sleep.?score|sleep.?quality|wellness/i

const WORSE_WHEN_LOW_COLUMN_RE =
  /mood|energy|readiness|quality|sleep.?score|sleep.?quality|wellness/i

export type StaffHeatScale = {
  field: string
  label: string
  isReversed: boolean
  min?: number
  max?: number
}

type StaffHeatPolarity = 'volume_high' | 'risk_high' | 'risk_low'

const foldHeatToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const matchStaffHeatScale = (column: string, scales: StaffHeatScale[]): StaffHeatScale | null => {
  const col = foldHeatToken(column)
  if (col.length < 3) return null
  if (/injuryrisk|performance/.test(col)) return null
  let best: StaffHeatScale | null = null
  let bestLen = 0
  for (const scale of scales) {
    const fieldRaw = foldHeatToken(scale.field)
    const fieldStem = foldHeatToken(scale.field.replace(/_rating$/i, ''))
    const label = foldHeatToken(scale.label)
    for (const token of [fieldRaw, fieldStem, label]) {
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

const staffHeatPolarity = (column: string, scales?: StaffHeatScale[]): StaffHeatPolarity => {
  const scale = scales?.length ? matchStaffHeatScale(column, scales) : null
  if (scale) return scale.isReversed ? 'risk_low' : 'risk_high'
  if (WORSE_WHEN_HIGH_COLUMN_RE.test(column) && !BETTER_WHEN_HIGH_COLUMN_RE.test(column)) {
    return 'risk_high'
  }
  if (WORSE_WHEN_LOW_COLUMN_RE.test(column)) return 'risk_low'
  return 'volume_high'
}

const columnScaleIsComparable = (values: number[]): boolean => {
  if (values.length < 3) return false
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return false
  const sorted = [...values].sort((left, right) => left - right)
  const p10 = sorted[Math.max(0, Math.floor(sorted.length * 0.1))]!
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!
  if (p10 > 0 && p90 / p10 > 25) return false
  return true
}

const STAFF_SIGNAL_COLUMN_RE =
  /acwr|ewma|srpe|monotony|strain|soreness|body.?soreness|stress|rpe|readiness|fatigue|mood|risk|injury|wellness|sleep.?quality|sleep.?score|sleep.?duration|energy|quality.?rating/i

export const shouldHeatStaffTable = (block: PremiumTableBlock): boolean => {
  if (block.rows.length < 4) return false
  return block.columns.some((col, index) => {
    const name = String(col).trim()
    if (LABEL_COLUMN_RE.test(name) || COUNT_COLUMN_RE.test(name)) return false
    if (!STAFF_SIGNAL_COLUMN_RE.test(name) && !RISK_COLUMN_RE.test(name)) return false
    const values: number[] = []
    for (const row of block.rows) {
      const n = toNumber(row[index])
      if (n != null) values.push(n)
    }
    return values.length >= 3 && columnScaleIsComparable(values)
  })
}

export const PREMIUM_HEAT_COLORS = {
  volumeMid: '#C8E6D5',
  volumeHigh: '#2F9E6F',
  riskMid: '#F5D0A9',
  riskHigh: '#E07070',
} as const

export type PremiumHeatColors = {
  volumeMid: string
  volumeHigh: string
  riskMid: string
  riskHigh: string
}

export const resolveHeatColors = (option?: Record<string, unknown>): PremiumHeatColors => {
  const legend = isPlainRecord(option?.heatLegend) ? option.heatLegend : undefined
  const raw = isPlainRecord(legend?.colors)
    ? legend.colors
    : isPlainRecord(option?.heatColors)
      ? option.heatColors
      : undefined
  const pick = (key: keyof PremiumHeatColors, fallback: string): string => {
    const value = raw?.[key]
    return typeof value === 'string' ? (parseReportColor(value) ?? fallback) : fallback
  }
  return {
    volumeMid: pick('volumeMid', PREMIUM_HEAT_COLORS.volumeMid),
    volumeHigh: pick('volumeHigh', PREMIUM_HEAT_COLORS.volumeHigh),
    riskMid: pick('riskMid', PREMIUM_HEAT_COLORS.riskMid),
    riskHigh: pick('riskHigh', PREMIUM_HEAT_COLORS.riskHigh),
  }
}

export const applyTableHeat = (
  block: PremiumTableBlock,
  language: AppLanguage = 'fr',
  opts?: { heat?: boolean; scales?: StaffHeatScale[] }
): PremiumTableBlock => {
  const enableHeat = opts?.heat !== false
  const colors = resolveHeatColors(block.option)
  const cells: Array<Array<Record<string, unknown> | undefined>> = block.rows.map(() => [])
  let heated = false
  let hasRisk = false
  if (enableHeat) {
    for (let c = 0; c < block.columns.length; c++) {
      const col = String(block.columns[c] ?? '').trim()
      if (LABEL_COLUMN_RE.test(col) || COUNT_COLUMN_RE.test(col)) continue
      const values: Array<{ row: number; value: number }> = []
      for (let r = 0; r < block.rows.length; r++) {
        const n = toNumber(block.rows[r]?.[c])
        if (n != null) values.push({ row: r, value: n })
      }
      if (values.length < 3) continue
      if (!columnScaleIsComparable(values.map((entry) => entry.value))) continue
      const polarity = staffHeatPolarity(col, opts?.scales)
      if (polarity !== 'volume_high') hasRisk = true
      const ranked = [...values].sort((left, right) =>
        polarity === 'risk_low' ? left.value - right.value : right.value - left.value
      )
      const highCount = Math.max(1, Math.ceil(ranked.length * 0.15))
      const midCount = Math.max(highCount + 1, Math.ceil(ranked.length * 0.35))
      for (let i = 0; i < midCount; i++) {
        const entry = ranked[i]
        if (!entry) continue
        heated = true
        cells[entry.row]![c] = {
          background: heatColor(i < highCount, polarity, colors),
        }
      }
    }
  }
  const prev = isPlainRecord(block.option) ? { ...block.option } : {}
  delete prev.cellRules
  delete prev.heatColors
  if (!enableHeat) {
    delete prev.cells
    delete prev.heatLegend
  }
  const formattedRows = block.rows.map((row) =>
    row.map((cell) => formatDisplayCell(cell, language))
  )
  const option: Record<string, unknown> = {
    ...prev,
    border: prev.border ?? true,
  }
  if (enableHeat) {
    option.cells = cells
    option.heatLegend = heated
      ? {
          mode: 'relative',
          hasRisk,
          colors,
        }
      : undefined
  }
  return {
    ...block,
    rows: formattedRows,
    option,
  }
}

const heatColor = (
  topBand: boolean,
  polarity: StaffHeatPolarity,
  colors: PremiumHeatColors
): string => {
  if (polarity === 'volume_high') return topBand ? colors.volumeHigh : colors.volumeMid
  return topBand ? colors.riskHigh : colors.riskMid
}

export const applyValueTransform = (
  block: PremiumReportBlock,
  args: { columns?: string[]; op: PremiumValueTransformOp; value?: number }
): { block: PremiumReportBlock; cells: number } | string => {
  const scoped = scopeMetersToKmColumns(block, args)
  if (scoped === 'skip') return { block, cells: 0 }
  if (typeof scoped === 'string') return scoped
  if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
    const option = applyTransformToChartOption(block.option, scoped)
    if (typeof option === 'string') return option
    const next = { ...block, option: option.option }
    return {
      block: isMetersToKmMultiply(scoped.op, scoped.value)
        ? syncMetersToKmLabels(next, scoped.columns)
        : next,
      cells: option.cells,
    }
  }
  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
    const next = mapTransformCells(block.rows, block.columns, scoped)
    if (typeof next === 'string') return next
    const updated = { ...block, rows: next.rows }
    return {
      block: isMetersToKmMultiply(scoped.op, scoped.value)
        ? syncMetersToKmLabels(updated, scoped.columns)
        : updated,
      cells: next.cells,
    }
  }
  return JSON.stringify({ error: 'transform_values only applies to charts and tables' })
}

export const renameMetersToKm = (column: string): string => {
  if (column.toLowerCase().endsWith('_m')) return `${column.slice(0, -2)}_km`
  if (/\(m\)/i.test(column)) return column.replace(/\(m\)/gi, '(km)')
  if (/metres?/i.test(column) || /meters?/i.test(column)) {
    return column.replace(/metres?/gi, 'km').replace(/meters?/gi, 'km')
  }
  if (column.toLowerCase() === 'distance') return 'distance_km'
  return `${column}_km`
}

export const renameMetersInLabel = (value: string): string =>
  value
    .replace(/\(m\)/gi, '(km)')
    .replace(/_m\b/g, '_km')
    .replace(/\ben m\b/gi, 'en km')

const syncMetersToKmLabels = (
  block: PremiumReportBlock,
  columns?: string[]
): PremiumReportBlock => {
  const shouldRename = (name: string): boolean =>
    columns?.length ? columns.includes(name) : isDistanceMetersColumn(name)

  if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
    const dataset = block.option.dataset
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
      return { ...block, title: renameMetersInLabel(block.title) }
    }
    const source = (dataset as { source?: unknown }).source
    if (!Array.isArray(source) || source.length === 0 || !Array.isArray(source[0])) {
      return { ...block, title: renameMetersInLabel(block.title) }
    }
    const header = (source[0] as unknown[]).map((cell) => {
      const name = String(cell ?? '')
      return shouldRename(name) ? renameMetersToKm(name) : name
    })
    const option: Record<string, unknown> = {
      ...block.option,
      dataset: { ...(dataset as Record<string, unknown>), source: [header, ...source.slice(1)] },
    }
    if (typeof option.title === 'string') option.title = renameMetersInLabel(option.title)
    return {
      ...block,
      title: renameMetersInLabel(block.title),
      option,
    }
  }
  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
    return {
      ...block,
      title: block.title ? renameMetersInLabel(block.title) : block.title,
      columns: block.columns.map((column) =>
        shouldRename(column) ? renameMetersToKm(column) : column
      ),
    }
  }
  return block
}

const isMetersToKmMultiply = (op: PremiumValueTransformOp, value?: number): boolean =>
  op === 'multiply' && value != null && Number.isFinite(value) && Math.abs(value - 0.001) < 1e-9

const blockHeaderColumns = (block: PremiumReportBlock): string[] => {
  if (block.type === PREMIUM_BLOCK_TYPE.TABLE) return block.columns
  if (block.type !== PREMIUM_BLOCK_TYPE.CHART) return []
  const dataset = block.option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return []
  const source = (dataset as { source?: unknown }).source
  if (!Array.isArray(source) || !Array.isArray(source[0])) return []
  return (source[0] as unknown[]).map((cell) => String(cell ?? ''))
}

const matchColumns = (available: string[], requested: string[]): string[] => {
  const matched: string[] = []
  for (const want of requested) {
    const hit =
      available.find((col) => col === want) ??
      available.find((col) => col.toLowerCase() === want.toLowerCase()) ??
      (want.toLowerCase().includes('distance')
        ? available.find((col) => isDistanceMetersColumn(col))
        : undefined)
    if (hit && !matched.includes(hit)) matched.push(hit)
  }
  return matched
}

const scopeMetersToKmColumns = (
  block: PremiumReportBlock,
  args: { columns?: string[]; op: PremiumValueTransformOp; value?: number }
): { columns?: string[]; op: PremiumValueTransformOp; value?: number } | 'skip' => {
  const available = blockHeaderColumns(block)
  if (!isMetersToKmMultiply(args.op, args.value)) {
    if (!args.columns?.length) return args
    const columns = matchColumns(available, args.columns)
    return { ...args, columns: columns.length ? columns : args.columns }
  }
  const requested = args.columns?.length ? matchColumns(available, args.columns) : []
  const columns = (requested.length ? requested : available).filter(isDistanceMetersColumn)
  if (columns.length === 0) return 'skip'
  return { ...args, columns }
}

const mapTransformCells = (
  rows: Array<Array<string | number | null>>,
  columns: string[],
  args: { columns?: string[]; op: PremiumValueTransformOp; value?: number }
): { rows: Array<Array<string | number | null>>; cells: number } | string => {
  const wanted = args.columns?.length ? new Set(args.columns) : null
  const indexes = columns.flatMap((column, index) => (!wanted || wanted.has(column) ? [index] : []))
  if (indexes.length === 0) {
    if (isMetersToKmMultiply(args.op, args.value)) {
      return { rows, cells: 0 }
    }
    return JSON.stringify({ error: 'no matching columns', have: columns, wanted: args.columns })
  }
  const indexSet = new Set(indexes)
  let cells = 0
  const nextRows = rows.map((row) =>
    row.map((cell, index) => {
      if (!indexSet.has(index)) return cell
      const next = transformNumber(cell, args.op, args.value)
      if (next === undefined) return cell
      cells += 1
      return next
    })
  )
  return { rows: nextRows, cells }
}

const applyTransformToChartOption = (
  option: Record<string, unknown>,
  args: { columns?: string[]; op: PremiumValueTransformOp; value?: number }
): { option: Record<string, unknown>; cells: number } | string => {
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    return JSON.stringify({ error: 'chart has no dataset.source to transform' })
  }
  const source = (dataset as { source?: unknown }).source
  if (!Array.isArray(source) || source.length < 2 || !Array.isArray(source[0])) {
    return JSON.stringify({ error: 'chart has no dataset.source to transform' })
  }
  const header = source[0].map((cell) => String(cell ?? ''))
  const wanted = args.columns?.length
    ? new Set(args.columns)
    : new Set(
        header.filter((_, index) =>
          source.slice(1).some((row) => Array.isArray(row) && toNumber(row[index]) != null)
        )
      )
  const mapped = mapTransformCells(
    source
      .slice(1)
      .map((row) => (Array.isArray(row) ? (row as Array<string | number | null>) : [])),
    header,
    { ...args, columns: [...wanted] }
  )
  if (typeof mapped === 'string') return mapped
  return {
    cells: mapped.cells,
    option: {
      ...option,
      dataset: {
        ...(dataset as Record<string, unknown>),
        source: [header, ...mapped.rows],
      },
    },
  }
}

export type PremiumTableReshape = {
  columns?: string[]
  dropColumns?: string[]
  renameColumns?: Record<string, string>
}

export const projectDatasetColumns = (
  dataset: PremiumDataset,
  keep: string[]
): PremiumDataset | string => {
  if (!keep.length) return dataset
  const picked: string[] = []
  const missing: string[] = []
  for (const wanted of keep) {
    const found = dataset.columns.find(
      (col) => !picked.includes(col) && sameColumnName(col, wanted)
    )
    if (!found) {
      missing.push(wanted)
      continue
    }
    picked.push(found)
  }
  if (missing.length > 0) {
    return JSON.stringify({
      error: `Column '${missing[0]}' not found in dataset.`,
      available_columns: dataset.columns,
      ...(missing.length > 1 ? { missing } : {}),
    })
  }
  return {
    ...dataset,
    columns: picked,
    rows: dataset.rows.map((row) =>
      Object.fromEntries(picked.map((col) => [col, row[col] ?? null]))
    ),
  }
}

export const reshapePremiumTable = (
  block: PremiumTableBlock,
  args: PremiumTableReshape
): PremiumTableBlock | string => {
  let cols = block.columns.map((name, index) => ({ index, name }))
  const rename = args.renameColumns ?? {}
  for (const [from, to] of Object.entries(rename)) {
    if (!to.trim()) continue
    for (const col of cols) {
      if (sameColumnName(col.name, from)) col.name = to.trim()
    }
  }
  if (args.dropColumns?.length) {
    const next = cols.filter(
      (col) => !args.dropColumns!.some((name) => sameColumnName(name, col.name))
    )
    if (next.length === cols.length) {
      return JSON.stringify({ error: `no columns to drop (have: ${block.columns.join(', ')})` })
    }
    cols = next
  }
  if (args.columns?.length) {
    const picked: Array<{ index: number; name: string }> = []
    const missing: string[] = []
    for (const wanted of args.columns) {
      const found = cols.find(
        (col) =>
          !picked.some((item) => item.index === col.index) && sameColumnName(col.name, wanted)
      )
      if (!found) {
        missing.push(wanted)
        continue
      }
      picked.push({ index: found.index, name: found.name })
    }
    if (missing.length > 0) {
      const available = cols.map((col) => col.name)
      return JSON.stringify({
        error: `Column '${missing[0]}' not found in dataset.`,
        available_columns: available,
        ...(missing.length > 1 ? { missing } : {}),
      })
    }
    cols = picked
  }
  if (cols.length === 0) return JSON.stringify({ error: 'table would have no columns' })
  const renameMap = new Map<string, string>()
  for (const col of cols) {
    renameMap.set(block.columns[col.index], col.name)
  }
  return {
    ...block,
    columns: cols.map((col) => col.name),
    rows: block.rows.map((row) => cols.map((col) => row[col.index] ?? null)),
    ...(block.option ? { option: remapTableOptionNames(block.option, renameMap) } : {}),
  }
}

export const pruneEmptyTableColumns = (
  block: PremiumTableBlock
): { block: PremiumTableBlock; dropped: string[] } => {
  const asDataset: PremiumDataset = {
    id: 'tmp',
    columns: block.columns,
    rows: block.rows.map((row) =>
      Object.fromEntries(block.columns.map((col, i) => [col, row[i] ?? null]))
    ),
  }
  const { dataset, dropped } = pruneEmptyMetricColumns(asDataset)
  if (dropped.length === 0) return { block, dropped }
  return {
    block: {
      ...block,
      columns: dataset.columns,
      rows: dataset.rows.map((row) =>
        dataset.columns.map((col) => {
          const cell = row[col]
          if (cell == null) return null
          if (typeof cell === 'string' || typeof cell === 'number') return cell
          return String(cell)
        })
      ),
    },
    dropped,
  }
}

export const resolveTableBorder = (
  option?: Record<string, unknown>
): { color: string; width: number } | undefined => {
  if (!option || option.border === false || option.border == null) return undefined
  if (option.border === true) return { color: '#94a3b8', width: 1 }
  if (typeof option.border === 'string') {
    const color = sanitizeCssColor(option.border)
    return color ? { color, width: 1 } : { color: '#94a3b8', width: 1 }
  }
  if (!isPlainRecord(option.border)) return undefined
  const color = sanitizeCssColor(option.border.color) ?? '#94a3b8'
  const width =
    typeof option.border.width === 'number' && option.border.width > 0 ? option.border.width : 1
  return { color, width }
}

const sameColumnName = (left: string, right: string): boolean =>
  columnKey(left) === columnKey(right)

const columnKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[_\s-]+/g, '')

const remapTableOptionNames = (
  option: Record<string, unknown>,
  renameMap: Map<string, string>
): Record<string, unknown> => {
  const next = { ...option }
  delete next.cellRules
  if (isPlainRecord(option.columnStyles)) {
    const columnStyles: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(option.columnStyles)) {
      columnStyles[renameMap.get(key) ?? key] = value
    }
    next.columnStyles = columnStyles
  }
  return next
}

export const resolveTableHeaderStyle = (option?: Record<string, unknown>): PremiumTableCellStyle =>
  readCellStyle(option?.header)

export const resolveTableCellStyle = (args: {
  column: string
  rowIndex: number
  colIndex: number
  option?: Record<string, unknown>
}): PremiumTableCellStyle => {
  const option = args.option ?? {}
  const columnMap = isPlainRecord(option.columnStyles) ? option.columnStyles : undefined
  const fromColumn = columnMap ? readCellStyle(columnMap[args.column]) : {}
  const fromCell = readSparseCellStyle(option.cells, args.rowIndex, args.colIndex)
  return { ...fromColumn, ...fromCell }
}

const readSparseCellStyle = (
  cells: unknown,
  rowIndex: number,
  colIndex: number
): PremiumTableCellStyle => {
  if (!Array.isArray(cells) || !Array.isArray(cells[rowIndex])) return {}
  return readCellStyle(cells[rowIndex][colIndex])
}

const readCellStyle = (value: unknown): PremiumTableCellStyle => {
  if (!isPlainRecord(value)) return {}
  const style: PremiumTableCellStyle = {}
  const background = sanitizeCssColor(value.background)
  const text = sanitizeCssColor(value.color)
  if (background) style.background = background
  else if (text) style.background = text
  if (background && text) {
    style.color = text
  } else if (background) {
    style.color = isLightColor(background) ? '#111827' : '#ffffff'
  }
  if (value.bold === true) style.bold = true
  if (value.align === 'left' || value.align === 'center' || value.align === 'right') {
    style.align = value.align
  }
  return style
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const isLightColor = (hex: string): boolean => {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return L > 0.35
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const CSS_COLOR_NAMES: Record<string, string> = {
  red: '#ef4444',
  rouge: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  jaune: '#eab308',
  green: '#22c55e',
  vert: '#22c55e',
  blue: '#3b82f6',
  bleu: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  white: '#ffffff',
  black: '#111827',
  gray: '#6b7280',
  grey: '#6b7280',
}

const sanitizeCssColor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim().toLowerCase()
  if (HEX_COLOR_RE.test(trimmed)) return trimmed
  return CSS_COLOR_NAMES[trimmed]
}

const transformNumber = (
  value: unknown,
  op: PremiumValueTransformOp,
  factor?: number
): number | undefined => {
  const numeric = toNumber(value)
  if (numeric == null) return undefined
  if (op === 'round') {
    if (factor == null || !Number.isFinite(factor)) return Math.round(numeric)
    const decimals = Math.max(0, Math.min(8, Math.trunc(factor)))
    const pow = 10 ** decimals
    return Math.round(numeric * pow) / pow
  }
  if (op === 'floor') return Math.floor(numeric)
  if (op === 'ceil') return Math.ceil(numeric)
  if (factor == null || !Number.isFinite(factor)) return undefined
  if (op === 'multiply') return numeric * factor
  if (op === 'divide') return factor === 0 ? undefined : numeric / factor
  if (op === 'add') return numeric + factor
  return numeric - factor
}

export const stripMarkdownDecorations = (value: string): string =>
  value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')

const sanitizeBlock = (
  block: PremiumReportBlock,
  language: AppLanguage = 'fr'
): PremiumReportBlock[] => {
  if (!isPremiumBlockType(block.type) || !block.id) return []
  if (block.type === PREMIUM_BLOCK_TYPE.HEADING) {
    const text = stripMarkdownDecorations(block.text ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
    if (!text) return []
    const level = block.level === 2 ? 2 : 1
    return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.HEADING, text, level }]
  }
  if (block.type === PREMIUM_BLOCK_TYPE.TEXT) {
    const text = stripMarkdownDecorations(block.text ?? '')
      .replace(/\r\n/g, '\n')
      .trim()
      .slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH)
    if (!text) return []
    return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.TEXT, text }]
  }
  if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
    const option = stripUuidLabels(sanitizePlainObject(block.option) ?? {})
    const title =
      stripMarkdownDecorations(block.title ?? '')
        .replace(/\s+/g, ' ')
        .trim() || 'Chart'
    if (Object.keys(option).length === 0) return []
    return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.CHART, title, option }]
  }
  const columns = relabelTableColumns(
    (block.columns ?? []).map((column) => String(column).trim()).filter(Boolean),
    language
  )
  if (columns.length === 0) return []
  const option = sanitizeTableOption(block)
  const table: PremiumTableBlock = {
    id: block.id,
    type: PREMIUM_BLOCK_TYPE.TABLE,
    title: block.title?.trim() || undefined,
    columns: columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS),
    rows: (block.rows ?? [])
      .slice(0, PREMIUM_REPORT_MAX_TABLE_ROWS)
      .map((row) =>
        columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS).map((_, index) => toCell(row[index]))
      ),
    ...(option ? { option } : {}),
  }
  if (isPlainRecord(option?.heatLegend)) {
    return [
      {
        ...table,
        rows: table.rows.map((row) => row.map((cell) => formatDisplayCell(cell, language))),
      },
    ]
  }
  return [applyTableHeat(table, language, { heat: shouldHeatStaffTable(table) })]
}

const sanitizeTableOption = (block: PremiumTableBlock): Record<string, unknown> | undefined => {
  const fromOption = sanitizePlainObject(block.option)
  return fromOption && Object.keys(fromOption).length > 0 ? fromOption : undefined
}

const insertIndex = (blocks: PremiumReportBlock[], after?: string): number => {
  if (!after || after === 'end') return blocks.length
  if (after === 'start') return 0
  const index = blocks.findIndex((block) => block.id === after)
  return index === -1 ? blocks.length : index + 1
}

const COMPACT_SERIES_CAP = 12
const COMPACT_SOURCE_COLS_CAP = 8

const compactChartSeries = (
  option: Record<string, unknown>
): Array<{ type?: string; name?: string; color?: string }> => {
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
  return series.slice(0, COMPACT_SERIES_CAP).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const entry: { type?: string; name?: string; color?: string } = {}
    if (typeof row.type === 'string') entry.type = row.type
    if (typeof row.name === 'string') entry.name = row.name
    if (typeof row.color === 'string') entry.color = row.color
    return Object.keys(entry).length ? [entry] : []
  })
}

const chartSourceColumns = (option: Record<string, unknown>): string[] => {
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return []
  const source = (dataset as { source?: unknown }).source
  if (!Array.isArray(source) || source.length === 0 || !Array.isArray(source[0])) return []
  return (source[0] as unknown[])
    .slice(0, COMPACT_SOURCE_COLS_CAP)
    .map((cell) => String(cell ?? ''))
    .filter(Boolean)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIRST_NAME_KEYS = ['first_name', 'firstname', 'firstName']
const LAST_NAME_KEYS = ['last_name', 'lastname', 'lastName']
const NAME_KEYS = ['joueur', 'player', 'name', 'athlete', 'full_name', 'athlete_name']

const isUuidText = (value: string): boolean => UUID_RE.test(value.trim())

const playerLabel = (row: Record<string, unknown>): string | undefined => {
  const first = FIRST_NAME_KEYS.map((key) => row[key]).find((v) => typeof v === 'string') as
    string | undefined
  const last = LAST_NAME_KEYS.map((key) => row[key]).find((v) => typeof v === 'string') as
    string | undefined
  const fromParts = `${first ?? ''} ${last ?? ''}`.replace(/\s+/g, ' ').trim()
  if (fromParts && !isUuidText(fromParts)) return fromParts
  for (const key of NAME_KEYS) {
    const value = row[key]
    if (typeof value === 'string' && value.trim() && !isUuidText(value)) return value.trim()
  }
  return undefined
}

const shouldHideColumn = (column: string, value: unknown, joueur?: string): boolean => {
  if (FIRST_NAME_KEYS.includes(column) || LAST_NAME_KEYS.includes(column)) return Boolean(joueur)
  if (isIdColumnName(column)) return true
  if (isDurationSecondsColumn(column)) return true
  if (typeof value === 'string' && isUuidText(value)) return true
  return false
}

const isDurationSecondsColumn = (column: string): boolean =>
  /duration_seconds|duree_seconds|duration_sec/i.test(column)

const firstDurationSeconds = (row: Record<string, unknown>): number | null => {
  for (const column of Object.keys(row)) {
    if (!isDurationSecondsColumn(column)) continue
    const value = toNumber(row[column])
    if (value != null) return value
  }
  return null
}

const foldEncodeColumn = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const isCategoryEncodeName = (column: string, category: string): boolean =>
  column === category ||
  /^(joueur|player|athlete|athlete_name|name|poste|position|date|date_of_day)$/i.test(
    column.trim()
  )

const resolveEncodeColumn = (
  column: string,
  columns: Set<string>,
  category: string
): string | undefined => {
  if (columns.has(column)) return column
  const folded = foldEncodeColumn(column)
  const underscored = column.toLowerCase().replace(/\s+/g, '_')
  for (const candidate of columns) {
    if (candidate.toLowerCase() === column.toLowerCase()) return candidate
    if (candidate.toLowerCase().replace(/\s+/g, '_') === underscored) return candidate
    if (foldEncodeColumn(candidate) === folded) return candidate
  }
  if (isCategoryEncodeName(column, category)) return category
  return undefined
}

const remapEncode = (
  encode: unknown,
  columns: Set<string>,
  category: string
): Record<string, unknown> | unknown => {
  if (!encode || typeof encode !== 'object' || Array.isArray(encode)) return encode
  const next = { ...(encode as Record<string, unknown>) }
  for (const key of ['x', 'itemName', 'y', 'value']) {
    const column = next[key]
    if (typeof column !== 'string' || columns.has(column)) continue
    const resolved = resolveEncodeColumn(column, columns, category)
    if (resolved) {
      next[key] = resolved
      continue
    }
    if (key === 'itemName') next[key] = category
  }
  return next
}

const replaceUuidValues = (value: unknown): unknown => {
  if (typeof value === 'string') return isUuidText(value) ? '' : value
  if (Array.isArray(value)) return value.map(replaceUuidValues)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = replaceUuidValues(entry)
  }
  return out
}

const sanitizeJsonValue = (value: unknown, depth: number): unknown => {
  if (value === null || value === undefined) return null
  const dated = toDisplayDate(value)
  if (typeof dated === 'string' || typeof dated === 'boolean') return dated
  if (typeof dated === 'number') return Number.isFinite(dated) ? dated : null
  if (typeof dated === 'function' || typeof dated === 'symbol') return undefined
  if (Array.isArray(dated)) {
    if (depth > 12) return []
    return dated
      .slice(0, PREMIUM_REPORT_MAX_DATASET_ROWS)
      .map((item) => sanitizeJsonValue(item, depth + 1))
  }
  return sanitizePlainObject(dated, depth)
}

const toCell = (value: unknown): string | number | null => {
  const dated = toDisplayDate(value)
  if (dated === null || dated === undefined) return null
  if (typeof dated === 'number') return Number.isFinite(dated) ? dated : null
  if (typeof dated === 'boolean') return dated ? 1 : 0
  if (typeof dated === 'string') {
    const trimmed = dated.trim()
    if (!trimmed) return ''
    if (isUuidText(trimmed)) return ''
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) return numeric
    }
    return dated
  }
  return String(dated)
}
