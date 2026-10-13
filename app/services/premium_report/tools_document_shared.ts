import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_HEADING_LENGTH, PREMIUM_REPORT_MAX_TEXT_LENGTH, isPremiumChartPreset } from '#constants/premium_report.constants'
import { pickAthleteColumn } from '#constants/premium_report_metrics'
import type { PremiumChartBlock, PremiumDataset, PremiumHeadingBlock, PremiumReportBlock, PremiumTableBlock } from '#contracts/premium_report'
import { bindChartDataset, datasetFromChartOption, datasetToSource, hasChartEmbeddedSource, implausibleMetricWarning, insertBlock, mergeChartDatasets, pruneEmptyTableColumns, reshapePremiumTable, sanitizePlainObject, stripMarkdownDecorations, tableFromDataset, applyTableHeat, type PremiumTableReshape, type StaffHeatScale } from '#services/premium_report/premium_report_document'
import { asEchartsOption, buildPresetFromDataset, chartTypeFromOption, inferChartType, scoreChartJobs } from '#services/premium_report/chart_presets'
import { datasetToTeamGrain, overlayTeamSeries, pickSquadMetricColumn, type TeamChartOp } from '#services/premium_report/team_chart'
import { jevTeamChart } from '#services/premium_report/jev_team_chart'
import { relabelTableColumns } from '#services/premium_report/column_labels'
import { pickDateColumn, readString, readStringList, requireDatasetColumns, isFilterOp, filterRows, parseFilterCompare, type FilterOp } from '#services/premium_report/dataset_ops'
import { jevTextCaption } from '#services/premium_report/jev_text_caption'
import { collectGroundedAthleteNames, gateDeterministicCaption } from '#services/report_v4/grounding_auditor'
import { resolveChartRules, stampMaunaChartLayout } from '#services/premium_report/charts/chart_rules'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { softEditBlockTitle } from '#services/premium_report/soft_edit_targets'
import { foldAscii } from '#utils/html_text'
import type { AppLanguage } from '#utils/localize'

export const SHORT_TEXT_PATCH_MAX = 80
export const SHORT_TEXT_PATCH_SENTENCES = 2

export const EVERY_PLAYER_LINE_ASK_RE =
  /\b(?:every\s+player|each\s+player|all\s+(?:the\s+)?(?:my\s+)?players|my\s+players|individual(?:ly)?(?:\s+(?:evolution|evolutions|lines?|curves?|scores?))?|individual\s+(?:player\s+)?(?:lines?|evolutions?|curves?)|one\s+line\s+per\s+player|per[\s-]?player\s+(?:lines?|evolutions?|scores?)|spaghetti)\b/i

export const TEAM_MEAN_ENVELOPE_ASK_RE =
  /\b(?:mean|avg|average|moyenne|team|squad|equipe|envelope|enveloppe|min\s*[-–—]?\s*max|minmax|squad\s*range|range\s*band)\b/i

export const coachAskedEveryPlayerLines = (state: PremiumReportState): boolean =>
  Boolean(state.limits?.individualLinesAsk) ||
  EVERY_PLAYER_LINE_ASK_RE.test(foldAscii(state.requestPrompt))

export const coachAskedTeamMeanEnvelope = (prompt: string): boolean =>
  TEAM_MEAN_ENVELOPE_ASK_RE.test(foldAscii(prompt))

export const isSplitAthleteChunkTitle = (title: string): boolean =>
  /group\s*\d+/i.test(title) || /—\s*.+[–—].+/.test(title)

export const staffSplitGroupTitle = (
  metricTitle: string,
  _group: string[],
  index: number,
  totalGroups: number
): string => {
  const part = totalGroups > 1 ? ` (${index + 1}/${totalGroups})` : ''
  return `${metricTitle}${part}`.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
}

export type AcwrSeriesCheck =
  | { status: 'ok' }
  | { status: 'empty'; errorJson: string }
  | { status: 'sparse'; coerceToBar: true; acwrCol: string; median: number }

export const checkAcwrSeries = (
  dataset: PremiumDataset,
  values: string[]
): AcwrSeriesCheck => {
  const acwrCol = values.find((col) => /acwr/i.test(col))
  if (!acwrCol || !dataset.columns.includes(acwrCol)) return { status: 'ok' }
  const athleteCol =
    dataset.columns.find((col) => /^joueur$/i.test(col)) ??
    dataset.columns.find((col) => /athlete|player/i.test(col))
  if (!athleteCol) return { status: 'ok' }
  const byAthlete = new Map<string, number>()
  for (const row of dataset.rows) {
    const name = String(row[athleteCol] ?? '').trim()
    if (!name) continue
    const n = row[acwrCol]
    const num = typeof n === 'number' ? n : Number(n)
    if (!Number.isFinite(num)) continue
    byAthlete.set(name, (byAthlete.get(name) ?? 0) + 1)
  }
  if (byAthlete.size === 0) {
    return {
      status: 'empty',
      errorJson: JSON.stringify({
        error: `Column '${acwrCol}' has no finite values — skip ACWR line or use a bar of latest non-null only.`,
        available_columns: dataset.columns,
      }),
    }
  }
  const points = [...byAthlete.values()]
  const median = points.sort((a, b) => a - b)[Math.floor(points.length / 2)] ?? 0
  if (median < 3) {
    return { status: 'sparse', coerceToBar: true, acwrCol, median }
  }
  return { status: 'ok' }
}

export const acwrSeriesTooSparse = (dataset: PremiumDataset, values: string[]): string | null => {
  const check = checkAcwrSeries(dataset, values)
  if (check.status === 'empty') return check.errorJson
  if (check.status === 'sparse') {
    return JSON.stringify({
      error: `ACWR series too sparse (median ${check.median} points/athlete). Prefer bar of latest ${check.acwrCol} or athletes:[watch list] — not a full-roster line.`,
      hint: 'Sparse chronic windows invent noisy spikes; use summaryDatasetId bar or Top-N athletes.',
      coerceToBar: true,
      available_columns: dataset.columns,
    })
  }
  return null
}

export const SOFT_ALLOWLIST_ASK_KINDS = new Set<string>([
  PREMIUM_CANVAS_ASK.MICRO_EDIT,
  PREMIUM_CANVAS_ASK.RESHAPE,
  PREMIUM_CANVAS_ASK.REMOVE,
])

export const softAdditiveLocksPrior = (
  state: PremiumReportState,
  id: string,
  opts?: { allowTeamOverlay?: boolean; allowDatasetRebuild?: boolean }
): string | null => {
  if (!state.softPreserveCanvas || !state.softLockedBlockIds?.has(id)) return null
  if (
    state.canvasAsk.kind !== PREMIUM_CANVAS_ASK.NEW_VIZ &&
    state.canvasAsk.kind !== PREMIUM_CANVAS_ASK.DUPLICATE
  ) {
    return null
  }
  if (opts?.allowTeamOverlay) return null
  if (opts?.allowDatasetRebuild) return null
  return JSON.stringify({
    error:
      'soft new_viz: prior block is locked — add_* new blocks only, or update_block with a live datasetId to rebuild series on an existing chart',
    id,
    skipped: true,
  })
}

export const softAllowlistReject = (state: PremiumReportState, id: string): string | null => {
  if (!state.softPreserveCanvas || !SOFT_ALLOWLIST_ASK_KINDS.has(state.canvasAsk.kind)) return null
  const allow = state.softAllowBlockIds
  if (allow === undefined) return null
  if (allow.has(id)) return null
  const allowed = [...allow].map((blockId) => {
    const block = state.document.blocks.find((row) => row.id === blockId)
    return { id: blockId, title: softEditBlockTitle(block), type: block?.type }
  })
  return JSON.stringify({
    error:
      allow.size === 0
        ? 'soft edit: no target blocks resolved from the coach ask — refuse mutation (fail-closed). Clarify which chart/table/section, or use editorial remove on a named title.'
        : 'soft edit: block is outside coach target — only mutate allowlisted ids (e.g. wellness table)',
    id,
    allowed,
    skipped: true,
  })
}

export const softMutateReject = (
  state: PremiumReportState,
  id: string,
  opts?: { allowTeamOverlay?: boolean; allowDatasetRebuild?: boolean }
): string | null => softAdditiveLocksPrior(state, id, opts) ?? softAllowlistReject(state, id)

export const listAvailableBlockIds = (state: PremiumReportState): string[] =>
  state.document.blocks.map((block) => block.id)

export const blockNotFoundError = (state: PremiumReportState, id: string): string =>
  JSON.stringify({
    error: `Block id '${id}' not found.`,
    available_ids: listAvailableBlockIds(state),
  })

export const chartColumnFailFast = (
  dataset: PremiumDataset,
  input: Record<string, unknown>
): string | null => {
  const category = readString(input.category)
  const values = readStringList(input.values)
  return requireDatasetColumns(dataset, [category, ...values])
}


export const resolveToolDataset = (
  state: PremiumReportState,
  input: Record<string, unknown>
): PremiumDataset | undefined | string => {
  const single = readString(input.datasetId)
  const ids = [...new Set([...readStringList(input.datasetIds), ...(single ? [single] : [])])]
  if (ids.length === 0) return undefined
  const datasets: PremiumDataset[] = []
  for (const id of ids) {
    const dataset = state.datasets.get(id)
    if (!dataset) {
      return JSON.stringify({
        error: `Unknown datasetId ${id}`,
        available_ids: [...state.datasets.keys()],
        hint: 'Plan B once: reuse a live Linker datasetId from available_ids — never invent ds_N. If poste missing, join_datasets roster + GPS/load on joueur using club postes only.',
      })
    }
    datasets.push(dataset)
  }
  return mergeChartDatasets(datasets)
}

export const resolveToolDatasetSoft = (
  state: PremiumReportState,
  input: Record<string, unknown>
): { dataset?: PremiumDataset; staleIds: string[] } => {
  const single = readString(input.datasetId)
  const ids = [...new Set([...readStringList(input.datasetIds), ...(single ? [single] : [])])]
  if (ids.length === 0) return { staleIds: [] }
  const datasets: PremiumDataset[] = []
  const staleIds: string[] = []
  for (const id of ids) {
    const dataset = state.datasets.get(id)
    if (!dataset) staleIds.push(id)
    else datasets.push(dataset)
  }
  if (datasets.length === 0) return { staleIds }
  return { dataset: mergeChartDatasets(datasets), staleIds }
}

export const commitInsert = (
  state: PremiumReportState,
  block: PremiumReportBlock,
  after?: string
): string => {
  const result = insertBlock(state.document, block, resolveAfter(state, after), state.limits)
  if (result.includes('"ok":true')) state.lastInsertedId = block.id
  return result
}

export const teamChartMode = (
  state: PremiumReportState,
  explicit: string | undefined,
  chartTitles: string[]
): 'overlay' | 'replace' => {
  if (explicit === 'overlay' || explicit === 'replace') return explicit
  const everyPlayerLines = coachAskedEveryPlayerLines(state)
  if (chartTitles.some(isSplitAthleteChunkTitle) && everyPlayerLines) {
    return 'overlay'
  }
  if (
    /\b(replace|instead|only the team|team only|without (?:the )?players|drop players)\b/i.test(
      state.requestPrompt
    ) &&
    !everyPlayerLines
  ) {
    return 'replace'
  }
  return 'overlay'
}

export const applyChartsToTeam = async (
  state: PremiumReportState,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  const opRaw = readString(input.op)
  const forcedOp: TeamChartOp | undefined = opRaw === 'sum' || opRaw === 'mean' ? opRaw : undefined
  const forcedLabel = readString(input.seriesLabel)?.trim()
  const modeRaw = readString(input.mode)
  const id = readString(input.id)
  const ids = [...new Set([...readStringList(input.ids), ...(id ? [id] : [])])]
  if (ids.length === 0) {
    return {
      error: 'id or ids required — charts_to_team must target exact chart block.id(s) from current',
      skipped: true,
    }
  }
  const charts = state.document.blocks.filter(
    (block): block is PremiumChartBlock =>
      block.type === PREMIUM_BLOCK_TYPE.CHART && ids.includes(block.id)
  )
  if (charts.length === 0) {
    return { error: 'No matching chart blocks', ids }
  }
  const mode = teamChartMode(
    state,
    modeRaw,
    charts.map((chart) => chart.title)
  )
  const lockedPayload = ids
    .map((blockId) => softMutateReject(state, blockId, { allowTeamOverlay: mode === 'overlay' }))
    .find((payload): payload is string => payload != null)
  if (lockedPayload) {
    try {
      return JSON.parse(lockedPayload) as Record<string, unknown>
    } catch {
      return {
        error:
          'soft edit: target block is locked or outside coach allowlist — use allowlisted ids only',
        skipped: true,
      }
    }
  }

  const judgment = await jevTeamChart({
    request: state.requestPrompt,
    language: state.language,
    chartTitles: charts.map((chart) => chart.title),
    op: forcedOp,
    seriesLabel: forcedLabel,
  })
  const { op, seriesLabel } = judgment

  const findSquadDataset = (chartTitle: string): PremiumDataset | undefined => {
    let best: PremiumDataset | undefined
    let bestAthletes = 0
    for (const dataset of state.datasets.values()) {
      if (dataset.id === 'roster' || dataset.rows.length < 4) continue
      const metric = pickSquadMetricColumn(dataset, chartTitle, dataset.columns)
      if (!metric) continue
      const athleteCol = pickAthleteColumn(dataset.columns)
      const athletes = athleteCol
        ? new Set(dataset.rows.map((row) => String(row[athleteCol] ?? '').trim()).filter(Boolean))
            .size
        : 0
      if (!pickDateColumn(dataset.columns) || athletes < 2) continue
      if (athletes >= bestAthletes) {
        best = dataset
        bestAthletes = athletes
      }
    }
    return best
  }

  const converted: Array<{ id: string; title: string; mode: string; rows: number }> = []
  const skipped: Array<{ id: string; title: string; reason: string }> = []

  for (const chart of charts) {
    if (
      mode === 'replace' &&
      isSplitAthleteChunkTitle(chart.title) &&
      coachAskedEveryPlayerLines(state)
    ) {
      skipped.push({
        id: chart.id,
        title: chart.title,
        reason:
          'keep individual chunk chart — use mode=overlay or a dedicated aggregate mean±minmax team chart',
      })
      continue
    }
    const index = state.document.blocks.findIndex((block) => block.id === chart.id)
    if (index < 0) continue
    const embedded = datasetFromChartOption(chart.option)
    if (!embedded || embedded.rows.length === 0) {
      skipped.push({ id: chart.id, title: chart.title, reason: 'no embedded series data' })
      continue
    }
    const collapsed =
      mode === 'overlay'
        ? overlayTeamSeries({
            dataset: embedded,
            op,
            seriesLabel,
            language: state.language,
            squadDataset: findSquadDataset(chart.title),
            chartTitle: chart.title,
          })
        : datasetToTeamGrain({
            dataset: embedded,
            op,
            seriesLabel,
            language: state.language,
          })
    if ('error' in collapsed) {
      skipped.push({ id: chart.id, title: chart.title, reason: collapsed.error })
      continue
    }
    if ('mode' in collapsed && collapsed.mode === 'already_team') {
      skipped.push({ id: chart.id, title: chart.title, reason: 'already team / single series' })
      continue
    }

    const chartType =
      chartTypeFromOption(asEchartsOption(chart.option)) ?? inferChartType(collapsed.dataset)
    state.jevValidations++
    const rules = resolveChartRules({
      request: state.requestPrompt,
      title: chart.title,
      language: state.language,
      chartType,
      rowCount: collapsed.dataset.rows.length,
      hasDate: Boolean(pickDateColumn(collapsed.dataset.columns)),
      columns: collapsed.dataset.columns,
    })
    const refLines = rules.refLines
    const built = buildPresetFromDataset(
      chartType,
      collapsed.dataset,
      undefined,
      undefined,
      refLines,
      state.language,
      chart.title
    )
    if (typeof built === 'string') {
      skipped.push({ id: chart.id, title: chart.title, reason: built })
      continue
    }
    const option = stampMaunaChartLayout(
      bindChartDataset(built, collapsed.dataset, state.language),
      rules.layout === 'auto' ? 'team_mean' : rules.layout
    )
    const nextTitle =
      mode === 'overlay' || /équipe|team|moyenne|mean|collective/i.test(chart.title)
        ? chart.title
        : `${chart.title} — ${seriesLabel}`
    state.document.blocks[index] = {
      ...chart,
      title: nextTitle.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH),
      option,
    }
    converted.push({
      id: chart.id,
      title: nextTitle,
      mode: collapsed.mode,
      rows: collapsed.dataset.rows.length,
    })
  }

  return {
    ok: converted.length > 0,
    op,
    mode,
    seriesLabel,
    jev: { provider: judgment.provider, score: judgment.score },
    converted,
    skipped,
    hint:
      converted.length === 0 ? 'No multi-athlete evolution charts found to collapse' : undefined,
  }
}

export const isShortTextPatch = (text: string): boolean => {
  if (text.length <= SHORT_TEXT_PATCH_MAX) return true
  const sentences = text.split(/[.!?…]+/).filter((part) => part.trim().length > 0)
  return sentences.length <= SHORT_TEXT_PATCH_SENTENCES
}

export const gateTextCaption = async (
  state: PremiumReportState,
  text: string,
  afterId?: string
): Promise<string | null> => {
  if (!state.intent.analysisText) {
    return JSON.stringify({
      error: 'route.intent.analysisText=false — skip add_text',
      skipped: true,
    })
  }
  if (state.limits?.deterministicCaptionGate) {
    const allowed = collectGroundedAthleteNames(
      (state.limits.groundedAthleteNames ?? []).map((name) => ({ name })),
      state.datasets.values()
    )
    const gated = gateDeterministicCaption(text, allowed, Boolean(state.limits.allowNutritionScope))
    if (gated) return gated
  }
  if (state.limits?.skipTextCaptionJev) return null
  state.jevValidations++
  const judgment = await jevTextCaption({
    request: state.requestPrompt,
    caption: text,
    blocks: state.document.blocks,
    afterId,
    lastInsertedId: state.lastInsertedId,
  })
  if (judgment.allow) return null
  state.jevBlocked++
  return JSON.stringify({
    error: 'Caption rejected: not useful enough for the canvas (Jev).',
    suggestion:
      'Skip add_text, or write 2–4 sentences citing only athletes visible on the nearby chart/table — no invented names.',
    score: judgment.score,
    jevBlocked: true,
  })
}

export const resolveAfter = (state: PremiumReportState, after?: string): string =>
  after === 'start' && state.lastInsertedId
    ? state.lastInsertedId
    : after || state.lastInsertedId || state.defaultAfter

export const applySeriesMetaPatch = (
  option: Record<string, unknown>,
  input: Record<string, unknown>
): Record<string, unknown> | string => {
  const color = readString(input.color)?.trim()
  const seriesLabel = readString(input.seriesLabel)?.trim()
  const seriesName = readString(input.seriesName)?.trim()
  const seriesIndexRaw = input.seriesIndex
  const seriesIndex =
    typeof seriesIndexRaw === 'number'
      ? seriesIndexRaw
      : typeof seriesIndexRaw === 'string' && seriesIndexRaw.trim() !== ''
        ? Number(seriesIndexRaw)
        : undefined
  if (!color && !seriesLabel) return option
  if (!Array.isArray(option.series) || option.series.length === 0) {
    return JSON.stringify({ error: 'chart has no series to patch' })
  }
  let index =
    seriesIndex != null && Number.isFinite(seriesIndex) ? Math.trunc(seriesIndex) : undefined
  if (index == null && seriesName) {
    const found = option.series.findIndex(
      (item) =>
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        String((item as { name?: unknown }).name ?? '') === seriesName
    )
    if (found < 0) return JSON.stringify({ error: `seriesName not found: ${seriesName}` })
    index = found
  }
  if (index == null) index = 0
  if (index < 0 || index >= option.series.length) {
    return JSON.stringify({ error: `seriesIndex out of range: ${index}` })
  }
  const series = option.series.map((item, i) => {
    if (i !== index || !item || typeof item !== 'object' || Array.isArray(item)) return item
    return {
      ...(item as Record<string, unknown>),
      ...(color ? { color } : {}),
      ...(seriesLabel ? { name: seriesLabel } : {}),
    }
  })
  return { ...option, series }
}

export const softSafeOptionPatch = (incoming: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...incoming }
  delete next.series
  delete next.dataset
  delete next.xAxis
  delete next.yAxis
  delete next.data
  return next
}

export const deepMergeChartOption = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const prior = base[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prior &&
      typeof prior === 'object' &&
      !Array.isArray(prior)
    ) {
      out[key] = deepMergeChartOption(
        prior as Record<string, unknown>,
        value as Record<string, unknown>
      )
    } else {
      out[key] = value
    }
  }
  return out
}

export const lockChartDataFields = (
  original: Record<string, unknown>,
  merged: Record<string, unknown>
): Record<string, unknown> => {
  const next = { ...merged }
  if (original.dataset !== undefined) next.dataset = original.dataset
  if (original.xAxis !== undefined) next.xAxis = original.xAxis
  if (original.yAxis !== undefined) next.yAxis = original.yAxis
  if (Array.isArray(original.series)) {
    const mergedSeries = Array.isArray(next.series) ? next.series : original.series
    next.series = original.series.map((baseEntry, index) => {
      const patchEntry = mergedSeries[index]
      if (
        !baseEntry ||
        typeof baseEntry !== 'object' ||
        Array.isArray(baseEntry) ||
        !patchEntry ||
        typeof patchEntry !== 'object' ||
        Array.isArray(patchEntry)
      ) {
        return baseEntry
      }
      const base = baseEntry as Record<string, unknown>
      const patch = patchEntry as Record<string, unknown>
      const { data: _drop, ...stylePatch } = patch
      return { ...base, ...stylePatch, ...(base.data !== undefined ? { data: base.data } : {}) }
    })
  }
  return next
}

export const patchChartOrBlock = async (
  current: PremiumReportBlock,
  input: Record<string, unknown>,
  state: PremiumReportState
): Promise<PremiumReportBlock | string> => {
  switch (current.type) {
    case 'heading': {
      const heading = current as PremiumHeadingBlock
      const raw = readString(input.text)
      const text = raw
        ? stripMarkdownDecorations(raw).slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH).trim()
        : undefined
      const level = input.level === 2 ? 2 : input.level === 1 ? 1 : heading.level
      return { ...heading, ...(text ? { text } : {}), ...(level ? { level } : {}) }
    }
    case 'text': {
      const raw = readString(input.text)?.replace(/\r\n/g, '\n')
      const text = raw ? stripMarkdownDecorations(raw).trim() : undefined
      return {
        ...current,
        ...(text ? { text: text.slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH) } : {}),
      }
    }
    case 'table': {
      const table = current as PremiumTableBlock
      const title = readString(input.title)?.trim()
      const { dataset, staleIds } = resolveToolDatasetSoft(state, input)
      if (staleIds.length > 0 && !dataset && !title) {
        return JSON.stringify({
          error: `Unknown datasetId ${staleIds[0]}`,
          suggestion:
            'Update title/style on the table, or re-fetch then update_block with a live datasetId.',
        })
      }
      const built = dataset ? tableFromDataset(dataset, state.language) : undefined
      const next: PremiumTableBlock = {
        ...table,
        ...(title ? { title } : {}),
        ...(built
          ? { columns: built.columns, rows: built.rows }
          : table.columns.some((col) => /_/.test(col))
            ? { columns: relabelTableColumns(table.columns, state.language) }
            : {}),
      }
      const forceHeat = input.heatColors != null
      const hadHeat = Boolean(
        table.option &&
        typeof table.option === 'object' &&
        !Array.isArray(table.option) &&
        (table.option as { heatLegend?: unknown }).heatLegend != null
      )
      return applyTableHeat(next, state.language, {
        heat: forceHeat || hadHeat,
        scales: state.heatScales,
      })
    }
    case 'chart': {
      const chart = current as PremiumChartBlock
      const title = readString(input.title)?.trim()
      let incoming = sanitizePlainObject(input.option)
      const chartTypeRaw = readString(input.chartType)
      const chartType =
        chartTypeRaw && isPremiumChartPreset(chartTypeRaw) ? chartTypeRaw : undefined
      const wantsSeriesMeta =
        Boolean(readString(input.color)?.trim()) || Boolean(readString(input.seriesLabel)?.trim())
      const { dataset: liveDataset, staleIds } = resolveToolDatasetSoft(state, input)
      const hasDatasetId = Boolean(readString(input.datasetId)?.trim())
      const cosmeticPatch = !hasDatasetId && !chartType && !liveDataset
      if ((hasDatasetId || chartType) && !liveDataset && state.softPreserveCanvas) {
        return JSON.stringify({
          error:
            'chartType/datasetId requires a live datasetId — for cosmetic edits pass only title/color/seriesLabel/option (deep-merge; series/axes/dataset are locked)',
          skipped: true,
        })
      }
      if (cosmeticPatch && incoming) {
        incoming = softSafeOptionPatch(incoming)
      }
      let dataset = liveDataset
      if (!dataset && chartType) {
        dataset = datasetFromChartOption(chart.option)
      }
      if (staleIds.length > 0 && !dataset && chartType && !hasChartEmbeddedSource(chart.option)) {
        return JSON.stringify({
          error: `Unknown datasetId ${staleIds[0]}`,
          suggestion:
            'Chart has no embedded data — re-fetch then update_block, or patch title/option/series without chartType.',
        })
      }
      if (dataset) {
        const colError = chartColumnFailFast(dataset, input)
        if (colError) return colError
        const metricWarning = implausibleMetricWarning(dataset, state.dateRange)
        if (metricWarning) return JSON.stringify({ error: metricWarning })
      }
      const resolvedType =
        chartType ??
        (liveDataset
          ? (chartTypeFromOption(asEchartsOption(chart.option)) ?? inferChartType(liveDataset))
          : undefined)
      const rules = resolveChartRules({
        request: state.requestPrompt,
        title: title || chart.title,
        language: state.language,
        chartType: chartTypeRaw || resolvedType,
        rowCount: dataset ? dataset.rows.length : 0,
        hasDate: Boolean(dataset && pickDateColumn(dataset.columns)),
        columns: dataset?.columns,
      })
      const refLines = rules.refLines
      const scoreJobs =
        dataset && resolvedType
          ? scoreChartJobs({
              columns: dataset.columns,
              requestedValues: readStringList(input.values),
              title: title || chart.title,
              chartType: resolvedType,
              language: state.language,
              intentOverride: rules.scoreIntent,
            })
          : null
      if (scoreJobs && scoreJobs.length > 1) {
        return JSON.stringify({
          error:
            'performance_score and injury_risk_score cannot share a line/bar. Update one metric per chart.',
          suggestion:
            'Call update_block with values=["performance_score"] (title Score de performance) and a second update/add_chart for injury_risk_score.',
        })
      }
      const built =
        dataset && resolvedType
          ? buildPresetFromDataset(
              resolvedType,
              dataset,
              readString(input.category),
              scoreJobs?.[0]?.values ?? readStringList(input.values),
              refLines,
              state.language,
              scoreJobs?.[0]?.title ?? title ?? chart.title
            )
          : undefined
      if (typeof built === 'string') return built
      let option = built
        ? built
        : incoming
          ? deepMergeChartOption(chart.option, incoming)
          : chart.option
      if (cosmeticPatch) {
        option = lockChartDataFields(chart.option, option)
      }
      if (dataset) {
        option = bindChartDataset(option, dataset, state.language)
      }
      if (incoming && built) {
        option = deepMergeChartOption(option, softSafeOptionPatch(incoming))
        if (dataset) option = bindChartDataset(option, dataset, state.language)
      }
      if (wantsSeriesMeta) {
        const patched = applySeriesMetaPatch(option, input)
        if (typeof patched === 'string') return patched
        option = patched
        if (cosmeticPatch) option = lockChartDataFields(chart.option, option)
      }
      option = stampMaunaChartLayout(option, rules.layout)
      const resolvedTitle = scoreJobs?.[0]?.title ?? title
      return {
        ...chart,
        ...(resolvedTitle ? { title: resolvedTitle } : {}),
        option,
      }
    }
    default: {
      const _exhaustive: never = current
      return _exhaustive
    }
  }
}

export const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

export const parsePlainObject = (value: unknown): Record<string, unknown> | undefined =>
  sanitizePlainObject(parseJsonValue(value))

export const applyTablePatch = (
  table: PremiumTableBlock,
  style: Record<string, unknown> | undefined,
  reshape: PremiumTableReshape | undefined,
  pruneEmpty: boolean,
  language: AppLanguage = 'fr',
  scales?: StaffHeatScale[]
): { block: PremiumTableBlock; dropped: string[] } | string => {
  let next: PremiumTableBlock = style ? { ...table, option: { ...table.option, ...style } } : table
  if (reshape) {
    const reshaped = reshapePremiumTable(next, reshape)
    if (typeof reshaped === 'string') return reshaped
    next = reshaped
  }
  const forceHeat = Boolean(style && (style.heatColors != null || style.heatLegend != null))
  const hadHeat = Boolean(
    table.option &&
    typeof table.option === 'object' &&
    !Array.isArray(table.option) &&
    (table.option as { heatLegend?: unknown }).heatLegend != null
  )
  const heat = forceHeat || hadHeat
  if (!pruneEmpty) {
    return { block: applyTableHeat(next, language, { heat, scales }), dropped: [] }
  }
  const pruned = pruneEmptyTableColumns(next)
  return {
    block: applyTableHeat(pruned.block, language, { heat, scales }),
    dropped: pruned.dropped,
  }
}

export const patchTables = (
  state: PremiumReportState,
  opts: {
    id?: string
    style?: Record<string, unknown>
    reshape?: PremiumTableReshape
    pruneEmpty: boolean
  }
): string => {
  const tables = state.document.blocks.filter(
    (block): block is PremiumTableBlock =>
      block.type === PREMIUM_BLOCK_TYPE.TABLE && (!opts.id || block.id === opts.id)
  )
  if (tables.length === 0) {
    return JSON.stringify({ error: opts.id ? 'block not found' : 'no table to update' })
  }
  const blockIndex = new Map(state.document.blocks.map((b, i) => [b.id, i]))
  const ids: string[] = []
  const droppedAll: string[] = []
  for (const table of tables) {
    const before = opts.id ? JSON.stringify(table) : null
    const patched = applyTablePatch(
      table,
      opts.style,
      opts.reshape,
      opts.pruneEmpty,
      state.language,
      state.heatScales
    )
    if (typeof patched === 'string') return patched
    if (before && JSON.stringify(patched.block) === before && !patched.dropped.length) {
      return JSON.stringify({
        ok: true,
        unchanged: true,
        id: table.id,
        hint: 'No-op rename/style — continue, do not retry update_block.',
      })
    }
    const index = blockIndex.get(table.id)
    if (index !== undefined) state.document.blocks[index] = patched.block
    ids.push(table.id)
    droppedAll.push(...patched.dropped)
  }
  const dropped = droppedAll.length ? { droppedEmptyColumns: [...new Set(droppedAll)] } : {}
  if (opts.id) {
    const block = state.document.blocks.find((b) => b.id === opts.id) as PremiumTableBlock
    return JSON.stringify({
      ok: true,
      id: opts.id,
      columns: block.columns,
      option: block.option,
      ...dropped,
    })
  }
  return JSON.stringify({ ok: true, blocks: ids, ...dropped })
}

export const readTableReshape = (input: Record<string, unknown>): PremiumTableReshape | undefined => {
  const columns = readStringList(input.columns)
  const dropColumns = readStringList(input.dropColumns)
  const renameRaw = parsePlainObject(input.renameColumns)
  const renameColumns = renameRaw
    ? Object.fromEntries(
        Object.entries(renameRaw).flatMap(([from, to]) =>
          typeof to === 'string' && to.trim() ? [[from, to.trim()]] : []
        )
      )
    : undefined
  if (!columns.length && !dropColumns.length && !Object.keys(renameColumns ?? {}).length)
    return undefined
  return {
    ...(columns.length ? { columns } : {}),
    ...(dropColumns.length ? { dropColumns } : {}),
    ...(renameColumns && Object.keys(renameColumns).length ? { renameColumns } : {}),
  }
}

export const readTableStyle = (
  input: Record<string, unknown>
): Record<string, unknown> | string | undefined => {
  const hasStyleIntent =
    input.option != null ||
    input.header != null ||
    input.columnStyles != null ||
    input.border != null ||
    input.heatColors != null
  const fromOption = parsePlainObject(input.option)
  const header = parsePlainObject(input.header) ?? parsePlainObject(fromOption?.header)
  const columnStyles =
    parsePlainObject(input.columnStyles) ?? parsePlainObject(fromOption?.columnStyles)
  const heatColors =
    parsePlainObject(input.heatColors) ??
    parsePlainObject(fromOption?.heatColors) ??
    parsePlainObject(parsePlainObject(fromOption?.heatLegend)?.colors)
  const out: Record<string, unknown> = { ...(fromOption ?? {}) }
  delete out.cellRules
  if (header) out.header = header
  if (columnStyles) out.columnStyles = columnStyles
  if (heatColors) {
    const prevLegend = parsePlainObject(out.heatLegend) ?? {}
    out.heatLegend = { ...prevLegend, colors: heatColors }
  }
  delete out.heatColors
  if (input.border != null) out.border = parseJsonValue(input.border)
  if (Object.keys(out).length === 0) {
    if (!hasStyleIntent) return undefined
    return JSON.stringify({ error: 'Pass header, columnStyles, heatColors, and/or border=true' })
  }
  return out
}

export const readTableRows = (
  value: unknown,
  columnCount: number
): Array<Array<string | number | null>> => {
  if (!Array.isArray(value) || columnCount === 0) return []
  return value.flatMap((row) => {
    if (!Array.isArray(row)) return []
    const cells: Array<string | number | null> = row.slice(0, columnCount).map((cell) => {
      if (cell === null || cell === undefined) return null
      if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
      if (typeof cell === 'string') return cell
      if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
        const y = cell.getUTCFullYear()
        const m = String(cell.getUTCMonth() + 1).padStart(2, '0')
        const d = String(cell.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      return String(cell)
    })
    return [cells]
  })
}

export const readKeepSeriesIndexes = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const n = typeof item === 'number' ? item : Number(item)
    return Number.isFinite(n) ? [Math.trunc(n)] : []
  })
}

export const resolveFilterColumn = (columns: string[], wanted: string): string | undefined => {
  const needle = wanted.trim().toLowerCase()
  if (!needle) return undefined
  const exact = columns.find((column) => column.toLowerCase() === needle)
  if (exact) return exact
  return columns.find((column) => column.toLowerCase().includes(needle))
}

export const filterChartBlock = (
  chart: PremiumChartBlock,
  input: Record<string, unknown>
): { block: PremiumChartBlock; unchanged: boolean; seriesKept: number } | string => {
  const keepSeries = readStringList(input.keepSeries)
  const keepIndexes = readKeepSeriesIndexes(input.keepSeriesIndexes)
  const column = readString(input.column)
  const opRaw = readString(input.op)
  const hasSeriesFilter = keepSeries.length > 0 || keepIndexes.length > 0
  const hasRowFilter = Boolean(column && opRaw)
  if (!hasSeriesFilter && !hasRowFilter) {
    return JSON.stringify({
      error: 'Pass keepSeries / keepSeriesIndexes, or column+op(+value) for embedded rows',
    })
  }

  let option: Record<string, unknown> = { ...chart.option }
  const seriesRaw = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : []
  let seriesKept = seriesRaw.length

  if (hasSeriesFilter) {
    if (seriesRaw.length === 0) return JSON.stringify({ error: 'chart has no series to filter' })
    const needles = keepSeries.map((name) => name.trim().toLowerCase()).filter(Boolean)
    const indexSet = new Set(keepIndexes)
    const nextSeries = seriesRaw.filter((item, index) => {
      if (indexSet.has(index)) return true
      if (needles.length === 0) return indexSet.size > 0 ? false : true
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false
      const name = String((item as { name?: unknown }).name ?? '').toLowerCase()
      return needles.some((needle) => name.includes(needle))
    })
    if (nextSeries.length === 0) {
      const names = seriesRaw.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return []
        const name = (item as { name?: unknown }).name
        return typeof name === 'string' && name.trim() ? [name] : []
      })
      return JSON.stringify({
        error: 'no series matched keepSeries / keepSeriesIndexes',
        seriesNames: names,
      })
    }
    seriesKept = nextSeries.length
    option = { ...option, series: nextSeries }
  }

  if (hasRowFilter) {
    if (!isFilterOp(opRaw!)) return JSON.stringify({ error: 'invalid op' })
    const dataset = datasetFromChartOption(option)
    if (!dataset) {
      return JSON.stringify({
        error: 'chart has no embedded rows to filter',
        suggestion: 'Use keepSeries on multi-athlete charts, or re-fetch then filter_dataset.',
      })
    }
    const resolved = resolveFilterColumn(dataset.columns, column!)
    if (!resolved) {
      return JSON.stringify({
        error: `column not found: ${column}`,
        columns: dataset.columns,
      })
    }
    let filterValue: number | string | undefined
    if (opRaw !== 'not_null') {
      const parsed = parseFilterCompare(input.value, opRaw)
      if (parsed == null || (typeof parsed === 'string' && !parsed.trim())) {
        return JSON.stringify({
          error: 'value required (string for joueur eq/contains, number for gt/lt)',
        })
      }
      filterValue = parsed
    }
    const next = filterRows(dataset, resolved, opRaw as FilterOp, filterValue)
    if (next.rows.length === 0) {
      return JSON.stringify({
        error: `no rows for ${resolved} ${opRaw} "${filterValue ?? ''}"`,
        columns: dataset.columns,
      })
    }
    option = {
      ...option,
      dataset: { source: datasetToSource(next) },
    }
  }

  const unchanged = JSON.stringify(option) === JSON.stringify(chart.option)
  return {
    block: { ...chart, option },
    unchanged,
    seriesKept,
  }
}

export const filterTableBlock = (
  table: PremiumTableBlock,
  input: Record<string, unknown>
): { block: PremiumTableBlock; unchanged: boolean } | string => {
  const column = readString(input.column)
  const opRaw = readString(input.op)
  if (!column || !opRaw) {
    return JSON.stringify({ error: 'Tables require column+op(+value) to filter rows' })
  }
  if (!isFilterOp(opRaw)) return JSON.stringify({ error: 'invalid op' })
  const resolved = resolveFilterColumn(table.columns, column)
  if (!resolved) {
    return JSON.stringify({
      error: `Column '${column}' not found in dataset.`,
      available_columns: table.columns,
    })
  }
  const asDataset: PremiumDataset = {
    id: 'embedded',
    columns: table.columns,
    rows: table.rows.map((row) => {
      const record: Record<string, unknown> = {}
      for (let i = 0; i < table.columns.length; i++) {
        record[table.columns[i]!] = row[i] ?? null
      }
      return record
    }),
  }
  let filterValue: number | string | undefined
  if (opRaw !== 'not_null') {
    const parsed = parseFilterCompare(input.value, opRaw)
    if (parsed == null || (typeof parsed === 'string' && !parsed.trim())) {
      return JSON.stringify({
        error: 'value required (string for joueur eq/contains, number for gt/lt)',
      })
    }
    filterValue = parsed
  }
  const next = filterRows(asDataset, resolved, opRaw as FilterOp, filterValue)
  if (next.rows.length === 0) {
    return JSON.stringify({
      error: `no rows for ${resolved} ${opRaw} "${filterValue ?? ''}"`,
      columns: table.columns,
    })
  }
  const rows = next.rows.map((row) =>
    table.columns.map((col) => {
      const cell = row[col]
      if (cell === null || cell === undefined) return null
      if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
      if (typeof cell === 'string') return cell
      return String(cell)
    })
  )
  const unchanged = JSON.stringify(rows) === JSON.stringify(table.rows)
  return {
    block: unchanged ? table : { ...table, rows },
    unchanged,
  }
}