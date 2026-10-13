import type { PremiumReportBlock, PremiumReportDocument } from '#contracts/premium_report'
import {
  escapeHtml,
  foldKey,
  REPORT_V4_BAR_CHUNK_HORIZONTAL,
  REPORT_V4_BAR_CHUNK_VERTICAL,
  REPORT_V4_CHART_CHUNK,
  REPORT_V4_COUNT_SERIES_RE,
  REPORT_V4_DISTANCE_SERIES_RE,
  REPORT_V4_DISTANCE_TITLE_RE,
  REPORT_V4_SCORE_RATING_SERIES_RE,
} from '#services/report_v4/report_v4_constants'
import {
  asEchartsOption,
  isTeamAggregateSeriesName,
  maybeAppendSquadRangeBand,
} from '#services/premium_report/chart_presets'
import { resolveBarOrientation } from '#services/premium_report/charts/echarts_options'
import { balancedChunks } from '#services/premium_report/charts/dataset_transforms'
import {
  resolveReportDesignPack,
  type ReportDesignPack,
} from '#services/report_v4/design/report_design_pack'
import {
  buildClubTemplateExtraCss,
  buildReportPackCss,
} from '#services/report_v4/design/report_pack_css'
import { buildEchartsBootScript, echartsCdnScriptTag } from '#services/report_v4/echarts_boot'
import { artifactChartHostId, synthesizeCoachBrief } from '#services/report_v4/artifact_html'
import { prepareReportV4Document } from '#services/report_v4/document_prep'
import type { ReportBrief } from '#services/report_v4/report_brief'
import { maunaWatermarkCss, maunaWatermarkImgTag } from '#services/report_v4/mauna_watermark'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import {
  renderClubInsightScienceStaffPanel,
  type ClubInsightScience,
} from '#services/report_v4/club_insight_science'

export { prepareReportV4Document }

export type ClubHtmlReportMeta = {
  clubName: string
  language: 'fr' | 'en'
  populatedDomains: string[]
  emptyDomains: string[]
  title?: string
  designPackId?: string
  roster?: RosterAthlete[]
  reportBrief?: ReportBrief | null
  coachPrompt?: string
  clubInsightScience?: ClubInsightScience[]
}

type ChartSpec = { id: string; title: string; option: Record<string, unknown> }
type TocItem = { id: string; label: string; pageHint: string; athleteName?: string }

type ClubHtmlRenderCtx = {
  pack: ReportDesignPack
  forceTableHeat: boolean
  levelLegendShown: boolean
}

type LayoutPiece = {
  kind: 'prose' | 'chart' | 'table'
  html: string
  chartWide?: boolean
  chartCompact?: boolean
  tableCompact?: boolean
}

const resolveTocId = (title: string, toc: TocItem[]): string | null => {
  const fold = foldKey(title)
  if (!fold) return null
  const exact = toc.find((item) => foldKey(item.label) === fold)
  if (exact) return exact.id
  const partial = toc.find(
    (item) => foldKey(item.label).includes(fold) || fold.includes(foldKey(item.label))
  )
  return partial?.id ?? null
}

const resolveAthleteTocId = (athleteName: string, toc: TocItem[]): string | null => {
  const fold = foldKey(athleteName)
  if (!fold) return null
  const byAthlete = toc.find((item) => item.athleteName && foldKey(item.athleteName) === fold)
  if (byAthlete) return byAthlete.id
  return (
    toc.find(
      (item) =>
        foldKey(item.label).includes(fold) ||
        (item.athleteName ? fold.includes(foldKey(item.athleteName)) : false)
    )?.id ?? null
  )
}

const seasonFromRange = (from: string): string => {
  const startYear = Number(from.slice(0, 4))
  const startMonth = Number(from.slice(5, 7))
  const seasonStart = startMonth >= 7 ? startYear : startYear - 1
  return `${seasonStart}-${seasonStart + 1}`
}

const formatDisplayDate = (iso: string, language: 'fr' | 'en'): string => {
  const date = new Date(`${iso}T12:00:00Z`)
  return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const isDateColumn = (name: string): boolean => /date|jour|day/i.test(name)
const isLabelColumn = (name: string): boolean =>
  /player|joueur|athlete|name|nom|poste|position/i.test(name) || isDateColumn(name)

const isHeatMetricColumn = (column: string): boolean => {
  const name = column.trim()
  if (isLabelColumn(name) || isDateColumn(name)) return false
  if (/^(n|nb)$/i.test(name) || /count|sessions?|jours?|days?|id\b/i.test(name)) return false
  return true
}

const isDefaultHeatColumn = (column: string): boolean =>
  /acwr|monotony|strain|soreness|stress|rpe|readiness|fatigue|mood|energy.?rating|quality.?rating|sleep.?quality|sleep.?score/i.test(
    column
  )

const isWorseHighColumn = (column: string): boolean =>
  /acwr|monotony|strain|soreness|stress|fatigue|risk|injury|decel|load|cumul|acute|distance|hsr|hmld|sprint|accel|dsl|rpe|ewma|player.?load/i.test(
    column
  ) && !/performance|readiness|quality|mood|energy|sleep.?score|wellness/i.test(column)

const coachAsksTableColor = (prompt?: string): boolean =>
  Boolean(
    prompt &&
    /couleur|color(?:is|iz)?e|heatmap|code\s*couleur|tercile|surbrill|highlight/i.test(prompt)
  )

const isDateIndexedTable = (block: Extract<PremiumReportBlock, { type: 'table' }>): boolean => {
  const dateIdx = block.columns.findIndex((col) => isDateColumn(col))
  if (dateIdx < 0) return false
  const playerIdx = block.columns.findIndex(
    (col) => /player|joueur|athlete|name|nom/i.test(col) && !isDateColumn(col)
  )
  if (playerIdx >= 0) {
    const names = new Set(
      block.rows.map((row) => String(row[playerIdx] ?? '').trim()).filter(Boolean)
    )
    if (names.size >= 4) return false
  }
  return true
}

const isSquadRankingTable = (block: Extract<PremiumReportBlock, { type: 'table' }>): boolean => {
  const playerIdx = block.columns.findIndex(
    (col) => /player|joueur|athlete|name|nom/i.test(col) && !isDateColumn(col)
  )
  if (playerIdx < 0) return false
  const names = new Set(
    block.rows.map((row) => String(row[playerIdx] ?? '').trim()).filter(Boolean)
  )
  return names.size >= 4
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const stripCoverJunk = (raw: string): string => {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (kept.length && kept[kept.length - 1] !== '') kept.push('')
      continue
    }
    if (
      /report structure is now in place|let me provide|final wrap-?up|here(?:'s| is) (?:the |my )?summary|i(?:'| a)?ll now|as an ai|based on the (?:tools|data) above/i.test(
        trimmed
      )
    ) {
      continue
    }
    if (/^#{1,6}\s/.test(trimmed) && /monitoring report|full.?staff/i.test(trimmed)) {
      continue
    }
    kept.push(trimmed)
  }
  return kept.join('\n').trim()
}

const inlineMarkdownToHtml = (text: string): string => {
  let html = escapeHtml(text)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  return html
}

const formatCoverCommentHtml = (raw: string): string => {
  const cleaned = stripCoverJunk(raw)
  if (!cleaned) return ''

  const lines = cleaned.split('\n')
  const chunks: string[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (!listItems.length) return
    chunks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`)
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }
    const heading = trimmed.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      flushList()
      chunks.push(`<p class="cover-lead">${inlineMarkdownToHtml(heading[1])}</p>`)
      continue
    }
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (bullet) {
      listItems.push(inlineMarkdownToHtml(bullet[1]))
      continue
    }
    flushList()
    const asLabel =
      trimmed.match(/^\*\*(.+?):\*\*\s*(.*)$/) || trimmed.match(/^([^:]{2,40}):\s+(.+)$/)
    if (asLabel && !/https?:/.test(trimmed)) {
      const label = asLabel[1].replace(/\*\*/g, '').trim()
      const rest = asLabel[2]?.trim() ?? ''
      chunks.push(
        `<p><strong>${escapeHtml(label)}:</strong>${rest ? ` ${inlineMarkdownToHtml(rest)}` : ''}</p>`
      )
      continue
    }
    chunks.push(`<p>${inlineMarkdownToHtml(trimmed)}</p>`)
  }
  flushList()

  let html = chunks.join('')
  if (html.length > 1800) {
    html = `${html.slice(0, 1800).replace(/<[^>]*$/, '')}…`
  }
  return html
}

const shortDateLabel = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${m[3]}/${m[2]}`
}

const tableRowHasData = (row: unknown[]): boolean =>
  row.some((cell) => {
    if (cell == null) return false
    const text = String(cell).trim()
    return text !== '' && text !== '—' && text !== '-'
  })

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size < 1 || items.length <= size) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  if (out.length >= 2 && out[out.length - 1]!.length === 1) {
    const orphan = out.pop()!
    out[out.length - 1]!.push(...orphan)
  }
  return out
}

const seriesEnergy = (entry: Record<string, unknown>): number => {
  const data = entry.data
  if (!Array.isArray(data)) return 0
  let sum = 0
  for (const point of data) {
    if (typeof point === 'number' && Number.isFinite(point)) sum += Math.abs(point)
    else if (isPlainRecord(point) && typeof point.value === 'number') sum += Math.abs(point.value)
  }
  return sum
}

const isProtectedLineSeries = (entry: Record<string, unknown>): boolean => {
  const name = String(entry.name ?? '')
  if (entry.stack === 'squad-range') return true
  if (/min\s*[-–—]\s*max|_squad_range|min équipe|max équipe|squad min|squad max/i.test(name)) {
    return true
  }
  return isTeamAggregateSeriesName(name)
}

export const expandCrowdedLineChart = (block: PremiumReportBlock): PremiumReportBlock[] => {
  if (block.type !== 'chart' || !block.option) return [block]
  const option = asEchartsOption(block.option) as Record<string, unknown>
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  const lines: Array<Record<string, unknown>> = []
  const protectedLines: Array<Record<string, unknown>> = []
  const others: unknown[] = []
  for (const entry of seriesRaw) {
    if (!isPlainRecord(entry)) {
      others.push(entry)
      continue
    }
    if (String(entry.type ?? 'line') !== 'line') {
      others.push(entry)
      continue
    }
    if (isProtectedLineSeries(entry)) protectedLines.push(entry)
    else lines.push(entry)
  }
  if (lines.length + protectedLines.length <= REPORT_V4_CHART_CHUNK) return [block]
  const budget = Math.max(1, REPORT_V4_CHART_CHUNK - protectedLines.length)
  const ranked = [...lines].sort((a, b) => seriesEnergy(b) - seriesEnergy(a))
  const groups = chunkArray(ranked, budget)
  return groups.map((group, index) => ({
    ...block,
    id: groups.length > 1 ? `${block.id}_g${index + 1}` : block.id,
    title:
      groups.length > 1
        ? `${(block.title ?? block.id).trim()} (${index + 1}/${groups.length})`
        : block.title,
    option: {
      ...option,
      series: [...protectedLines, ...group, ...others],
    },
  }))
}

const topNFromTitle = (title: string): number | undefined => {
  const match = title.match(/top\s*(\d+)/i)
  if (!match) return undefined
  const n = Number(match[1])
  return Number.isFinite(n) && n >= 2 ? n : undefined
}

export const expandCrowdedBarChart = (block: PremiumReportBlock): PremiumReportBlock[] => {
  if (block.type !== 'chart' || !block.option) return [block]
  const option = asEchartsOption(block.option) as Record<string, unknown>
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  const hasBar = seriesRaw.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'bar'
  )
  if (!hasBar) return [block]

  const topN = topNFromTitle(block.title ?? '')
  if (topN) {
    const trimmed = trimBarRankingCategories(option, seriesRaw, topN)
    return [
      {
        ...block,
        option: { ...trimmed.option, series: trimmed.series },
      },
    ]
  }

  const ranked = rankBarCategoryIndices(option, seriesRaw).filter((i) => {
    const energy = barCategoryEnergy(option, seriesRaw, i)
    return energy > 0
  })
  if (ranked.length === 0) return [block]

  const orientation = resolveBarOrientation(asEchartsOption(option), block.title ?? '')
  const maxPerChunk =
    orientation === 'horizontal' ? REPORT_V4_BAR_CHUNK_HORIZONTAL : REPORT_V4_BAR_CHUNK_VERTICAL

  if (ranked.length === categoryCountOf(option) && ranked.length <= maxPerChunk) {
    return [block]
  }
  if (ranked.length <= maxPerChunk) {
    const sliced = sliceBarCategories(option, seriesRaw, ranked)
    return [{ ...block, option: { ...sliced.option, series: sliced.series } }]
  }
  const groups = balancedChunks(ranked, maxPerChunk)
  return groups.map((indices, index) => {
    const sliced = sliceBarCategories(option, seriesRaw, indices)
    return {
      ...block,
      id: groups.length > 1 ? `${block.id}_g${index + 1}` : block.id,
      title:
        groups.length > 1
          ? `${(block.title ?? block.id).trim()} (${index + 1}/${groups.length})`
          : block.title,
      option: { ...sliced.option, series: sliced.series },
    }
  })
}

const trimStaffProseText = (text: string): string => {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const bullets: string[] = []
  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.+)$/)?.[1] || line.match(/^\d+[.)]\s+(.+)$/)?.[1] || line
    const clean = bullet.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
    if (clean.length >= 8) bullets.push(clean.length > 420 ? `${clean.slice(0, 417)}…` : clean)
    if (bullets.length >= 5) break
  }
  if (bullets.length === 0) return text.trim().slice(0, 720)
  return bullets.map((line) => `- ${line}`).join('\n')
}

const barSeriesMax = (entry: Record<string, unknown>): number => {
  const data = entry.data
  if (!Array.isArray(data)) return 0
  let max = 0
  for (const point of data) {
    const n =
      typeof point === 'number'
        ? point
        : isPlainRecord(point) && typeof point.value === 'number'
          ? point.value
          : null
    if (n != null && Number.isFinite(n) && n > max) max = n
  }
  return max
}

const normalizeSingleValueAxis = (option: Record<string, unknown>): Record<string, unknown> => {
  if (!Array.isArray(option.yAxis)) return option
  const primary = option.yAxis[0]
  const series = Array.isArray(option.series)
    ? option.series.map((entry) => {
        if (!isPlainRecord(entry)) return entry
        const next = { ...entry }
        delete next.yAxisIndex
        return next
      })
    : option.series
  return {
    ...option,
    yAxis: isPlainRecord(primary)
      ? { ...primary, type: primary.type ?? 'value' }
      : { type: 'value' },
    series,
  }
}

const sanitizeGroupedBarSeries = (
  option: Record<string, unknown>,
  title: string
): { option: Record<string, unknown>; title?: string } => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  const barEntries = seriesRaw.filter(
    (entry) => isPlainRecord(entry) && String(entry.type ?? 'line') === 'bar'
  ) as Array<Record<string, unknown>>
  if (barEntries.length <= 1) return { option }

  const nonBar = seriesRaw.filter(
    (entry) => !isPlainRecord(entry) || String(entry.type ?? 'line') !== 'bar'
  )
  const distanceTitle = REPORT_V4_DISTANCE_TITLE_RE.test(title)
  let kept = barEntries

  if (distanceTitle) {
    const distanceBars = barEntries.filter((entry) =>
      REPORT_V4_DISTANCE_SERIES_RE.test(String(entry.name ?? ''))
    )
    if (distanceBars.length === 1) {
      kept = distanceBars
    } else {
      const metreScale = barEntries.filter((entry) => barSeriesMax(entry) >= 200)
      if (metreScale.length === 1) kept = metreScale
      else if (distanceBars.length > 0) kept = [distanceBars[0]!]
      else kept = [[...barEntries].sort((a, b) => barSeriesMax(b) - barSeriesMax(a))[0]!]
    }
    const keptName = String(kept[0]?.name ?? '').trim()
    const maxV = kept[0] ? barSeriesMax(kept[0]) : 0
    let fixedTitle: string | undefined
    if (
      kept.length === 1 &&
      (!REPORT_V4_DISTANCE_SERIES_RE.test(keptName) || maxV < 200) &&
      keptName
    ) {
      fixedTitle = `${
        title
          .replace(/\([^)]*\)/g, '')
          .split('–')[0]
          ?.trim() ?? title
      } – ${keptName}`
    }
    return {
      option: normalizeSingleValueAxis({ ...option, series: [...kept, ...nonBar] }),
      ...(fixedTitle ? { title: fixedTitle.slice(0, 120) } : {}),
    }
  }

  const withoutCount = barEntries.filter(
    (entry) => !REPORT_V4_COUNT_SERIES_RE.test(String(entry.name ?? ''))
  )
  if (withoutCount.length >= 1 && withoutCount.length < barEntries.length) {
    kept = withoutCount
  }

  if (kept.length > 1) {
    const ratings = kept.filter((entry) =>
      REPORT_V4_SCORE_RATING_SERIES_RE.test(String(entry.name ?? ''))
    )
    const other = kept.filter(
      (entry) => !REPORT_V4_SCORE_RATING_SERIES_RE.test(String(entry.name ?? ''))
    )
    if (ratings.length >= 1 && other.length >= 1) {
      kept =
        other.length === 1 ? other : [other.sort((a, b) => barSeriesMax(b) - barSeriesMax(a))[0]!]
    } else if (kept.length > 1) {
      kept = [kept.sort((a, b) => barSeriesMax(b) - barSeriesMax(a))[0]!]
    }
  }

  if (kept.length === barEntries.length) return { option }
  return { option: normalizeSingleValueAxis({ ...option, series: [...kept, ...nonBar] }) }
}

const decorateHeatmapOption = (option: Record<string, unknown>): Record<string, unknown> => {
  const seriesRaw = Array.isArray(option.series) ? option.series : []
  if (!seriesRaw.some((entry) => isPlainRecord(entry) && entry.type === 'heatmap')) {
    return option
  }
  const visualBase = isPlainRecord(option.visualMap) ? option.visualMap : {}
  const visualMap = {
    ...visualBase,
    min: typeof visualBase.min === 'number' ? visualBase.min : -1,
    max: typeof visualBase.max === 'number' ? visualBase.max : 1,
    calculable: false,
    orient: 'horizontal',
    left: 'center',
    bottom: '2%',
    itemWidth: 220,
    itemHeight: 12,
    text: ['+1', '−1'],
    textStyle: { fontSize: 9, color: '#64748b' },
    inRange: {
      color: [
        '#313695',
        '#4575b4',
        '#74add1',
        '#abd9e9',
        '#ffffbf',
        '#fee090',
        '#fdae61',
        '#f46d43',
        '#d73027',
        '#a50026',
      ],
    },
  }
  const axisLabelStyle = { fontSize: 9, color: '#475569', interval: 0 as const }
  const xAxis = isPlainRecord(option.xAxis)
    ? {
        ...option.xAxis,
        axisLabel: {
          ...axisLabelStyle,
          rotate: 42,
          ...(isPlainRecord(option.xAxis.axisLabel) ? option.xAxis.axisLabel : {}),
        },
      }
    : option.xAxis
  const yAxis = isPlainRecord(option.yAxis)
    ? {
        ...option.yAxis,
        axisLabel: {
          ...axisLabelStyle,
          ...(isPlainRecord(option.yAxis.axisLabel) ? option.yAxis.axisLabel : {}),
        },
      }
    : option.yAxis
  const series = seriesRaw.map((entry) => {
    if (!isPlainRecord(entry) || entry.type !== 'heatmap') return entry
    return {
      ...entry,
      label: {
        show: true,
        fontSize: 10,
        color: '#0f172a',
        ...(isPlainRecord(entry.label) ? entry.label : {}),
      },
      emphasis: {
        itemStyle: { shadowBlur: 8, shadowColor: 'rgba(15,23,42,.25)' },
        ...(isPlainRecord(entry.emphasis) ? entry.emphasis : {}),
      },
    }
  })
  return {
    ...option,
    grid: {
      left: '24%',
      right: '6%',
      top: '10%',
      bottom: '18%',
      containLabel: false,
      ...(isPlainRecord(option.grid) ? option.grid : {}),
    },
    visualMap,
    xAxis,
    yAxis,
    series,
    tooltip: { position: 'top', ...(isPlainRecord(option.tooltip) ? option.tooltip : {}) },
  }
}

export const buildClubHtmlReport = (args: {
  document: PremiumReportDocument
  meta: ClubHtmlReportMeta
  designPack?: ReportDesignPack
}): string => {
  const pack = args.designPack ?? resolveReportDesignPack(args.meta.designPackId)
  const ctx: ClubHtmlRenderCtx = {
    pack,
    forceTableHeat: coachAsksTableColor(args.meta.coachPrompt),
    levelLegendShown: false,
  }
  const document = prepareReportV4Document(args.document, args.meta.language)
  const meta = args.meta
  const title = (meta.title ?? document.title ?? 'Staff brief').trim()
  const seasonLabel = seasonFromRange(document.dateRange.from)
  const dateLabel = formatDisplayDate(document.dateRange.to, meta.language)
  const rangeLabel = `${document.dateRange.from} → ${document.dateRange.to}`
  const charts: ChartSpec[] = []
  const toc: TocItem[] = []
  const sectionBlocks: string[] = []

  const rosterByName = new Map(
    (meta.roster ?? []).map((row) => [row.name.toLowerCase(), row] as const)
  )
  let sectionIndex = 0
  let currentPieces: LayoutPiece[] = []
  let pendingHeading = title

  const flushSectionBlock = (heading: string) => {
    if (currentPieces.length === 0) return
    sectionIndex += 1
    const id = `section-${sectionIndex}`
    const athlete = resolveSectionAthlete(heading, rosterByName, meta.reportBrief)
    toc.push({
      id,
      label: heading,
      pageHint: `§${sectionIndex}`,
      athleteName: athlete?.name,
    })
    sectionBlocks.push(
      buildSectionBlock({
        id,
        clubName: meta.clubName,
        rangeLabel,
        heading,
        pieces: currentPieces,
        athlete,
      })
    )
    currentPieces = []
  }

  for (const block of document.blocks) {
    if (block.type === 'heading') {
      flushSectionBlock(pendingHeading)
      pendingHeading = block.text.trim() || pendingHeading
      continue
    }
    currentPieces.push(...renderBlockPieces(block, charts, meta.language, ctx))
  }
  flushSectionBlock(pendingHeading)

  if (sectionBlocks.length === 0) {
    toc.push({ id: 'section-1', label: pendingHeading, pageHint: '§1' })
    sectionBlocks.push(
      buildSectionBlock({
        id: 'section-1',
        clubName: meta.clubName,
        rangeLabel,
        heading: pendingHeading,
        pieces: [
          {
            kind: 'prose',
            html: `<div class="prose-block"><p>${escapeHtml(
              meta.language === 'fr'
                ? 'Aucune section générée — élargir la fenêtre ou préciser le brief.'
                : 'No sections generated — widen the window or clarify the brief.'
            )}</p></div>`,
          },
        ],
      })
    )
  }

  const fr = meta.language === 'fr'
  const insightStaffHtml = renderInsightStaffPage({
    reportBrief: meta.reportBrief,
    clubName: meta.clubName,
    rangeLabel,
    language: meta.language,
    rosterByName,
    toc,
    clubInsightScience: meta.clubInsightScience,
  })
  const hasStaffRead = Boolean(insightStaffHtml)

  const chartBootScript = buildEchartsBootScript({
    charts,
    theme: {
      palette: pack.palette,
      fontFamily: pack.fonts.body,
      ink: pack.tokens.ink,
    },
    stripLineSymbols: true,
  })

  return `<!DOCTYPE html>
<html lang="${meta.language}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  ${echartsCdnScriptTag()}
  <link href="${pack.fonts.googleHref}" rel="stylesheet" />
  <style>
${buildReportPackCss(pack)}
${maunaWatermarkCss()}
${buildClubTemplateExtraCss()}
  </style>
</head>
<body>
${maunaWatermarkImgTag()}
<div class="artifact-shell">
  <div class="artifact-main">
  <section class="page cover" id="cover">
    <div class="cover-panel">
      <div class="wm">${escapeHtml(meta.clubName.slice(0, 14))}</div>
      <div class="brand">MAUNA</div>
      <div class="season">${escapeHtml(seasonLabel)}</div>
      <h1 class="cover-title">${escapeHtml(title)}</h1>
      <div class="date-pill">${escapeHtml(dateLabel)} · ${escapeHtml(rangeLabel)}</div>
      <div class="club-mark">${escapeHtml(meta.clubName)} · physical data</div>
    </div>
  </section>

  <section class="page toc-page" id="sommaire">
    <div class="band">
      <h1>${fr ? 'Sommaire' : 'Contents'}</h1>
      <div class="meta">${escapeHtml(meta.clubName)}</div>
    </div>
    <h2 class="toc-title">${escapeHtml(title)}</h2>
    ${
      meta.coachPrompt?.trim()
        ? `<aside class="coach-brief" id="coach-brief" data-mauna-coach-brief="1">
      <p class="label">${fr ? 'Brief coach' : 'Coach brief'}</p>
      <blockquote>${escapeHtml(synthesizeCoachBrief(meta.coachPrompt.trim()))}</blockquote>
    </aside>`
        : ''
    }
    <ol class="toc-list">
      <li><a href="#cover"><span>01 · ${fr ? 'Couverture' : 'Cover'}</span><span class="hint">cover</span></a></li>
      ${
        hasStaffRead
          ? `<li><a href="#staff-read"><span>02 · ${fr ? 'Lecture staff' : 'Staff read'}</span><span class="hint">brief</span></a></li>`
          : ''
      }
      ${toc
        .map(
          (item, index) =>
            `<li><a href="#${item.id}"><span>${String(index + (hasStaffRead ? 3 : 2)).padStart(2, '0')} · ${escapeHtml(item.label)}</span><span class="hint">${escapeHtml(item.pageHint)}</span></a></li>`
        )
        .join('')}
    </ol>
    <div class="footer-inline"><span>${escapeHtml(meta.clubName)} · confidential</span><span>toc</span></div>
  </section>

  ${insightStaffHtml ?? ''}

  <main class="report-flow">
  ${sectionBlocks.join('\n')}
  </main>
  </div>
</div>
  ${chartBootScript}
</body>
</html>`
}

const matchRosterAthlete = (
  heading: string,
  rosterByName: Map<string, RosterAthlete>
): RosterAthlete | undefined => {
  const fold = heading.toLowerCase().replace(/\s+/g, ' ').trim()
  if (rosterByName.has(fold)) return rosterByName.get(fold)
  for (const [name, row] of rosterByName) {
    if (fold.includes(name) || name.includes(fold)) return row
  }
  return undefined
}

const resolveSectionAthlete = (
  heading: string,
  rosterByName: Map<string, RosterAthlete>,
  reportBrief?: ReportBrief | null
): RosterAthlete | undefined => {
  const direct = matchRosterAthlete(heading, rosterByName)
  if (direct) return direct

  const fold = heading.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const section of reportBrief?.sections ?? []) {
    const athleteName = section.athleteName?.trim()
    if (!athleteName) continue
    const nameFold = athleteName.toLowerCase()
    if (
      section.title.toLowerCase() === fold ||
      fold.includes(nameFold) ||
      nameFold.includes(fold) ||
      section.title.toLowerCase().includes(fold)
    ) {
      const matched = matchRosterAthlete(athleteName, rosterByName)
      if (matched) return matched
    }
  }
  return undefined
}

const athleteBannerHtml = (athlete: RosterAthlete): string => {
  const initials = escapeHtml(initialsOf(athlete.name))
  const photo =
    athlete.photoUrl?.startsWith('http://') || athlete.photoUrl?.startsWith('https://')
      ? athlete.photoUrl.trim()
      : ''
  const bannerClass = photo ? 'athlete-banner' : 'athlete-banner no-photo'
  const img = photo
    ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.athlete-banner')?.classList.add('no-photo')" />`
    : ''
  return `<div class="${bannerClass}"><div class="avatar-wrap">${img}<div class="avatar-fallback">${initials}</div></div><div><div class="name">${escapeHtml(athlete.name)}</div><div class="meta">${escapeHtml(athlete.position)}</div></div></div>`
}

const layoutSectionBody = (pieces: LayoutPiece[]): string => {
  const out: string[] = []
  let i = 0
  while (i < pieces.length) {
    const current = pieces[i]
    const next = pieces[i + 1]
    const pairChartTable =
      current.kind === 'chart' &&
      current.chartCompact &&
      next?.kind === 'table' &&
      next.tableCompact
    const pairTableChart =
      current.kind === 'table' &&
      current.tableCompact &&
      next?.kind === 'chart' &&
      next.chartCompact
    if (pairChartTable) {
      out.push(`<div class="split-row split-chart-table">${current.html}${next.html}</div>`)
      i += 2
      continue
    }
    if (pairTableChart) {
      out.push(`<div class="split-row split-chart-table">${next.html}${current.html}</div>`)
      i += 2
      continue
    }
    out.push(current.html)
    i += 1
  }
  return out.join('\n')
}

const buildSectionBlock = (args: {
  id: string
  clubName: string
  rangeLabel: string
  heading: string
  pieces: LayoutPiece[]
  athlete?: RosterAthlete
}): string => {
  const pieces = [...args.pieces]
  let intro = ''
  const showBanner = Boolean(args.athlete?.name)
  if (showBanner && pieces[0]?.kind === 'prose') {
    const lead = pieces.shift()!
    intro = `<div class="section-intro">${athleteBannerHtml(args.athlete!)}<div class="intro-prose">${lead.html}</div></div>`
  } else if (showBanner) {
    intro = athleteBannerHtml(args.athlete!)
  }
  const body = layoutSectionBody(pieces)
  const athleteAttr = args.athlete?.name
    ? ` data-athlete-name="${escapeHtml(args.athlete.name)}"`
    : ''
  return `
<article class="section-block" id="${args.id}"${athleteAttr}>
  <div class="band">
    <h1>${escapeHtml(args.heading)}</h1>
    <div class="meta">${escapeHtml(args.rangeLabel)}</div>
  </div>
  ${intro}
  <div class="section-body">${body}</div>
  <div class="footer-inline">
    <span>${escapeHtml(args.clubName)} · confidential · staff</span>
    <span>${escapeHtml(args.id)}</span>
  </div>
</article>`
}

const insightStaffPageHasContent = (
  reportBrief?: ReportBrief | null,
  clubInsightScience?: ClubInsightScience[]
): boolean => {
  const hasScience = Boolean(clubInsightScience?.some((row) => row.description.trim().length > 0))
  if (!reportBrief) return hasScience
  return (
    reportBrief.narrative.length > 0 ||
    reportBrief.signals.length > 0 ||
    Boolean(reportBrief.focus.trim()) ||
    hasScience
  )
}

const signalLevelLabel = (level: ReportBrief['signals'][number]['level'], fr: boolean): string => {
  if (level === 'watch') return fr ? 'Surveiller' : 'Watch'
  if (level === 'review') return fr ? 'Revoir' : 'Review'
  return fr ? 'Info' : 'Info'
}

const renderInsightStaffPage = (args: {
  reportBrief?: ReportBrief | null
  clubName: string
  rangeLabel: string
  language: 'fr' | 'en'
  rosterByName: Map<string, RosterAthlete>
  toc: TocItem[]
  clubInsightScience?: ClubInsightScience[]
}): string | null => {
  const ir = args.reportBrief
  if (!insightStaffPageHasContent(ir, args.clubInsightScience)) return null
  const fr = args.language === 'fr'
  const title = fr ? 'Lecture staff' : 'Staff read'
  const narrative = ir?.narrative.filter(Boolean) ?? []
  const signals = ir?.signals ?? []

  const rawFocus = ir?.focus.trim() ?? ''
  const focusLooksLikeSlug =
    Boolean(rawFocus) &&
    (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(rawFocus) ||
      (!/\s/.test(rawFocus) && rawFocus.includes('_') && rawFocus.length > 24))
  const focusLead =
    rawFocus && !focusLooksLikeSlug
      ? rawFocus
      : narrative[0]?.replace(/\s+/g, ' ').trim().slice(0, 220) ||
        (focusLooksLikeSlug ? rawFocus.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() : '')
  const focusHtml = focusLead ? `<p class="staff-read-lead">${escapeHtml(focusLead)}</p>` : ''

  const narrativePanel =
    narrative.length > 0
      ? `<div class="staff-read-panel"><h3>${fr ? 'Fil narratif' : 'Narrative thread'}</h3><ul>${narrative
          .slice(0, 3)
          .map((line) => `<li>${inlineMarkdownToHtml(line)}</li>`)
          .join('')}</ul></div>`
      : ''

  const signalsPanel =
    signals.length > 0
      ? `<div class="staff-read-panel"><h3>${fr ? 'Signaux' : 'Signals'}</h3><ul class="signal-roster">${signals
          .map((signal) => {
            const athlete =
              signal.athlete?.trim() ||
              (signal.athleteId
                ? [...args.rosterByName.values()].find((r) => r.id === signal.athleteId)?.name
                : undefined)
            const domains = signal.domains.length
              ? signal.domains.map((d) => escapeHtml(d)).join(' · ')
              : ''
            const href =
              (athlete ? resolveAthleteTocId(athlete, args.toc) : null) ||
              resolveTocId(signal.summary.slice(0, 48), args.toc)
            const body = `<div class="signal-body">${inlineMarkdownToHtml(signal.summary)}</div>${
              athlete || domains
                ? `<div class="signal-meta">${athlete ? escapeHtml(athlete) : ''}${
                    athlete && domains ? ' · ' : ''
                  }${domains}</div>`
                : ''
            }`
            const inner = href ? `<a href="#${href}">${body}</a>` : `<div>${body}</div>`
            return `<li><span class="signal-badge ${escapeHtml(signal.level)}">${escapeHtml(
              signalLevelLabel(signal.level, fr)
            )}</span>${inner}</li>`
          })
          .join('')}</ul></div>`
      : ''

  const sciencePanel = renderClubInsightScienceStaffPanel(
    args.clubInsightScience ?? [],
    args.language
  )

  const topGrid =
    narrativePanel || signalsPanel
      ? `<div class="staff-read-grid">${narrativePanel}${signalsPanel}</div>`
      : ''

  return `
<section class="page content-page" id="staff-read">
  <div class="band">
    <h1>${title}</h1>
    <div class="meta">${escapeHtml(args.rangeLabel)}</div>
  </div>
  ${focusHtml}
  ${topGrid}
  ${sciencePanel}
  <div class="footer-inline">
    <span>${escapeHtml(args.clubName)} · confidential · staff brief</span>
    <span>staff-read</span>
  </div>
</section>`
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const seriesCountOf = (option: Record<string, unknown>): number => {
  const series = option.series
  if (!Array.isArray(series)) return 0
  return series.length
}

const datasetRowCount = (option: Record<string, unknown>): number => {
  const dataset = option.dataset
  if (!isPlainRecord(dataset) || !Array.isArray(dataset.source)) return 0
  const source = dataset.source as unknown[]
  return Math.max(0, source.length - 1)
}

const categoryCountOf = (option: Record<string, unknown>): number => {
  const readCats = (axis: unknown): number => {
    if (!isPlainRecord(axis)) return 0
    return Array.isArray(axis.data) ? axis.data.length : 0
  }
  for (const axis of [option.yAxis, option.xAxis]) {
    if (Array.isArray(axis)) {
      const fromAxis = Math.max(0, ...axis.map(readCats))
      if (fromAxis > 0) return fromAxis
    } else {
      const fromAxis = readCats(axis)
      if (fromAxis > 0) return fromAxis
    }
  }
  return datasetRowCount(option)
}

const chartLayoutFlags = (
  option: Record<string, unknown>,
  isRadar: boolean,
  hasBar = false
): { wide: boolean; tall: boolean; compact: boolean; barRank: boolean; lineChart: boolean } => {
  const cats = categoryCountOf(option)
  const seriesN = seriesCountOf(option)
  const lineChart =
    !isRadar &&
    !hasBar &&
    Array.isArray(option.series) &&
    option.series.some((entry) => isPlainRecord(entry) && String(entry.type ?? 'line') === 'line')
  const barRank = hasBar && cats >= 4 && !isRadar
  const wide = cats >= 14 || (seriesN >= 3 && cats >= 10)
  const tall = !wide && (lineChart || barRank || seriesN >= 5 || isRadar || cats >= 7)
  const compact = !wide && !tall && !isRadar && !barRank && !lineChart
  return { wide, tall, compact, barRank, lineChart }
}

const renderChartCard = (args: {
  id: string
  title: string
  isRadar: boolean
  option: Record<string, unknown>
  htmlLegend?: string
  compact?: boolean
}): string => {
  const hasBar = Array.isArray(args.option.series)
    ? args.option.series.some((entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'bar')
    : false
  const {
    wide,
    tall,
    compact: layoutCompact,
    barRank,
    lineChart,
  } = chartLayoutFlags(args.option, args.isRadar, hasBar)
  const compact = args.compact ?? layoutCompact
  let boxClass = ''
  if (args.isRadar) boxClass = ' radar'
  else if (lineChart) boxClass = ' line-chart'
  else if (barRank) boxClass = ' bar-rank'
  else if (wide) boxClass = ' wide'
  else if (tall) boxClass = ' tall'
  else if (compact) boxClass = ' compact'
  return `<div class="chart-card${wide ? ' chart-wide' : ''}">
  <h3>${escapeHtml(args.title || 'Chart')}</h3>
  <div id="${args.id}" class="chart-box${boxClass}"${lineChart ? ' data-chart-kind="line"' : ''}></div>
  ${args.htmlLegend ?? ''}
</div>`
}

const resolveSeriesLegendColor = (entry: Record<string, unknown>): string | null => {
  const lineStyle = isPlainRecord(entry.lineStyle) ? entry.lineStyle : null
  const itemStyle = isPlainRecord(entry.itemStyle) ? entry.itemStyle : null
  const areaStyle = isPlainRecord(entry.areaStyle) ? entry.areaStyle : null
  for (const style of [lineStyle, itemStyle, areaStyle]) {
    const color = style?.color
    if (typeof color === 'string' && color.length > 0 && color !== 'transparent') return color
  }
  return null
}

const tintSeriesWithPalette = (series: unknown[], palette: string[]): unknown[] => {
  let colorIdx = 0
  return series.map((entry) => {
    if (!isPlainRecord(entry)) return entry
    if (entry.stack === 'squad-range') return entry
    const lineStyle = isPlainRecord(entry.lineStyle) ? entry.lineStyle : {}
    const itemStyle = isPlainRecord(entry.itemStyle) ? entry.itemStyle : {}
    if (resolveSeriesLegendColor(entry)) return entry
    const tint = palette[colorIdx++ % Math.max(palette.length, 1)]
    const type = String(entry.type ?? 'line')
    if (type === 'line') {
      return {
        ...entry,
        lineStyle: { ...lineStyle, color: tint },
        itemStyle: { ...itemStyle, color: tint },
      }
    }
    if (type === 'bar' || type === 'scatter') {
      return { ...entry, itemStyle: { ...itemStyle, color: tint } }
    }
    return entry
  })
}

const buildHtmlLegend = (names: string[], palette: string[], series: unknown[] = []): string => {
  if (names.length === 0 || names.length > 12) return ''
  const colorByName = new Map<string, string>()
  for (const entry of series) {
    if (!isPlainRecord(entry)) continue
    if (entry.stack === 'squad-range') continue
    const name = typeof entry.name === 'string' ? entry.name : ''
    if (!name || colorByName.has(name)) continue
    const color = resolveSeriesLegendColor(entry)
    if (color) colorByName.set(name, color)
  }
  let fallback = 0
  const items = names
    .map((name) => {
      const color = colorByName.get(name) ?? palette[fallback++ % palette.length]
      return `<span><i style="background:${color}"></i>${escapeHtml(
        name.length > 22 ? `${name.slice(0, 20)}…` : name
      )}</span>`
    })
    .join('')
  return `<div class="chart-legend-html">${items}</div>`
}

const isCompactTableBlock = (block: Extract<PremiumReportBlock, { type: 'table' }>): boolean =>
  block.rows.length <= 8 && block.columns.length <= 4

const renderBlockPieces = (
  block: PremiumReportBlock,
  charts: ChartSpec[],
  language: 'fr' | 'en',
  ctx: ClubHtmlRenderCtx
): LayoutPiece[] => {
  if (block.type === 'text') {
    const trimmed = trimStaffProseText(block.text)
    const html = formatCoverCommentHtml(trimmed)
    return [
      {
        kind: 'prose',
        html: `<div class="prose-block">${html || `<p>${escapeHtml(trimmed)}</p>`}</div>`,
      },
    ]
  }
  if (block.type === 'chart') {
    const id = artifactChartHostId(block.id)
    const isRadar = Boolean(block.option.radar)
    const decorated = decorateChartOption(block.option, {
      title: block.title,
      language,
      palette: ctx.pack.palette,
    })
    const chartTitle = decorated.title ?? block.title
    charts.push({ id, title: chartTitle, option: decorated.option })
    const hasBar = Array.isArray(decorated.option.series)
      ? decorated.option.series.some(
          (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'bar'
        )
      : false
    const layout = chartLayoutFlags(decorated.option, isRadar, hasBar)
    return [
      {
        kind: 'chart',
        html: renderChartCard({
          id,
          title: chartTitle,
          isRadar,
          option: decorated.option,
          htmlLegend: decorated.htmlLegend,
        }),
        chartWide: layout.wide,
        chartCompact: layout.compact,
      },
    ]
  }
  if (block.type !== 'table') return []
  if (!block.rows.some(tableRowHasData)) return []

  const pieces: LayoutPiece[] = []
  const tableCompact = isCompactTableBlock(block)
  pieces.push({
    kind: 'table',
    html: renderTable(block, language, ctx),
    tableCompact,
  })
  return pieces
}

const pickReadableLineSeries = (seriesRaw: unknown[]): unknown[] => {
  const lines: Array<Record<string, unknown>> = []
  const protectedLines: Array<Record<string, unknown>> = []
  const others: unknown[] = []
  for (const entry of seriesRaw) {
    if (!isPlainRecord(entry)) {
      others.push(entry)
      continue
    }
    const type = String(entry.type ?? 'line')
    if (type !== 'line') {
      others.push(entry)
      continue
    }
    if (isProtectedLineSeries(entry)) protectedLines.push(entry)
    else lines.push(entry)
  }
  return [...protectedLines, ...lines, ...others]
}

const rowNumericEnergy = (row: unknown[]): number => {
  let sum = 0
  for (let i = 1; i < row.length; i += 1) {
    const n = toNumber(row[i])
    if (n != null) sum += Math.abs(n)
  }
  return sum
}

const barCategoryEnergy = (
  option: Record<string, unknown>,
  series: unknown[],
  index: number
): number => {
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? (dataset.source as unknown[]) : null
  if (source && source.length > 1) {
    const row = source[index + 1]
    return Array.isArray(row) ? rowNumericEnergy(row) : 0
  }
  let sum = 0
  for (const entry of series) {
    if (!isPlainRecord(entry) || !Array.isArray(entry.data)) continue
    const point = entry.data[index]
    if (typeof point === 'number' && Number.isFinite(point)) sum += Math.abs(point)
    else if (isPlainRecord(point) && typeof point.value === 'number') sum += Math.abs(point.value)
  }
  return sum
}

const rankBarCategoryIndices = (option: Record<string, unknown>, series: unknown[]): number[] => {
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? (dataset.source as unknown[]) : null
  if (source && source.length > 1) {
    return source
      .slice(1)
      .map((row, i) => ({
        i,
        energy: Array.isArray(row) ? rowNumericEnergy(row) : 0,
      }))
      .sort((a, b) => b.energy - a.energy)
      .map((row) => row.i)
  }
  const axis =
    (isPlainRecord(option.yAxis) && Array.isArray(option.yAxis.data) && option.yAxis) ||
    (isPlainRecord(option.xAxis) && Array.isArray(option.xAxis.data) && option.xAxis) ||
    null
  if (!axis || !Array.isArray(axis.data)) return []
  return axis.data
    .map((_, i) => ({ i, sum: barCategoryEnergy(option, series, i) }))
    .sort((a, b) => b.sum - a.sum)
    .map((row) => row.i)
}

const sliceBarCategories = (
  option: Record<string, unknown>,
  series: unknown[],
  indices: number[]
): { option: Record<string, unknown>; series: unknown[] } => {
  const dataset = isPlainRecord(option.dataset) ? option.dataset : null
  const source = dataset && Array.isArray(dataset.source) ? (dataset.source as unknown[]) : null
  if (source && source.length > 1) {
    const header = source[0]
    const body = source.slice(1)
    return {
      option: {
        ...option,
        dataset: { ...dataset, source: [header, ...indices.map((i) => body[i])] },
      },
      series,
    }
  }
  const yAxis = isPlainRecord(option.yAxis) ? option.yAxis : null
  if (yAxis && Array.isArray(yAxis.data)) {
    const cats = yAxis.data as unknown[]
    const nextSeries = series.map((entry) => {
      if (!isPlainRecord(entry) || !Array.isArray(entry.data)) return entry
      const data = entry.data as unknown[]
      return { ...entry, data: indices.map((i) => data[i]) }
    })
    return {
      option: { ...option, yAxis: { ...yAxis, data: indices.map((i) => cats[i]) } },
      series: nextSeries,
    }
  }
  const xAxis = isPlainRecord(option.xAxis) ? option.xAxis : null
  if (!xAxis || !Array.isArray(xAxis.data)) return { option, series }
  const cats = xAxis.data as unknown[]
  const nextSeries = series.map((entry) => {
    if (!isPlainRecord(entry) || !Array.isArray(entry.data)) return entry
    const data = entry.data as unknown[]
    return { ...entry, data: indices.map((i) => data[i]) }
  })
  return {
    option: { ...option, xAxis: { ...xAxis, data: indices.map((i) => cats[i]) } },
    series: nextSeries,
  }
}

const trimBarRankingCategories = (
  option: Record<string, unknown>,
  series: unknown[],
  maxCats: number
): { option: Record<string, unknown>; series: unknown[] } => {
  const ranked = rankBarCategoryIndices(option, series).filter(
    (i) => barCategoryEnergy(option, series, i) > 0
  )
  if (ranked.length === 0) return { option, series }
  if (ranked.length === categoryCountOf(option) && ranked.length <= maxCats) {
    return { option, series }
  }
  return sliceBarCategories(option, series, ranked.slice(0, maxCats))
}

const decorateChartOption = (
  option: Record<string, unknown>,
  ctx: { title?: string; language?: 'fr' | 'en'; palette: string[] }
): { option: Record<string, unknown>; htmlLegend?: string; title?: string } => {
  const chartTitle = ctx?.title?.trim() ?? ''
  let working = decorateHeatmapOption(option)
  let titleFix: string | undefined

  const barSanitized = sanitizeGroupedBarSeries(working, chartTitle)
  working = barSanitized.option
  titleFix = barSanitized.title

  const isRadar = Boolean(working.radar)
  let seriesRaw = Array.isArray(working.series) ? pickReadableLineSeries(working.series) : []
  const isScatter = seriesRaw.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'scatter'
  )
  const hasBar = seriesRaw.some(
    (entry) => isPlainRecord(entry) && String(entry.type ?? '') === 'bar'
  )
  const catN = categoryCountOf(working)
  const baseTitle = (titleFix ?? chartTitle).trim()
  const topNMatch = /top\s*(\d+)/i.exec(baseTitle)
  const topN = topNMatch ? Number(topNMatch[1]) : null
  if (topN != null && Number.isFinite(topN) && topN > 0 && hasBar && catN > topN) {
    const trimmed = trimBarRankingCategories(working, seriesRaw, topN)
    working = trimmed.option
    seriesRaw = trimmed.series
  }

  let series = seriesRaw.map((entry) => {
    if (!isPlainRecord(entry)) return entry
    const type = String(entry.type ?? 'line')
    if (type === 'line') {
      const lineStyle = isPlainRecord(entry.lineStyle) ? { ...entry.lineStyle } : {}
      const width = isTeamAggregateSeriesName(String(entry.name ?? ''))
        ? 3.1
        : typeof lineStyle.width === 'number'
          ? lineStyle.width
          : 2.4
      return {
        ...entry,
        showSymbol: false,
        symbol: 'none',
        symbolSize: 0,
        smooth: entry.smooth ?? true,
        lineStyle: { ...lineStyle, width },
      }
    }
    if (type === 'bar') {
      return {
        ...entry,
        barMaxWidth: 42,
        barCategoryGap: '28%',
      }
    }
    return entry
  })

  if (!isRadar && !hasBar) {
    const withBand = maybeAppendSquadRangeBand(
      asEchartsOption({ ...working, series }),
      ctx?.language ?? 'fr',
      chartTitle
    )
    if (Array.isArray(withBand.series)) {
      series = withBand.series
      working = { ...working, ...withBand, series }
    }
  }

  series = tintSeriesWithPalette(series, ctx.palette)
  working = { ...working, series }

  const names = series
    .map((entry) => (isPlainRecord(entry) && typeof entry.name === 'string' ? entry.name : ''))
    .filter(
      (name) =>
        Boolean(name) && !name.startsWith('_squad_range') && !/min\s*[-–—]\s*max/i.test(name)
    )

  let htmlLegend: string | undefined
  let legend: Record<string, unknown> | undefined

  if (isRadar) {
    legend = {
      show: true,
      top: 0,
      type: 'plain',
      textStyle: { fontSize: 10 },
    }
  } else if (names.length > 1) {
    legend = { show: false }
    htmlLegend = buildHtmlLegend(names, ctx.palette, series)
  } else {
    legend = { show: false }
  }

  let xAxis = isPlainRecord(working.xAxis) ? { ...working.xAxis } : working.xAxis
  let catCount = 0
  if (isPlainRecord(xAxis) && Array.isArray(xAxis.data)) {
    const data = xAxis.data.map((value) =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? shortDateLabel(value) : value
    )
    catCount = data.length
    const axisLabel = isPlainRecord(xAxis.axisLabel) ? { ...xAxis.axisLabel } : {}
    xAxis.data = data
    xAxis.axisLabel = {
      color: '#8b93a7',
      fontSize: 9,
      hideOverlap: true,
      rotate: data.length > 8 || hasBar ? 35 : 0,
      ...axisLabel,
    }
  }

  const bottom = isRadar
    ? 24
    : isScatter
      ? 72
      : hasBar || catCount > 8
        ? 56
        : names.length > 1
          ? 12
          : 28

  let yAxis = working.yAxis
  if (
    hasBar &&
    REPORT_V4_DISTANCE_TITLE_RE.test(chartTitle) &&
    !Array.isArray(yAxis) &&
    isPlainRecord(yAxis) &&
    !yAxis.name
  ) {
    yAxis = {
      ...yAxis,
      name: ctx?.language === 'fr' ? 'm' : 'm',
      nameTextStyle: { color: '#64748b', fontSize: 10 },
    }
  }

  return {
    option: {
      ...working,
      color: working.color ?? ctx.palette,
      series,
      legend,
      ...(yAxis ? { yAxis } : {}),
      ...(isRadar
        ? {}
        : {
            grid: {
              left: isScatter ? 56 : 16,
              right: hasBar && Array.isArray(working.yAxis) ? 48 : isScatter ? 48 : 16,
              top: isScatter ? 40 : 28,
              containLabel: true,
              ...(isPlainRecord(working.grid) ? working.grid : {}),
              bottom,
            },
          }),
      tooltip: working.tooltip ?? (isRadar ? {} : { trigger: isScatter ? 'item' : 'axis' }),
      ...(xAxis ? { xAxis } : {}),
    },
    ...(htmlLegend ? { htmlLegend } : {}),
    ...(titleFix ? { title: titleFix } : {}),
  }
}

const columnHasSpread = (values: number[]): boolean => {
  if (values.length < 3) return false
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return false
  return (max - min) / Math.max(Math.abs(max), 1e-9) >= 0.05
}

const columnScaleIsComparable = (values: number[]): boolean => {
  if (values.length < 4) return false
  const sorted = [...values].sort((a, b) => a - b)
  const p10 = sorted[Math.max(0, Math.floor(sorted.length * 0.1))]!
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!
  if (!(p10 > 0) || !(p90 > 0)) return columnHasSpread(values)
  if (p90 / p10 > 25) return false
  return columnHasSpread(values)
}

const renderTable = (
  block: Extract<PremiumReportBlock, { type: 'table' }>,
  language: 'fr' | 'en',
  ctx: ClubHtmlRenderCtx
): string => {
  if (block.rows.length === 0 || block.columns.length === 0) {
    return ''
  }

  const dateSeries = isDateIndexedTable(block)
  const squadRank = isSquadRankingTable(block)
  const heatIndexes =
    dateSeries || (!ctx.forceTableHeat && !squadRank)
      ? []
      : block.columns
          .map((col, index) => ({ col, index }))
          .filter(({ col, index }) => {
            const eligible = ctx.forceTableHeat ? isHeatMetricColumn(col) : isDefaultHeatColumn(col)
            if (!eligible) return false
            const values = block.rows
              .map((row) => toNumber(row[index]))
              .filter((n): n is number => n != null)
            if (values.length < 4) return false
            if (values.length / Math.max(block.rows.length, 1) < 0.45) return false
            return columnScaleIsComparable(values)
          })

  const thresholds = new Map<number, { hi: number; midLo: number; invert: boolean }>()
  for (const { col, index } of heatIndexes) {
    const values = block.rows
      .map((row) => toNumber(row[index]))
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b)
    if (!columnScaleIsComparable(values)) continue
    const p66 = values[Math.min(values.length - 1, Math.floor(values.length * 0.66))]!
    const p33 = values[Math.max(0, Math.floor(values.length * 0.33))]!
    thresholds.set(index, { hi: p66, midLo: p33, invert: isWorseHighColumn(col) })
  }

  const playerCol = block.columns.findIndex(
    (col) => /player|joueur|athlete|name|nom/i.test(String(col)) && !/date|jour/i.test(String(col))
  )
  const numericCols = new Set(
    block.columns
      .map((col, index) => {
        if (/date|jour|player|joueur|athlete|name|nom/i.test(String(col))) return -1
        const nums = block.rows
          .map((row) => toNumber(row[index]))
          .filter((n): n is number => n != null)
        return nums.length >= Math.max(2, Math.ceil(block.rows.length * 0.4)) ? index : -1
      })
      .filter((index) => index >= 0)
  )
  const head = block.columns
    .map((column, index) => {
      const num = numericCols.has(index) ? ' class="num"' : ''
      return `<th${num}>${escapeHtml(String(column))}</th>`
    })
    .join('')
  const rows = block.rows
    .slice(0, 40)
    .map((row) => {
      const cells = row
        .map((cell, index) => {
          const text = cell == null ? '—' : String(cell)
          const n = toNumber(cell)
          const thr = thresholds.get(index)
          const classes: string[] = []
          if (numericCols.has(index)) classes.push('num')
          if (n != null && thr) {
            const high = n >= thr.hi
            const mid = n >= thr.midLo
            if (thr.invert) {
              if (high) classes.push('lvl-hi')
              else if (mid) classes.push('lvl-mid')
              else classes.push('lvl-lo')
            } else {
              if (high) classes.push('lvl-lo')
              else if (mid) classes.push('lvl-mid')
              else classes.push('lvl-hi')
            }
          }
          const cls = classes.length ? ` class="${classes.join(' ')}"` : ''
          return `<td${cls}>${escapeHtml(text)}</td>`
        })
        .join('')
      const athleteName =
        playerCol >= 0 && row[playerCol] != null ? String(row[playerCol]).trim() : ''
      const athleteAttr = athleteName ? ` data-athlete="${escapeHtml(athleteName)}"` : ''
      return `<tr${athleteAttr}>${cells}</tr>`
    })
    .join('')

  const title = block.title?.trim() ? `<h3>${escapeHtml(block.title)}</h3>` : ''
  let legend = ''
  if (thresholds.size > 0 && !ctx.levelLegendShown) {
    ctx.levelLegendShown = true
    legend =
      language === 'fr'
        ? `<div class="legend"><span><i class="swatch" style="background:${ctx.pack.tokens.cherrySoft};outline:1px solid ${ctx.pack.tokens.cherry}"></i>à surveiller</span><span><i class="swatch" style="background:${ctx.pack.tokens.saffronSoft};outline:1px solid ${ctx.pack.tokens.saffron}"></i>intermédiaire</span><span><i class="swatch" style="background:rgba(52,211,153,.16);outline:1px solid #34d399"></i>favorable</span><span>vs le groupe (terciles)</span></div>`
        : `<div class="legend"><span><i class="swatch" style="background:${ctx.pack.tokens.cherrySoft};outline:1px solid ${ctx.pack.tokens.cherry}"></i>watch</span><span><i class="swatch" style="background:${ctx.pack.tokens.saffronSoft};outline:1px solid ${ctx.pack.tokens.saffron}"></i>mid</span><span><i class="swatch" style="background:rgba(52,211,153,.16);outline:1px solid #34d399"></i>favourable</span><span>vs squad (terciles)</span></div>`
  }

  return `<div class="card">${title}${legend}<table class="report-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
}
