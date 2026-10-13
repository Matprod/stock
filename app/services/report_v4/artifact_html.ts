import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  asEchartsOption,
  chartTypeFromOption,
  sanitizeChartOptionForPrint,
} from '#services/premium_report/chart_presets'
import type { SubjectiveChartScale } from '#services/premium_report/charts/echarts_options'
import { asSeriesList } from '#services/premium_report/charts/echarts_types'
import { columnStats, toNumber } from '#services/premium_report/dataset_ops'
import { hasChartEmbeddedSource } from '#services/premium_report/premium_report_document'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import {
  buildReportPackCss,
  buildReportPrintCss,
} from '#services/report_v4/design/report_pack_css'
import { buildEchartsBootScript, echartsCdnScriptTag } from '#services/report_v4/echarts_boot'
import { maunaWatermarkCss, maunaWatermarkImgTag } from '#services/report_v4/mauna_watermark'
import {
  ARTIFACT_MIN_HTML_BYTES,
  REPORT_V4_MAX_HTML_BYTES,
  escapeHtml,
} from '#services/report_v4/report_v4_constants'
import {
  injectDataFactsInHtml,
  type ReportFact,
} from '#services/report_v4/report_facts'
import { foldAscii, foldKey } from '#utils/html_text'
import type { AppLanguage } from '#utils/localize'

export type ArtifactChartSpec = {
  id: string
  title: string
  option: Record<string, unknown>
}

export type LeanDesignChart = {
  id: string
  title: string
  chartType?: string
  seriesNames?: string[]
  categoryCount?: number
  hasEmbeddedSource?: boolean
}

export type LeanDesignTable = {
  id: string
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
  rowCount: number
  cells?: Array<Array<{ background?: string } | undefined>>
  columnStats?: Record<
    string,
    { mean: number; median: number; min: number; max: number; n: number }
  >
}

export type FinalizeArtifactResult =
  | {
      ok: true
      html: string
      injectedCharts: number
      presentHosts: number
      warnings: string[]
    }
  | { ok: false; error: string; warnings: string[] }

const DESIGN_TABLE_ROW_CAP = 12

export const artifactChartHostId = (blockId: string): string => `chart_${blockId.replace(/-/g, '')}`

export const collectArtifactCharts = (
  document: PremiumReportDocument,
  scales?: SubjectiveChartScale[]
): ArtifactChartSpec[] =>
  document.blocks
    .filter((b) => b.type === 'chart')
    .map((b) =>
      b.type === 'chart'
        ? {
            id: artifactChartHostId(b.id),
            title: b.title,
            option: sanitizeChartOptionForPrint(asEchartsOption(b.option), b.title, scales),
          }
        : null
    )
    .filter((row): row is ArtifactChartSpec => Boolean(row))

const chartCategoryCount = (option: Record<string, unknown>): number | undefined => {
  const dataset = option.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && source.length > 1) return source.length - 1
  }
  const xAxis = option.xAxis
  const axisCandidate = Array.isArray(xAxis) ? xAxis[0] : xAxis
  if (
    axisCandidate &&
    typeof axisCandidate === 'object' &&
    !Array.isArray(axisCandidate) &&
    Array.isArray((axisCandidate as { data?: unknown }).data)
  ) {
    return (axisCandidate as { data: unknown[] }).data.length
  }
  const series = asSeriesList(option.series)
  const lengths = series
    .map((item) => (Array.isArray(item.data) ? item.data.length : 0))
    .filter((n) => n > 0)
  return lengths.length ? Math.max(...lengths) : undefined
}

export const projectArtifactChartsForDesign = (
  document: PremiumReportDocument
): LeanDesignChart[] => {
  const charts: LeanDesignChart[] = []
  for (const block of document.blocks) {
    if (block.type !== 'chart') continue
    const option = asEchartsOption(block.option)
    const chartType = chartTypeFromOption(option)
    const seriesNames = asSeriesList(option.series)
      .map((item) => (typeof item.name === 'string' ? item.name.trim() : ''))
      .filter(Boolean)
    const categoryCount = chartCategoryCount(block.option)
    const lean: LeanDesignChart = {
      id: artifactChartHostId(block.id),
      title: block.title,
    }
    if (chartType) lean.chartType = chartType
    if (seriesNames.length) lean.seriesNames = seriesNames
    if (categoryCount != null) lean.categoryCount = categoryCount
    lean.hasEmbeddedSource = hasChartEmbeddedSource(block.option)
    charts.push(lean)
  }
  return charts
}

export type ArtifactTableSpec = {
  id: string
  title: string
  columns: string[]
  rows: Array<Array<string | number | null>>
  cells?: Array<Array<{ background?: string } | undefined>>
}

export const collectArtifactTables = (document: PremiumReportDocument): ArtifactTableSpec[] => {
  const tables: ArtifactTableSpec[] = []
  for (const block of document.blocks) {
    if (block.type !== 'table') continue
    tables.push({
      id: `table_${tables.length + 1}`,
      title: block.title ?? `Table ${tables.length + 1}`,
      columns: block.columns,
      rows: block.rows.slice(0, 40),
      cells: tableHeatCells(block.option),
    })
  }
  return tables
}

const tableColumnStats = (
  columns: string[],
  rows: Array<Array<string | number | null>>
): LeanDesignTable['columnStats'] => {
  const records = rows.map((row) => {
    const record: Record<string, unknown> = {}
    for (let i = 0; i < columns.length; i++) {
      record[columns[i]!] = row[i] ?? null
    }
    return record
  })
  const stats: NonNullable<LeanDesignTable['columnStats']> = {}
  for (const column of columns) {
    if (!records.some((row) => toNumber(row[column]) != null)) continue
    const summary = columnStats(records, column)
    if (!summary) continue
    stats[column] = {
      mean: summary.mean,
      median: summary.median,
      min: summary.min,
      max: summary.max,
      n: summary.n,
    }
  }
  return Object.keys(stats).length ? stats : undefined
}

export const projectArtifactTablesForDesign = (
  document: PremiumReportDocument
): LeanDesignTable[] => {
  const tables: LeanDesignTable[] = []
  for (const block of document.blocks) {
    if (block.type !== 'table') continue
    const cells = tableHeatCells(block.option)
    const lean: LeanDesignTable = {
      id: `table_${tables.length + 1}`,
      title: block.title ?? `Table ${tables.length + 1}`,
      columns: block.columns,
      rows: block.rows.slice(0, DESIGN_TABLE_ROW_CAP),
      rowCount: block.rows.length,
    }
    if (cells) lean.cells = cells.slice(0, DESIGN_TABLE_ROW_CAP)
    const stats = tableColumnStats(block.columns, block.rows)
    if (stats) lean.columnStats = stats
    tables.push(lean)
  }
  return tables
}

const tableHeatCells = (
  option: Record<string, unknown> | undefined
): ArtifactTableSpec['cells'] => {
  if (!option || !Array.isArray(option.cells)) return undefined
  return option.cells.map((row) =>
    Array.isArray(row)
      ? row.map((cell) => {
          if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return undefined
          const background = (cell as { background?: unknown }).background
          return typeof background === 'string' && background.trim()
            ? { background: background.trim() }
            : undefined
        })
      : []
  )
}

const ensureHeadAsset = (html: string, tag: string, alreadyPresent: RegExp): string => {
  if (alreadyPresent.test(html)) return html
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`)
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${tag}</head>`)
  }
  return `<!DOCTYPE html><html><head>${tag}</head><body>${html}</body></html>`
}

const ensureBeforeBodyClose = (html: string, snippet: string): string => {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${snippet}\n</body>`)
  return `${html}\n${snippet}`
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const chartHostPresent = (html: string, chartId: string): boolean =>
  new RegExp(`\\bid=["']${escapeRegExp(chartId)}["']`, 'i').test(html)

export const migrateOrdinalChartHostsInHtml = (
  html: string,
  charts: ArtifactChartSpec[]
): { html: string; migrated: number } => {
  let next = html
  let migrated = 0
  charts.forEach((chart, index) => {
    const ordinal = `chart_${index + 1}`
    if (chart.id === ordinal) return
    if (chartHostPresent(next, chart.id)) return
    if (!chartHostPresent(next, ordinal)) return
    const from = escapeRegExp(ordinal)
    const to = chart.id
    next = next.replace(new RegExp(`\\bid=(["'])${from}\\1`, 'gi'), `id=$1${to}$1`)
    next = next.replace(
      new RegExp(`\\bdata-mauna-soft-chart=(["'])${from}\\1`, 'gi'),
      `data-mauna-soft-chart=$1${to}$1`
    )
    migrated += 1
  })
  return { html: next, migrated }
}

const artifactChartHostPresent = (
  html: string,
  chart: ArtifactChartSpec,
  index: number
): boolean => {
  if (chartHostPresent(html, chart.id)) return true
  const ordinalId = `chart_${index + 1}`
  if (ordinalId !== chart.id && chartHostPresent(html, ordinalId)) return true
  return false
}

export const countPresentChartHosts = (html: string, charts: ArtifactChartSpec[]): number =>
  charts.filter((chart, index) => artifactChartHostPresent(html, chart, index)).length

const countMissingChartHosts = (html: string, charts: ArtifactChartSpec[]): number =>
  charts.filter((chart, index) => !artifactChartHostPresent(html, chart, index)).length

export const listMissingArtifactChartHosts = (
  html: string,
  charts: ArtifactChartSpec[]
): string[] =>
  charts.filter((chart, index) => !artifactChartHostPresent(html, chart, index)).map((c) => c.id)

export const injectMissingChartHostShells = (
  html: string,
  charts: ArtifactChartSpec[]
): { html: string; injected: number } => {
  const missing = charts.filter((chart, index) => !artifactChartHostPresent(html, chart, index))
  if (missing.length === 0) return { html, injected: 0 }
  const cards = missing
    .map((chart) => {
      const title = escapeHtml(chart.title.trim() || chart.id)
      return `<article class="chart-card" data-mauna-soft-injected="1"><h3>${title}</h3><div id="${chart.id}" class="chart-box"></div></article>`
    })
    .join('\n')
  const section = `<section id="mauna-soft-chart-inject" data-mauna-soft-injected="1">\n${cards}\n</section>`
  if (/<\/body>/i.test(html)) {
    return { html: html.replace(/<\/body>/i, `${section}\n</body>`), injected: missing.length }
  }
  return { html: `${html}\n${section}`, injected: missing.length }
}

const proseBlocksDiffer = (
  document: PremiumReportDocument,
  priorDocument: PremiumReportDocument | null
): boolean => {
  if (!priorDocument) return false
  const priorById = new Map(priorDocument.blocks.map((block) => [block.id, block]))
  for (const block of document.blocks) {
    if (block.type !== 'heading' && block.type !== 'text') continue
    const prior = priorById.get(block.id)
    if (!prior || prior.type !== block.type) continue
    if (block.type === 'heading' && prior.type === 'heading') {
      if (prior.text.trim() !== block.text.trim()) return true
      continue
    }
    if (block.type === 'text' && prior.type === 'text') {
      if (prior.text.trim() !== block.text.trim()) return true
    }
  }
  return false
}

export type SoftRebindValidation = {
  ok: boolean
  missingHosts: string[]
  proseMiss: boolean
}

export const validateSoftRebindHtml = (args: {
  html: string
  charts: ArtifactChartSpec[]
  document: PremiumReportDocument
  priorDocument: PremiumReportDocument | null
  syncedProse: number
}): SoftRebindValidation => {
  const missingHosts = listMissingArtifactChartHosts(args.html, args.charts)
  const proseMiss = args.syncedProse === 0 && proseBlocksDiffer(args.document, args.priorDocument)
  return {
    ok: missingHosts.length === 0 && !proseMiss,
    missingHosts,
    proseMiss,
  }
}

const freeArtifactMissingAllChartHosts = (html: string, charts: ArtifactChartSpec[]): boolean =>
  charts.length >= 2 && countPresentChartHosts(html, charts) === 0

export const freeArtifactTooThinForCharts = (args: {
  chartCount: number
  injectedCharts: number
  presentHosts?: number
}): boolean => {
  if (args.chartCount < 3) return false
  const missing = args.presentHosts != null ? Math.max(0, args.chartCount - args.presentHosts) : 0
  const risk = Math.max(args.injectedCharts, missing)
  return risk >= Math.ceil(args.chartCount * 0.75)
}

const buildMinimalFreeArtifactShell = (args: {
  clubName: string
  title?: string
  message: string
  dateRange: { from: string; to: string }
}): string => {
  const title = escapeHtml(args.title?.trim() || 'Staff report')
  const club = escapeHtml(args.clubName.trim() || 'Club')
  const from = escapeHtml(args.dateRange.from)
  const to = escapeHtml(args.dateRange.to)
  const message = escapeHtml(args.message.trim() || 'No populated domain for this window.')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body>
<section class="page cover">
  <div class="cover-panel">
    <div class="brand">MAUNA</div>
    <div class="season">${club} · Staff</div>
    <h1 class="cover-title">${title}</h1>
    <div class="date-pill">${from} → ${to}</div>
    <div class="club-mark">Confidential · Staff only</div>
  </div>
</section>
<main class="report-flow">
  <section class="section-block" data-mauna-empty-coverage="1">
    <div class="band"><h2>Coverage</h2><span class="meta">Empty</span></div>
    <p class="prose">${message}</p>
    <div class="callout">${message}</div>
  </section>
  <footer class="report-footer"><span>MAUNA · Staff</span><span>${club}</span></footer>
</main>
</body>
</html>`
}

const stripCoverBlurb = (html: string): string =>
  html.replace(/<p\b[^>]*class=["'][^"']*cover-sub[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, '')

const FAKE_SECTION_HEAD = String.raw`(?:Outstanding analysis|Data availability|Additional requests|Coming soon|Next steps?|Pending data|No data available|Not in scope|Limitations?|Scope notes?|Filler|Placeholder)`

const FAKE_HEADING_OPEN = String.raw`<h[1-4]\b[^>]*>\s*(?:<[^>]+>\s*)*${FAKE_SECTION_HEAD}\b(?:(?!<\/h[1-4]>)[\s\S])*?<\/h[1-4]>`

const FAKE_SECTION_BLOCK_RE = new RegExp(
  String.raw`<(section|article)\b[^>]*>(?:(?!<\/?(?:section|article)\b|<h[1-4]\b)[\s\S])*?${FAKE_HEADING_OPEN}(?:(?!<\/?(?:section|article)\b)[\s\S])*?<\/\1>`,
  'gi'
)

const FAKE_HEADING_RUN_RE = new RegExp(
  String.raw`${FAKE_HEADING_OPEN}[\s\S]*?(?=<h[1-4]\b|<\/?(?:section|article|main|body)\b|<footer\b|<script\b|$)`,
  'gi'
)

const stripFakeUnavailableSections = (html: string): string =>
  html.replace(FAKE_SECTION_BLOCK_RE, '').replace(FAKE_HEADING_RUN_RE, '')

const styledChartHost = (id: string, title: string): string =>
  `<article class="chart-card" data-mauna-soft-chart="${escapeHtml(id)}">
  <h3>${escapeHtml(title.trim() || id)}</h3>
  <div class="chart-box" id="${escapeHtml(id)}" style="width:100%;height:280px"></div>
</article>`

const foldHeader = (value: string): string =>
  foldKey(foldAscii(value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')))

const htmlTableMatchesSpec = (tableHtml: string, spec: ArtifactTableSpec): boolean => {
  if (new RegExp(`id=["']${spec.id}["']`, 'i').test(tableHtml)) return true
  const headerRow = tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] ?? ''
  const headers = [...headerRow.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    foldHeader(m[1] ?? '')
  )
  const wanted = spec.columns.map(foldHeader).filter(Boolean)
  if (wanted.length === 0 || headers.length === 0) return false
  const hits = wanted.filter((col) =>
    headers.some((h) => h === col || h.includes(col) || col.includes(h))
  )
  return hits.length >= Math.max(2, Math.ceil(wanted.length * 0.5))
}

const heatClassForBackground = (background: string): string => {
  const hex = background.replace(/\s/g, '').toLowerCase()
  if (/#e07070|#9f1239|#fca5a5|#fecaca/.test(hex)) return 'lvl-hi'
  if (/#f5d0a9|#fcd34d|#fbbf24|#92400e/.test(hex)) return 'lvl-mid'
  if (/#2f9e6f|#34d399|#16a34a|#c8e6d5|#a8d5c2|#86efac/.test(hex)) return 'lvl-lo'
  return 'lvl-lo'
}

const paintTdOpen = (open: string, background: string): string => {
  const cls = heatClassForBackground(background)
  let next = open
  if (!/\bdata-mauna-heat=/.test(next)) {
    next = next.replace(/<td\b/i, '<td data-mauna-heat="1"')
  }
  if (!/\blvl-(hi|mid|lo)\b/.test(next)) {
    if (/\bclass=(["'])/.test(next)) {
      next = next.replace(/\bclass=(["'])/, `class=$1${cls} `)
    } else {
      next = next.replace(/<td\b/i, `<td class="${cls}"`)
    }
  }
  const bgDecl = `background:${background} !important`
  if (/\bstyle=(["'])/.test(next)) {
    next = next.replace(/\bstyle=(["'])([\s\S]*?)\1/, (_m, q: string, css: string) => {
      const cleaned = css
        .replace(/background[^;]*;?/gi, '')
        .replace(/(?:^|;)\s*color\s*:[^;]*/gi, '')
        .replace(/(?:^|;)\s*font-weight\s*:[^;]*/gi, '')
        .replace(/^;+|;+$/g, '')
        .trim()
      const joined = cleaned ? `${cleaned};${bgDecl}` : bgDecl
      return `style=${q}${joined}${q}`
    })
  } else {
    next = next.replace(/<td\b/i, `<td style="${bgDecl}"`)
  }
  return next
}

const paintOneHtmlTable = (
  tableHtml: string,
  spec: ArtifactTableSpec
): { html: string; painted: number } => {
  const cells = spec.cells
  if (!cells?.some((row) => row.some((cell) => cell?.background))) {
    return { html: tableHtml, painted: 0 }
  }
  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
  if (rows.length === 0) return { html: tableHtml, painted: 0 }
  let painted = 0
  let dataIndex = 0
  const next = tableHtml.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (tr) => {
    if (/<th\b/i.test(tr) && dataIndex === 0) return tr
    const rowCells = cells[dataIndex]
    dataIndex += 1
    if (!rowCells) return tr
    let col = 0
    return tr.replace(/<td\b[^>]*>[\s\S]*?<\/td>/gi, (td) => {
      const bg = rowCells[col]?.background
      col += 1
      if (!bg) return td
      painted += 1
      return td.replace(/<td\b[^>]*>/i, (open) => paintTdOpen(open, bg))
    })
  })
  return { html: next, painted }
}

const pickTableSpecForHtml = (
  tableHtml: string,
  index: number,
  tables: ArtifactTableSpec[],
  foundCount: number,
  used: Set<number>
): ArtifactTableSpec | undefined => {
  const byId = tables.find((spec) => new RegExp(`id=["']${spec.id}["']`, 'i').test(tableHtml))
  if (byId) return byId
  if (foundCount === tables.length) return tables[index]
  return tables.find((spec, i) => !used.has(i) && htmlTableMatchesSpec(tableHtml, spec))
}

const renderArtifactTableHtml = (spec: ArtifactTableSpec): string => {
  const head = spec.columns.map((col) => `<th>${escapeHtml(String(col ?? ''))}</th>`).join('')
  const body = spec.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => {
          const bg = spec.cells?.[rowIndex]?.[colIndex]?.background
          const open = bg ? paintTdOpen('<td>', bg) : '<td>'
          const text = value == null ? '' : String(value)
          return `${open}${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return `<table class="report-table" id="${escapeHtml(spec.id)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

export const syncTablesIntoArtifactHtml = (
  html: string,
  tables: ArtifactTableSpec[]
): { html: string; synced: number } => {
  if (tables.length === 0) return { html, synced: 0 }
  const found = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0])
  if (found.length === 0) return { html, synced: 0 }
  const used = new Set<number>()
  let synced = 0
  let cursor = 0
  const next = html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    const spec = pickTableSpecForHtml(tableHtml, cursor, tables, found.length, used)
    cursor += 1
    if (!spec) return tableHtml
    const specIndex = tables.indexOf(spec)
    if (specIndex >= 0) used.add(specIndex)
    synced += 1
    return renderArtifactTableHtml(spec)
  })
  return { html: next, synced }
}

const replaceTaggedText = (
  html: string,
  tag: string,
  before: string,
  after: string,
  flexibleWhitespace: boolean
): string => {
  const escaped = escapeRegExp(escapeHtml(before))
  const body = flexibleWhitespace ? escaped.replace(/\s+/g, '\\s+') : escaped
  const pattern = new RegExp(`(<${tag}\\b[^>]*>)\\s*${body}\\s*(</${tag}>)`, 'i')
  return html.replace(pattern, `$1${escapeHtml(after)}$2`)
}

export const syncProseIntoArtifactHtml = (
  html: string,
  document: PremiumReportDocument,
  priorDocument: PremiumReportDocument | null
): { html: string; synced: number } => {
  if (!priorDocument) return { html, synced: 0 }
  const priorById = new Map(priorDocument.blocks.map((block) => [block.id, block]))
  let next = html
  let synced = 0
  for (const block of document.blocks) {
    const prior = priorById.get(block.id)
    if (!prior || prior.type !== block.type) continue
    if (block.type === 'heading' && prior.type === 'heading') {
      const before = prior.text.trim()
      const after = block.text.trim()
      if (!before || !after || before === after) continue
      const tag = block.level === 2 ? 'h3' : 'h2'
      const replaced = replaceTaggedText(next, tag, before, after, false)
      if (replaced !== next) {
        next = replaced
        synced += 1
      }
      continue
    }
    if (block.type === 'text' && prior.type === 'text') {
      const before = prior.text.trim()
      const after = block.text.trim()
      if (!before || !after || before === after) continue
      const replaced = replaceTaggedText(next, 'p', before, after, true)
      if (replaced !== next) {
        next = replaced
        synced += 1
      }
    }
  }
  return { html: next, synced }
}

const proseHtmlForBlock = (block: {
  type: string
  text?: string
  level?: number | null
}): string => {
  const text = escapeHtml((block.text ?? '').trim())
  if (!text) return ''
  if (block.type === 'heading') {
    const tag = block.level === 2 ? 'h3' : 'h2'
    return `<${tag} data-mauna-soft-prose="1">${text}</${tag}>`
  }
  return `<p class="section-intro" data-mauna-soft-prose="1">${text}</p>`
}

const looksLikeAthleteName = (value: string): boolean => {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length < 5 || cleaned.length > 60) return false
  if (
    /performance|injury|score|wellness|sleep|gps|distance|radar|scatter|team|moyenne/i.test(cleaned)
  ) {
    return false
  }
  const parts = cleaned.split(/\s+/).filter(Boolean)
  return parts.length >= 2 && parts.every((part) => /^[A-ZÀ-ÖØ-Þ]/.test(part) || part.includes("'"))
}

const groupCanvasIntoAthleteSheets = (document: PremiumReportDocument) => {
  const sheets: Array<{
    athlete: string
    headingId?: string
    chartIds: string[]
    texts: string[]
  }> = []
  let current: (typeof sheets)[number] | null = null
  for (const block of document.blocks) {
    if (block.type === 'heading' && looksLikeAthleteName(block.text ?? '')) {
      current = { athlete: block.text.trim(), headingId: block.id, chartIds: [], texts: [] }
      sheets.push(current)
      continue
    }
    if (block.type === 'chart') {
      const title = block.title ?? ''
      const hostId = artifactChartHostId(block.id)
      const matched = sheets.find((sheet) =>
        foldAscii(title).includes(
          foldAscii(sheet.athlete)
            .split(/\s+/)
            .filter((p) => p.length >= 4)
            .join(' ')
        )
      )
      if (matched) {
        matched.chartIds.push(hostId)
        current = matched
      } else if (current) {
        current.chartIds.push(hostId)
      }
      continue
    }
    if (block.type === 'text' && current && (block.text ?? '').trim()) {
      current.texts.push(block.text.trim())
    }
  }
  return sheets.filter((sheet) => sheet.chartIds.length > 0 || Boolean(sheet.headingId))
}

export const rebuildAthleteSheetsInArtifactHtml = (
  html: string,
  document: PremiumReportDocument
): { html: string; sections: number } => {
  const sheets = groupCanvasIntoAthleteSheets(document)
  if (sheets.length < 2) return { html, sections: 0 }

  const usedHosts = new Set(sheets.flatMap((sheet) => sheet.chartIds))
  let next = html
  next = next.replace(
    /<article\b[^>]*id=["']mauna-soft-additive["'][^>]*>[\s\S]*?<\/article>/gi,
    ''
  )
  next = next.replace(
    /<section\b[^>]*id=["']mauna-soft-chart-inject["'][^>]*>[\s\S]*?<\/section>/gi,
    ''
  )
  next = next.replace(
    /<(article|div)\b([^>]*(?:chart-card|data-mauna-soft-chart|data-mauna-soft-injected|\bcard\b)[^>]*)>([\s\S]*?)<\/\1>/gi,
    (card) => {
      const id = card.match(/\bid=["'](chart_[a-zA-Z0-9]+)["']/i)?.[1]
      if (id && usedHosts.has(id)) return ''
      return card
    }
  )
  for (const hostId of usedHosts) {
    const esc = hostId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    next = next.replace(
      new RegExp(
        `<div\\b[^>]*\\bid=["']${esc}["'][^>]*\\bchart-box\\b[^>]*>[\\s\\S]*?<\\/div>`,
        'gi'
      ),
      ''
    )
    next = next.replace(
      new RegExp(
        `<div\\b[^>]*\\bchart-box\\b[^>]*\\bid=["']${esc}["'][^>]*>[\\s\\S]*?<\\/div>`,
        'gi'
      ),
      ''
    )
  }

  const sectionsHtml = sheets
    .map((sheet, index) => {
      const cards = sheet.chartIds
        .map((hostId) => {
          const block = document.blocks.find(
            (row) => row.type === 'chart' && artifactChartHostId(row.id) === hostId
          )
          const title =
            block && block.type === 'chart' ? block.title?.trim() || sheet.athlete : sheet.athlete
          return styledChartHost(
            hostId,
            title.includes(sheet.athlete) ? title : `${sheet.athlete} — ${title}`
          )
        })
        .join('\n')
      const captions = sheet.texts
        .map((text) => `<p class="section-intro" data-mauna-soft-prose="1">${escapeHtml(text)}</p>`)
        .join('\n')
      return `<article class="section-block" id="athlete-sheet-${index + 1}" data-mauna-athlete-sheet="1">
  <div class="band"><h2>${escapeHtml(sheet.athlete)}</h2></div>
  ${captions}
  ${cards}
</article>`
    })
    .join('\n')

  if (/<\/main>/i.test(next)) {
    next = next.replace(/<\/main>/i, `${sectionsHtml}\n</main>`)
  } else {
    next = ensureBeforeBodyClose(next, sectionsHtml)
  }
  return { html: next, sections: sheets.length }
}

const tableSpecFromBlock = (
  block: {
    id: string
    title?: string | null
    columns: string[]
    rows: Array<Array<string | number | null>>
    option?: Record<string, unknown>
  },
  ordinal: number
): ArtifactTableSpec => ({
  id: `table_${ordinal}`,
  title: block.title ?? `Table ${ordinal}`,
  columns: block.columns,
  rows: block.rows.slice(0, 40),
  cells: tableHeatCells(block.option),
})

const wrapSoftTableHtml = (spec: ArtifactTableSpec): string =>
  `<div class="card" data-mauna-soft-table="1">
  ${spec.title ? `<p class="section-intro">${escapeHtml(spec.title)}</p>` : ''}
  ${renderArtifactTableHtml(spec)}
</div>`

export const injectNewSoftBlocksIntoArtifactHtml = (
  html: string,
  document: PremiumReportDocument,
  priorBlockIds: Set<string>,
  opts?: { underEachChart?: boolean }
): {
  html: string
  injectedProse: number
  injectedSections: number
  injectedTables: number
} => {
  const newHeadings = document.blocks.filter(
    (b) => b.type === 'heading' && !priorBlockIds.has(b.id) && (b.text ?? '').trim().length > 0
  )
  const newTexts = document.blocks.filter(
    (b) => b.type === 'text' && !priorBlockIds.has(b.id) && (b.text ?? '').trim().length > 0
  )
  const newCharts = document.blocks.filter((b) => b.type === 'chart' && !priorBlockIds.has(b.id))
  const newTables = document.blocks.filter(
    (b) =>
      b.type === 'table' && !priorBlockIds.has(b.id) && b.columns.length > 0 && b.rows.length > 0
  )
  if (
    newHeadings.length === 0 &&
    newTexts.length === 0 &&
    newCharts.length === 0 &&
    newTables.length === 0
  ) {
    return { html, injectedProse: 0, injectedSections: 0, injectedTables: 0 }
  }

  let next = html
  let injectedProse = 0
  let injectedSections = 0
  let injectedTables = 0

  if (opts?.underEachChart && newTexts.length > 0) {
    const cards = [
      ...next.matchAll(
        /<article\b[^>]*class=["'][^"']*chart-card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi
      ),
    ]
    let textIndex = 0
    next = next.replace(
      /<article\b[^>]*class=["'][^"']*chart-card[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
      (card) => {
        if (/data-mauna-soft-prose=["']1["']/i.test(card)) return card
        const prose = proseHtmlForBlock(newTexts[Math.min(textIndex, newTexts.length - 1)]!)
        textIndex += 1
        if (!prose) return card
        injectedProse += 1
        return `${card}\n${prose}`
      }
    )
    if (cards.length === 0) {
      for (const block of newTexts) {
        const prose = proseHtmlForBlock(block)
        if (!prose) continue
        next = next.replace(
          /(<\/div>\s*)(<\/article>|<\/section>|<\/main>)/i,
          (_m, closeDiv: string, closeParent: string) => {
            injectedProse += 1
            return `${closeDiv}${prose}\n${closeParent}`
          }
        )
      }
    }
  } else if (newTexts.length > 0) {
    const sectionRe =
      /<(article|section)\b([^>]*\bclass=["'][^"']*\bsection-block\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi
    const sections = [...next.matchAll(sectionRe)]
    if (sections.length > 0) {
      let i = 0
      next = next.replace(sectionRe, (full, tag: string, attrs: string, inner: string) => {
        if (i >= newTexts.length) return full
        if (/data-mauna-soft-prose=["']1["']/i.test(inner)) {
          i += 1
          return full
        }
        const prose = proseHtmlForBlock(newTexts[i]!)
        i += 1
        if (!prose) return full
        injectedProse += 1
        return `<${tag}${attrs}>${inner}\n${prose}</${tag}>`
      })
    } else {
      for (const block of newTexts) {
        const prose = proseHtmlForBlock(block)
        if (!prose) continue
        next = ensureBeforeBodyClose(next, prose)
        injectedProse += 1
      }
    }
  }

  const athleteHeadings = newHeadings.filter(
    (b) => b.type === 'heading' && looksLikeAthleteName(b.text ?? '')
  )
  if (athleteHeadings.length >= 2 && newCharts.length > 0) {
    const rebuilt = rebuildAthleteSheetsInArtifactHtml(next, document)
    return {
      html: rebuilt.html,
      injectedProse,
      injectedSections: rebuilt.sections || athleteHeadings.length,
      injectedTables: 0,
    }
  }

  const priorTableCount = document.blocks.filter(
    (b) => b.type === 'table' && priorBlockIds.has(b.id)
  ).length
  const tableHtmlParts = newTables
    .filter(
      (block): block is Extract<(typeof document.blocks)[number], { type: 'table' }> =>
        block.type === 'table'
    )
    .map((block, index) => {
      const spec = tableSpecFromBlock(block, priorTableCount + index + 1)
      return wrapSoftTableHtml(spec)
    })

  if (newHeadings.length > 0 || newCharts.length > 0 || tableHtmlParts.length > 0) {
    const chartCards = newCharts
      .map((block) => {
        if (block.type !== 'chart') return ''
        const hostId = artifactChartHostId(block.id)
        if (new RegExp(`id=["']${hostId}["']`, 'i').test(next)) return ''
        return styledChartHost(hostId, block.title ?? hostId)
      })
      .filter(Boolean)
    const extraHeadings = newHeadings
      .slice(1)
      .map((block) => proseHtmlForBlock(block))
      .filter(Boolean)
    let firstHeading = 'Added section'
    if (newHeadings[0]?.type === 'heading') {
      firstHeading = newHeadings[0].text.trim() || firstHeading
    } else if (newTables[0]?.type === 'table') {
      firstHeading = (newTables[0].title ?? '').trim() || firstHeading
    } else if (newCharts.length > 0) {
      firstHeading = 'Individual sheets'
    }
    if (newHeadings.length > 0 || chartCards.length > 0 || tableHtmlParts.length > 0) {
      const section = `<article class="section-block" id="mauna-soft-additive" data-mauna-soft-injected="1">
  <div class="band"><h2>${escapeHtml(firstHeading || 'Added section')}</h2></div>
  ${extraHeadings.join('\n')}
  ${tableHtmlParts.join('\n')}
  ${chartCards.join('\n')}
</article>`
      if (/<\/main>/i.test(next)) {
        next = next.replace(/<\/main>/i, `${section}\n</main>`)
      } else {
        next = ensureBeforeBodyClose(next, section)
      }
      injectedSections += 1
      injectedProse += newHeadings.length > 0 ? 1 + extraHeadings.length : 0
      injectedTables += tableHtmlParts.length
    }
  }

  return { html: next, injectedProse, injectedSections, injectedTables }
}

export const extractArtifactBootChartIds = (html: string): string[] => {
  const boot = html.match(
    /<script\b[^>]*id=["']mauna-artifact-boot["'][^>]*>[\s\S]*?<\/script>/i
  )?.[0]
  if (!boot) return []
  return [
    ...new Set(
      [...boot.matchAll(/"id"\s*:\s*"(chart_[a-zA-Z0-9]+)"/g)]
        .map((match) => match[1]!)
        .filter(Boolean)
    ),
  ]
}

export const pruneOrphanChartHostsInHtml = (
  html: string,
  charts: Array<Pick<ArtifactChartSpec, 'id'>>
): { html: string; pruned: number } => {
  const keep = new Set(charts.map((chart) => chart.id))
  const seen = new Set<string>()
  const slots: string[] = []
  let pruned = 0

  const takeOrDrop = (chunk: string): string => {
    const id = chunk.match(/\bid=["'](chart_[a-zA-Z0-9_-]+)["']/i)?.[1]
    if (!id || !keep.has(id) || seen.has(id)) {
      pruned += 1
      return ''
    }
    seen.add(id)
    const index = slots.length
    slots.push(chunk)
    return `\0MAUNA_HOST_${index}\0`
  }

  let next = html.replace(
    /<article\b[^>]*(?:class=["'][^"']*\bchart-card\b[^"']*["']|data-mauna-soft-chart=)[^>]*>[\s\S]*?<\/article>/gi,
    (article) => takeOrDrop(article)
  )
  next = next.replace(
    /<div\b[^>]*\bclass=["'](?![^"']*\bchart-card\b)[^"']*(?<![-\w])card(?![-\w])[^"']*["'][^>]*>\s*<div\b[^>]*\bchart-box\b[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi,
    (card) => takeOrDrop(card)
  )
  next = next.replace(/<div\b[^>]*\bchart-box\b[^>]*>[\s\S]*?<\/div>/gi, (block) =>
    takeOrDrop(block)
  )
  next = next.replace(/\0MAUNA_HOST_(\d+)\0/g, (_m, index: string) => slots[Number(index)] ?? '')
  return { html: next, pruned }
}

const paintHeatedTablesInArtifactHtml = (
  html: string,
  tables: ArtifactTableSpec[]
): { html: string; painted: number; tables: number } => {
  const heated = tables.filter((t) => t.cells?.some((row) => row.some((cell) => cell?.background)))
  if (heated.length === 0) return { html, painted: 0, tables: 0 }
  const found = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((m) => m[0])
  if (found.length === 0) return { html, painted: 0, tables: 0 }

  const used = new Set<number>()
  let painted = 0
  let tablesHit = 0
  let cursor = 0
  const next = html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    const spec = pickTableSpecForHtml(tableHtml, cursor, heated, found.length, used)
    cursor += 1
    if (!spec) return tableHtml
    const specIndex = heated.indexOf(spec)
    if (specIndex >= 0) used.add(specIndex)
    const result = paintOneHtmlTable(tableHtml, spec)
    if (result.painted > 0) {
      painted += result.painted
      tablesHit += 1
    }
    return result.html
  })
  return { html: next, painted, tables: tablesHit }
}

export const synthesizeCoachBrief = (prompt: string): string => {
  const cleaned = prompt
    .replace(/\s+/g, ' ')
    .replace(/(?:^|\s)\d+[\)\.\:]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const beforeList = cleaned.split(/\s*(?:1\)|1\.)\s*/)[0]?.trim() ?? ''
  if (beforeList.length >= 24 && beforeList.length <= 220 && !/\d+[\)\.]\s/.test(beforeList)) {
    return beforeList
  }
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? []
  let out = ''
  for (const sentence of sentences.slice(0, 2)) {
    const next = `${out}${sentence}`.trim()
    if (next.length > 220) break
    out = next
  }
  if (out.length >= 24) return out
  return cleaned.slice(0, 220)
}

const briefPlainText = (htmlChunk: string): string =>
  htmlChunk
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const coachBriefLooksLikeRawPrompt = (briefHtml: string, prompt?: string): boolean => {
  const plain = briefPlainText(briefHtml)
  if (!plain) return false
  if (/\b1\s*[\)\.\:]/.test(plain) && /\b2\s*[\)\.\:]/.test(plain)) return true
  if (/\b(?:TODO|FORBIDDEN|REQUIRED|get_design_context|set_report_html)\b/i.test(plain)) return true
  const src = prompt?.replace(/\s+/g, ' ').trim()
  if (!src) return plain.length > 280
  if (plain.length >= 160 && plain.length >= src.length * 0.55) return true
  const head = foldAscii(src).slice(0, 80)
  const body = foldAscii(plain)
  return head.length >= 40 && body.includes(head) && plain.length > 140
}

const coachBriefBlock = (body: string, language: AppLanguage): string => {
  const label = language === 'fr' ? 'Brief coach' : 'Coach brief'
  return `<aside class="coach-brief" id="coach-brief" data-mauna-coach-brief="1" style="border:1px solid #e2e8f0;border-left:3px solid #4f6ef7;border-radius:8px;padding:10px 12px;margin:0 0 12px;background:#f8fafc">
  <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">${label}</p>
  <blockquote style="margin:0;font-size:12px;line-height:1.45;white-space:pre-wrap;font-style:normal;color:#334155">${escapeHtml(body)}</blockquote>
</aside>`
}

const ensureCoachBriefInHtml = (
  html: string,
  coachPrompt: string | undefined,
  language: AppLanguage = 'fr'
): { html: string; injected: boolean; scrubbed: boolean } => {
  const prompt = coachPrompt?.trim()
  const briefRe =
    /<(aside|section|div)\b[^>]*(?:data-mauna-coach-brief=["']1["']|class=["'][^"']*coach-brief[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi
  let scrubbed = false
  const next = html.replace(briefRe, (block) => {
    if (!coachBriefLooksLikeRawPrompt(block, prompt)) return block
    scrubbed = true
    const synthesis = prompt ? synthesizeCoachBrief(prompt) : ''
    if (!synthesis) return ''
    return coachBriefBlock(synthesis, language)
  })
  return { html: next, injected: false, scrubbed }
}

const ensureMaunaWatermarkInHtml = (html: string): string => {
  let next = html
  if (!/id=["']mauna-watermark-css["']/i.test(next) && !/\.mauna-page-watermark\s*\{/.test(next)) {
    next = ensureHeadAsset(
      next,
      `<style id="mauna-watermark-css">${maunaWatermarkCss()}</style>`,
      /id=["']mauna-watermark-css["']/i
    )
  }
  if (!/class=["'][^"']*mauna-page-watermark/.test(next)) {
    if (/<body[^>]*>/i.test(next)) {
      next = next.replace(/<body([^>]*)>/i, (open) => `${open}\n${maunaWatermarkImgTag()}`)
    } else {
      next = `${maunaWatermarkImgTag()}\n${next}`
    }
  }
  return next
}

const stripBase64AthletePhotosFromHtml = (html: string): string =>
  html.replace(/<img\b[^>]*src=["']data:image\/[^"']+["'][^>]*>/gi, '')

export const finalizeArtifactHtml = (args: {
  html: string
  charts: ArtifactChartSpec[]
  pack: ReportDesignPack
  coachPrompt?: string
  language?: AppLanguage
  tables?: ArtifactTableSpec[]
  injectMissingHosts?: boolean
  facts?: Map<string, ReportFact> | Iterable<ReportFact>
}): FinalizeArtifactResult => {
  const warnings: string[] = []
  let html = args.html.trim()
  if (html.length < ARTIFACT_MIN_HTML_BYTES) {
    return { ok: false, error: `html too short (<${ARTIFACT_MIN_HTML_BYTES})`, warnings }
  }
  if (html.length > REPORT_V4_MAX_HTML_BYTES) {
    return { ok: false, error: 'html too large', warnings }
  }
  if (!/<html[\s>]/i.test(html)) {
    return { ok: false, error: 'html must include <html>', warnings }
  }

  html = stripBase64AthletePhotosFromHtml(html)

  const migratedHosts = migrateOrdinalChartHostsInHtml(html, args.charts)
  html = migratedHosts.html
  if (migratedHosts.migrated > 0) {
    warnings.push(`migrated_${migratedHosts.migrated}_ordinal_chart_hosts`)
  }

  const prunedHosts = pruneOrphanChartHostsInHtml(html, args.charts)
  html = prunedHosts.html
  if (prunedHosts.pruned > 0) {
    warnings.push(`pruned_${prunedHosts.pruned}_orphan_chart_hosts`)
  }

  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) => {
    if (/echarts@5\.5\.1/i.test(block) || /id=["']mauna-artifact-boot["']/i.test(block)) {
      return block
    }
    warnings.push('stripped_foreign_script')
    return ''
  })

  html = ensureHeadAsset(
    html,
    `<link href="${args.pack.fonts.googleHref}" rel="stylesheet" />`,
    /fonts\.googleapis\.com/i
  )
  html = ensureHeadAsset(html, echartsCdnScriptTag(), /echarts@5\.5\.1/i)
  const packCss = buildReportPackCss(args.pack)
  const packSheet = `<style id="mauna-pack-css" data-pack="${args.pack.id}">${packCss}</style>`
  if (/id=["']mauna-pack-css["']/i.test(html)) {
    html = html.replace(/<style id=["']mauna-pack-css["'][^>]*>[\s\S]*?<\/style>/i, packSheet)
  } else {
    html = ensureHeadAsset(html, packSheet, /id=["']mauna-pack-css["']/i)
  }
  const printCss = buildReportPrintCss()
  html = ensureHeadAsset(
    html,
    `<style id="mauna-print-css">${printCss}</style>`,
    /id=["']mauna-print-css["']/i
  )

  const brief = ensureCoachBriefInHtml(html, args.coachPrompt, args.language ?? 'fr')
  html = brief.html
  if (brief.scrubbed) warnings.push('scrubbed_coach_brief_echo')

  const presentHosts = countPresentChartHosts(html, args.charts)
  const missing = countMissingChartHosts(html, args.charts)
  if (freeArtifactMissingAllChartHosts(html, args.charts)) {
    return {
      ok: false,
      error: `html missing all chart hosts (${args.charts.length} required: ${args.charts.map((c) => c.id).join(', ')})`,
      warnings,
    }
  }

  const injectMissingHosts = Boolean(args.injectMissingHosts)
  if (missing > 0 && injectMissingHosts) {
    warnings.push(`injected_${missing}_chart_hosts`)
  } else if (missing > 0) {
    warnings.push(`missing_${missing}_chart_hosts`)
  }

  html = html.replace(/<script id=["']mauna-artifact-boot["']>[\s\S]*?<\/script>/i, '')
  html = ensureBeforeBodyClose(
    html,
    buildEchartsBootScript({
      charts: args.charts,
      theme: {
        palette: args.pack.palette,
        fontFamily: args.pack.fonts.body,
        ink: args.pack.tokens.ink,
      },
      injectMissingHosts,
      stripLineSymbols: true,
    })
  )

  if (!/dataset\.chartsReady|chartsReady/i.test(html)) {
    return { ok: false, error: 'chart boot missing chartsReady', warnings }
  }

  html = html.replace(/<html(\s[^>]*)?>/i, (m) =>
    m.includes('data-artifact=') ? m : m.replace('<html', '<html data-artifact="free"')
  )
  html = ensureMaunaWatermarkInHtml(html)
  html = stripCoverBlurb(html)
  html = stripFakeUnavailableSections(html)
  if (args.tables?.length) {
    const painted = paintHeatedTablesInArtifactHtml(html, args.tables)
    html = painted.html
    if (painted.painted > 0) warnings.push(`painted_${painted.painted}_heat_cells`)
  }

  if (args.facts) {
    const injected = injectDataFactsInHtml({
      html,
      facts: args.facts,
      language: args.language ?? 'en',
    })
    html = injected.html
    if (injected.filled > 0) warnings.push(`filled_${injected.filled}_data_facts`)
    if (injected.missing.length > 0) {
      warnings.push(`missing_data_facts:${injected.missing.slice(0, 8).join(',')}`)
    }
  }

  return {
    ok: true,
    html,
    injectedCharts: injectMissingHosts ? missing : 0,
    presentHosts,
    warnings,
  }
}

export const finalizeMinimalEmptyArtifact = (args: {
  clubName: string
  title?: string
  message: string
  dateRange: { from: string; to: string }
  pack: ReportDesignPack
  language?: AppLanguage
}): FinalizeArtifactResult =>
  finalizeArtifactHtml({
    html: buildMinimalFreeArtifactShell(args),
    charts: [],
    pack: args.pack,
    language: args.language,
    injectMissingHosts: false,
  })

export const artifactHtmlLooksValid = (html: string | null | undefined): boolean => {
  if (!html || html.length < ARTIFACT_MIN_HTML_BYTES) return false
  if (!/<html[\s>]/i.test(html)) return false
  return /chartsReady|mauna-artifact-boot/i.test(html)
}

const RECO_HEAD = String.raw`(?:recommendations?|recommandations?|conseils?(?:\s+d['’]?entrainement)?)`
const RECO_START_RE = new RegExp(`^${RECO_HEAD}\\b`, 'i')
const RECO_STRONG_RE = new RegExp(`<strong\\b[^>]*>\\s*${RECO_HEAD}\\s*:?\\s*</strong>`, 'i')
const RECO_INLINE_RE = new RegExp(
  `<strong\\b[^>]*>\\s*${RECO_HEAD}\\s*:?\\s*</strong>\\s*[^<]*(?:<br\\s*/?>)?`,
  'gi'
)

const plainStartsWithReco = (htmlChunk: string): boolean =>
  RECO_START_RE.test(
    htmlChunk
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )

export const stripRecommendationSectionsFromHtml = (
  html: string
): { html: string; stripped: number } => {
  let stripped = 0
  let next = html.replace(
    /<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (full, _tag: string, body: string) => {
      if (!RECO_STRONG_RE.test(body) && !plainStartsWithReco(body)) return full
      stripped += 1
      return ''
    }
  )
  next = next.replace(RECO_INLINE_RE, () => {
    stripped += 1
    return ''
  })
  return { html: next.replace(/\n{3,}/g, '\n\n'), stripped }
}

export const stripRecommendationSectionsFromDocument = (
  document: PremiumReportDocument
): number => {
  let stripped = 0
  const recoLine = new RegExp(
    `(^|\\n)\\s*${RECO_HEAD}\\s*:?[\\s\\S]*?(?=(\\n\\s*(?:risk\\s*level|primary\\s*concerns|niveau\\s*de\\s*risque|pr[eé]occupations?)\\b)|$)`,
    'gi'
  )
  for (const block of document.blocks) {
    if (block.type !== 'text' && block.type !== 'heading') continue
    const before = block.text
    const after = before
      .replace(recoLine, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (after !== before.trim()) {
      block.text = after
      stripped += 1
    }
  }
  return stripped
}
