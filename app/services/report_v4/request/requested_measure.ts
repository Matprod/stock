import type {
  PremiumDataset,
  PremiumReportDocument,
  PremiumTableBlock,
} from '#contracts/premium_report'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { ClubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import { tableFromDataset } from '#services/premium_report/premium_report_document'
import { toNumber } from '#services/premium_report/dataset_ops'
import {
  resolveCoachMetricsFromCatalog,
  type ResolvedCoachMetric,
} from '#services/report_v4/coach_metric_resolve'
import type { ReportBrief } from '#services/report_v4/report_brief'
import type { AppLanguage } from '#utils/localize'
import logger from '@adonisjs/core/services/logger'

export type RequestedMeasure = {
  metric: string
  unit: string
  alias: string
  phrase: string
  source: ResolvedCoachMetric['source']
}

export type MeasureEnforceResult = {
  status: 'ok' | 'substituted' | 'missing' | 'skipped'
  document: PremiumReportDocument
  brief: ReportBrief | null
  note: string | null
  displayedUnit: string | null
}

const fold = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const PER_MIN_RE = /m\/min|per\s*min|distance\s*per\s*min|speed.?intensity|distancemin/i
const TOTAL_DISTANCE_NAME_RE =
  /distancetotal|total_?distance|(?:^|_)distance(?:_?m)?(?:$|_)/i
const WRONG_FOR_TOTAL_DISTANCE_RE =
  /m\/min|per\s*min|speed.?intensity|acceleration\s*time|distance\s*per\s*minute/i

export const inferMetricUnit = (args: {
  name: string
  alias: string
  units?: Record<string, string>
  labels?: Record<string, string>
}): string => {
  const fromUnits =
    args.units?.[args.name] ??
    args.units?.[args.alias] ??
    args.units?.[args.name.toLowerCase()] ??
    args.units?.[args.alias.toLowerCase()]
  if (fromUnits?.trim()) return fromUnits.trim()
  const hay = fold(`${args.name} ${args.alias} ${args.labels?.[args.name] ?? ''}`)
  if (PER_MIN_RE.test(hay)) return 'm/min'
  if (/_km\b|distance.?km/.test(hay)) return 'km'
  if (TOTAL_DISTANCE_NAME_RE.test(hay) || /hmld|hsr|explosive/.test(hay)) return 'm'
  if (/minute|playing.?time/.test(hay)) return 'min'
  if (/acwr|ratio|ewma/.test(hay)) return ''
  if (/srpe|rpe/.test(hay)) return 'AU'
  return ''
}

const enrichPromptForResolve = (prompt: string): string => {
  const folded = fold(prompt)
  if (/\bdistance\b/i.test(folded) && /\btotal/i.test(folded) && !/\btotal\s+distance\b/i.test(folded)) {
    return `${prompt}\ntotal distance`
  }
  return prompt
}

export const resolveRequestedMeasure = (args: {
  prompt: string
  catalog: ClubMetricCatalog
  labels?: Record<string, string>
  units?: Record<string, string>
}): RequestedMeasure | null => {
  const resolved = resolveCoachMetricsFromCatalog({
    prompt: enrichPromptForResolve(args.prompt),
    catalog: args.catalog,
    labels: args.labels,
  })
  const pick =
    resolved.find((row) => row.source === 'gps' && TOTAL_DISTANCE_NAME_RE.test(fold(`${row.name} ${row.alias}`))) ??
    resolved.find((row) => row.source === 'gps') ??
    resolved.find((row) => row.source === 'match') ??
    resolved.find((row) => row.source === 'load') ??
    null
  if (!pick) return null
  const unit = inferMetricUnit({
    name: pick.name,
    alias: pick.alias,
    units: args.units,
    labels: args.labels,
  })
  return {
    metric: pick.name,
    unit,
    alias: pick.alias,
    phrase: pick.phrase,
    source: pick.source,
  }
}

const documentMeasureHaystack = (document: PremiumReportDocument): string => {
  const parts: string[] = [document.title]
  for (const block of document.blocks) {
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING || block.type === PREMIUM_BLOCK_TYPE.TEXT) {
      parts.push(block.text)
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      if (block.title) parts.push(block.title)
      parts.push(...block.columns)
    }
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      if (block.title) parts.push(block.title)
      parts.push(JSON.stringify(block.option).slice(0, 4000))
    }
  }
  return parts.join('\n')
}

const TOTAL_DISTANCE_DISPLAY_RE =
  /total\s*distance|distance\s*total(?:e)?|distance\s*totale|distance\s*\(\s*m\s*\)|kpi[_\s-]*distancetotal/i

export const detectDisplayedMeasureUnit = (hay: string): string | null => {
  const hasTotalDistance = TOTAL_DISTANCE_DISPLAY_RE.test(hay)
  const hasPerMin = PER_MIN_RE.test(hay)
  if (hasTotalDistance && !hasPerMin) return 'm'
  if (hasPerMin && !hasTotalDistance) return 'm/min'
  if (hasTotalDistance && hasPerMin) return 'm'
  if (/\bkm\b/i.test(hay) && /distance/i.test(hay)) return 'km'
  if (/\bAU\b|\bsrpe\b/i.test(hay)) return 'AU'
  if (/\bmin(?:ute)?s?\b/i.test(hay) && /play|match|time/i.test(hay)) return 'min'
  if (/\(\s*m\s*\)|\bmetres?\b|\bmeters?\b|_m\b/i.test(hay)) {
    return 'm'
  }
  return null
}

const measureMatchesDisplay = (measure: RequestedMeasure, hay: string): boolean => {
  const folded = fold(hay)
  const isTotalDistance = TOTAL_DISTANCE_NAME_RE.test(fold(`${measure.metric} ${measure.alias}`))
  const metricHit =
    folded.includes(fold(measure.metric)) ||
    folded.includes(fold(measure.alias)) ||
    (isTotalDistance &&
      TOTAL_DISTANCE_DISPLAY_RE.test(hay) &&
      !WRONG_FOR_TOTAL_DISTANCE_RE.test(hay))
  if (metricHit && measure.unit && detectDisplayedMeasureUnit(hay) === measure.unit) return true
  if (metricHit && !measure.unit) return true
  if (isTotalDistance && measure.unit === 'm' && TOTAL_DISTANCE_DISPLAY_RE.test(hay)) {
    if (WRONG_FOR_TOTAL_DISTANCE_RE.test(hay) && !TOTAL_DISTANCE_DISPLAY_RE.test(hay)) return false
    return true
  }
  return false
}

const primaryTableAlreadyHasMeasure = (
  document: PremiumReportDocument,
  measure: RequestedMeasure
): boolean => {
  const table = document.blocks.find(
    (block): block is PremiumTableBlock => block.type === PREMIUM_BLOCK_TYPE.TABLE
  )
  if (!table) return false
  const hay = `${table.title ?? ''}\n${table.columns.join('\n')}`
  return measureMatchesDisplay(measure, hay)
}

const findDatasetColumn = (
  datasets: Iterable<PremiumDataset>,
  measure: RequestedMeasure
): { dataset: PremiumDataset; column: string } | null => {
  const wanted = [measure.metric, measure.alias].map(fold)
  for (const dataset of datasets) {
    for (const column of dataset.columns) {
      const key = fold(column)
      if (wanted.includes(key)) return { dataset, column }
      if (
        TOTAL_DISTANCE_NAME_RE.test(fold(`${measure.metric} ${measure.alias}`)) &&
        TOTAL_DISTANCE_NAME_RE.test(key) &&
        !PER_MIN_RE.test(key)
      ) {
        return { dataset, column }
      }
    }
  }
  return null
}

const topNFromTitle = (title: string | undefined): number | null => {
  if (!title) return null
  const match = /top\s*(\d+)/i.exec(title)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : null
}

const athleteColumn = (columns: string[]): string | undefined =>
  columns.find((col) => /^(joueur|player|athlete|name|nom)$/i.test(col))

const rebuildPrimaryTable = (args: {
  block: PremiumTableBlock
  dataset: PremiumDataset
  column: string
  language: AppLanguage
}): PremiumTableBlock => {
  const keep = [athleteColumn(args.dataset.columns), args.column].filter(
    (col): col is string => Boolean(col)
  )
  const projected: PremiumDataset = {
    ...args.dataset,
    columns: keep.length ? keep : [args.column],
    rows: [...args.dataset.rows]
      .map((row) => {
        const next: Record<string, unknown> = {}
        for (const col of keep.length ? keep : [args.column]) next[col] = row[col]
        return next
      })
      .sort((left, right) => {
        const a = toNumber(left[args.column]) ?? Number.NEGATIVE_INFINITY
        const b = toNumber(right[args.column]) ?? Number.NEGATIVE_INFINITY
        return b - a
      }),
  }
  const topN = topNFromTitle(args.block.title)
  if (topN != null) projected.rows = projected.rows.slice(0, topN)
  const built = tableFromDataset(projected, args.language)
  return {
    ...args.block,
    columns: built.columns,
    rows: built.rows,
  }
}

const measureNote = (args: {
  language: AppLanguage
  status: 'substituted' | 'missing'
  measure: RequestedMeasure
  displayedUnit: string | null
}): string => {
  const fr = args.language !== 'en'
  const wanted =
    args.measure.phrase ||
    (TOTAL_DISTANCE_NAME_RE.test(fold(`${args.measure.metric} ${args.measure.alias}`))
      ? fr
        ? 'distance totale'
        : 'total distance'
      : args.measure.alias)
  const shown = args.displayedUnit || (fr ? 'mesure affichée' : 'displayed measure')
  if (args.status === 'substituted') {
    return fr
      ? `${wanted} substituée depuis les données (à la place de ${shown}).`
      : `${wanted} substituted from data (was ${shown}).`
  }
  return fr
    ? `${wanted} non disponible : classement en ${shown}.`
    : `${wanted} unavailable: ranking shown in ${shown}.`
}

const appendNoteBlock = (
  document: PremiumReportDocument,
  note: string
): PremiumReportDocument => {
  const id = 'requested_measure_note'
  const existing = document.blocks.findIndex(
    (block) => block.type === PREMIUM_BLOCK_TYPE.TEXT && block.id === id
  )
  const textBlock: import('#contracts/premium_report').PremiumTextBlock = {
    id,
    type: PREMIUM_BLOCK_TYPE.TEXT,
    text: note,
  }
  if (existing >= 0) {
    document.blocks[existing] = textBlock
    return document
  }
  const firstTable = document.blocks.findIndex((block) => block.type === PREMIUM_BLOCK_TYPE.TABLE)
  if (firstTable >= 0) {
    document.blocks.splice(firstTable + 1, 0, textBlock)
  } else {
    document.blocks.push(textBlock)
  }
  return document
}

const annotateBrief = (brief: ReportBrief | null, note: string): ReportBrief | null => {
  if (!brief) return brief
  const tag = note.trim()
  if (!tag) return brief
  const already = brief.signals.some((signal) => signal.summary.includes(tag.slice(0, 24)))
  if (already) return brief
  return {
    ...brief,
    signals: [
      {
        level: 'info',
        summary: tag,
        domains: [],
        metrics: {},
      },
      ...brief.signals,
    ],
  }
}

export const enforceRequestedMeasure = (args: {
  measure: RequestedMeasure | null | undefined
  document: PremiumReportDocument
  brief?: ReportBrief | null
  datasets: Iterable<PremiumDataset>
  language: AppLanguage
}): MeasureEnforceResult => {
  if (!args.measure) {
    return {
      status: 'skipped',
      document: args.document,
      brief: args.brief ?? null,
      note: null,
      displayedUnit: null,
    }
  }
  const hay = documentMeasureHaystack(args.document)
  const displayedUnit = detectDisplayedMeasureUnit(hay)
  if (
    measureMatchesDisplay(args.measure, hay) ||
    primaryTableAlreadyHasMeasure(args.document, args.measure)
  ) {
    return {
      status: 'ok',
      document: args.document,
      brief: args.brief ?? null,
      note: null,
      displayedUnit: displayedUnit ?? args.measure.unit ?? null,
    }
  }

  const hit = findDatasetColumn(args.datasets, args.measure)
  if (hit) {
    const tables = args.document.blocks.filter(
      (block): block is PremiumTableBlock => block.type === PREMIUM_BLOCK_TYPE.TABLE
    )
    const primary = tables[0]
    if (primary) {
      const already =
        primary.columns.some((col) => fold(col) === fold(hit.column)) ||
        measureMatchesDisplay(args.measure, `${primary.title ?? ''}\n${primary.columns.join('\n')}`)
      if (already) {
        return {
          status: 'ok',
          document: args.document,
          brief: args.brief ?? null,
          note: null,
          displayedUnit: displayedUnit ?? args.measure.unit ?? null,
        }
      }
      const nextBlocks = args.document.blocks.map((block) => {
        if (block.id !== primary.id || block.type !== PREMIUM_BLOCK_TYPE.TABLE) return block
        return rebuildPrimaryTable({
          block,
          dataset: hit.dataset,
          column: hit.column,
          language: args.language,
        })
      })
      const note = measureNote({
        language: args.language,
        status: 'substituted',
        measure: args.measure,
        displayedUnit,
      })
      let document = appendNoteBlock({ ...args.document, blocks: nextBlocks }, note)
      const brief = annotateBrief(args.brief ?? null, note)
      logger.info(
        {
          metric: args.measure.metric,
          unit: args.measure.unit,
          displayedUnit,
          datasetId: hit.dataset.id,
          column: hit.column,
        },
        'report_v4.requested_measure_substituted'
      )
      return { status: 'substituted', document, brief, note, displayedUnit }
    }
  }

  const note = measureNote({
    language: args.language,
    status: 'missing',
    measure: args.measure,
    displayedUnit: displayedUnit ?? 'm/min',
  })
  const document = appendNoteBlock(args.document, note)
  const brief = annotateBrief(args.brief ?? null, note)
  logger.warn(
    {
      metric: args.measure.metric,
      unit: args.measure.unit,
      displayedUnit,
    },
    'report_v4.requested_measure_missing'
  )
  return { status: 'missing', document, brief, note, displayedUnit }
}
