import {
  PREMIUM_BLOCK_TYPE,
  PREMIUM_REPORT_MAX_BLOCKS,
  PREMIUM_REPORT_MAX_CHARTS,
} from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN, type PremiumDomain } from '#constants/premium_report_domains'
import type { PremiumDataset, PremiumReportBlock } from '#contracts/premium_report'
import {
  filterDatasetByAthletes,
  inferChartType,
  listDatasetAthletes,
  pickCategoryColumn,
} from '#services/premium_report/chart_presets'
import { displayColumnLabel } from '#services/premium_report/column_labels'
import {
  pickDateColumn,
  readString,
  readStringList,
  toNumber,
} from '#services/premium_report/dataset_ops'
import {
  newBlockId,
  projectDatasetColumns,
  stripMarkdownDecorations,
  tableFromDataset,
} from '#services/premium_report/premium_report_document'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { executeAddChart } from '#services/premium_report/tools_document_charts_add'
import {
  applyChartsToTeam,
  commitInsert,
} from '#services/premium_report/tools_document_shared'
import { isRosterDataset } from '#services/report_v4/harvest_plan'
import type { ReportBrief } from '#services/report_v4/report_brief'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import {
  collectGroundedAthleteNames,
  gateDeterministicCaption,
} from '#services/report_v4/grounding_report'
import {
  athletePresentInAnyDataset,
  collectPresentPlayerNames,
  mapPresentPlayersByDataset,
} from '#services/report_v4/present_players'
import {
  selectSheetMeasures,
  type SheetMeasurePick,
} from '#services/report_v4/sheet_measure_selector'
import {
  buildSheetCommentFactsForAthlete,
  commentCitesImputedValue,
  gateSheetCommentAgainstFacts,
  type SheetCommentFact,
} from '#services/report_v4/sheet_comment_facts'
import { orderAthletesByWatchSignal } from '#services/report_v4/watchlist_rank'

export type SheetAthlete = {
  id?: string
  name: string
  position: string
}

const DOMAIN_COLUMN_HINT: Partial<Record<PremiumDomain, RegExp>> = {
  [PREMIUM_DOMAIN.LOAD]: /srpe|acwr|ewma|monotony|strain/i,
  [PREMIUM_DOMAIN.SCORES]: /performance_score|injury_risk_score/i,
  [PREMIUM_DOMAIN.GPS]:
    /distance.*abs|abs.*distance|total_distance|distance_m|hmld|hsr|sprint|player.?load|duration|speed/i,
  [PREMIUM_DOMAIN.WELLNESS]:
    /mood_rating|stress_rating|energy_rating|body_soreness|wellbeing_rating/i,
  [PREMIUM_DOMAIN.SLEEP]: /sleep|quality_rating|efficiency/i,
  [PREMIUM_DOMAIN.BIOMARKERS]: /ck|creatine|biomark|hemoglobin|ferritin|cortisol|valeur/i,
  [PREMIUM_DOMAIN.BODY]: /body|fat|mass|weight|skinfold/i,
  [PREMIUM_DOMAIN.MATCH]:
    /match|nb_matchs|minutes_?played|playing.?time|tackles?|total_?distance|sprint|intensive_?run|max_?speed|top_?speed/i,
  [PREMIUM_DOMAIN.VALD]: /vald|cmj|jump|force|asymmetr/i,
  [PREMIUM_DOMAIN.INJURY]:
    /date_of_injury|recovery_date|contact_type|patholog|^status$|^injury$|^location$|mechanism|tissue/i,
}

const foldName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()

const comparePosteThenName = (left: SheetAthlete, right: SheetAthlete): number => {
  const poste = (left.position || '\uffff').localeCompare(right.position || '\uffff', 'en', {
    sensitivity: 'base',
  })
  if (poste !== 0) return poste
  return left.name.localeCompare(right.name, 'en', { sensitivity: 'base' })
}

export const sortAthletesByPosteThenName = (athletes: SheetAthlete[]): SheetAthlete[] =>
  [...athletes].sort(comparePosteThenName)

export const orderAthletesForSheets = (args: {
  athletes: SheetAthlete[]
  brief?: ReportBrief | null
  datasets?: Iterable<PremiumDataset>
  presentNames?: Set<string>
}): SheetAthlete[] => {
  const byFold = new Map(args.athletes.map((row) => [foldName(row.name), row] as const))
  const override: SheetAthlete[] = []
  const seen = new Set<string>()
  const pushName = (name: string) => {
    const key = foldName(name)
    const row = byFold.get(key)
    if (!row || seen.has(key)) return
    if (args.presentNames && !args.presentNames.has(key)) return
    seen.add(key)
    override.push(row)
  }
  if (args.brief) {
    for (const section of args.brief.sections) {
      if (section.kind === 'athlete' && section.athleteName) pushName(section.athleteName)
    }
    for (const signal of args.brief.signals) {
      if (signal.athlete) pushName(signal.athlete)
    }
  }
  if (args.datasets && override.length > 1) {
    const ranked = orderAthletesByWatchSignal({
      athletes: override,
      datasets: args.datasets,
      brief: args.brief,
      presentNames: args.presentNames,
    })
    override.splice(0, override.length, ...ranked.ordered)
  }
  const withData = args.athletes.filter((row) => {
    const key = foldName(row.name)
    if (seen.has(key)) return false
    return !args.presentNames || args.presentNames.has(key)
  })
  const missing = args.athletes.filter((row) => {
    const key = foldName(row.name)
    if (seen.has(key)) return false
    return Boolean(args.presentNames) && !args.presentNames!.has(key)
  })
  return [
    ...override,
    ...sortAthletesByPosteThenName(withData),
    ...sortAthletesByPosteThenName(missing),
  ]
}

const metricDatasets = (state: PremiumReportState): PremiumDataset[] =>
  [...state.datasets.values()].filter(
    (dataset) =>
      !isRosterDataset(dataset) && dataset.rows.length > 0 && dataset.columns.length > 0
  )

const datasetMatchesDomain = (dataset: PremiumDataset, domain: PremiumDomain): boolean => {
  if (dataset.domain === domain) return true
  const hint = DOMAIN_COLUMN_HINT[domain]
  if (!hint) return false
  return dataset.columns.some((col) => hint.test(col))
}

const resolveSheetMetrics = (args: {
  datasets: PremiumDataset[]
  domains: PremiumDomain[]
  metrics: string[]
}): { picks: SheetMeasurePick[]; choiceRule: string } => {
  const domainPool =
    args.domains.length > 0
      ? args.datasets.filter((dataset) =>
          args.domains.some((domain) => datasetMatchesDomain(dataset, domain))
        )
      : args.datasets
  const pool = domainPool.length > 0 ? domainPool : args.datasets
  const selected = selectSheetMeasures({
    datasets: pool,
    domains: args.domains,
    askMetrics: args.metrics,
    maxMeasures: 4,
  })
  return { picks: selected.picks, choiceRule: selected.choiceRule }
}

const meanForMetric = (dataset: PremiumDataset, metric: string): number | null => {
  const values: number[] = []
  for (const row of dataset.rows) {
    const n = toNumber(row[metric])
    if (n != null) values.push(n)
  }
  if (values.length === 0) return null
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

const formatKpiStrip = (args: {
  athlete: string
  picks: SheetMeasurePick[]
  datasets: Map<string, PremiumDataset>
  language: 'fr' | 'en'
}): string => {
  const parts: string[] = []
  for (const pick of args.picks) {
    const dataset = args.datasets.get(pick.datasetId)
    if (!dataset) continue
    const filtered = filterDatasetByAthletes(dataset, [args.athlete])
    const mean = meanForMetric(filtered, pick.metric)
    if (mean == null) continue
    const label = displayColumnLabel(pick.metric, args.language)
    parts.push(`${label}: ${Number(mean.toFixed(1))}`)
  }
  if (parts.length === 0) return ''
  return `KPI — ${parts.join(' · ')}`
}

const insertTextAfter = (
  state: PremiumReportState,
  text: string,
  cursor: string | undefined
): string | undefined => {
  const block: PremiumReportBlock = {
    id: newBlockId(),
    type: PREMIUM_BLOCK_TYPE.TEXT,
    text: text.slice(0, 8000),
  }
  const inserted = commitInsert(state, block, cursor)
  try {
    const parsed = JSON.parse(inserted) as { ok?: boolean; id?: string; error?: string }
    if (parsed.error) return cursor
    return parsed.id ?? block.id
  } catch {
    return block.id
  }
}

const resolveAthletes = (args: {
  state: PremiumReportState
  roster: RosterAthlete[]
  requiredAthletes: string[]
  input: Record<string, unknown>
}): SheetAthlete[] => {
  const byId = new Map(args.roster.map((row) => [row.id, row] as const))
  const byName = new Map(args.roster.map((row) => [foldName(row.name), row] as const))
  const fromRoster = (name: string, id?: string): SheetAthlete => {
    const hit = (id && byId.get(id)) || byName.get(foldName(name))
    return {
      id: hit?.id ?? id,
      name: hit?.name ?? name,
      position: hit?.position ?? '',
    }
  }

  const athleteIds = readStringList(args.input.athleteIds)
  if (athleteIds.length > 0) {
    return athleteIds
      .map((id) => {
        const hit = byId.get(id)
        return hit
          ? { id: hit.id, name: hit.name, position: hit.position }
          : { id, name: id, position: '' }
      })
      .filter((row) => row.name)
  }

  const athleteNames = readStringList(args.input.athletes)
  if (athleteNames.length > 0) {
    return athleteNames.map((name) => fromRoster(name))
  }

  if (args.input.allWithData === true) {
    const names = new Set<string>()
    for (const dataset of metricDatasets(args.state)) {
      for (const name of listDatasetAthletes(dataset)) names.add(name)
    }
    return [...names].map((name) => fromRoster(name))
  }

  if (args.requiredAthletes.length > 0) {
    return args.requiredAthletes.map((name) => fromRoster(name))
  }

  return args.roster.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
  }))
}

export const executeBuildAthleteSheets = async (args: {
  state: PremiumReportState
  roster: RosterAthlete[]
  requiredAthletes: string[]
  domains: PremiumDomain[]
  metrics: string[]
  brief?: ReportBrief | null
  input: Record<string, unknown>
}): Promise<string> => {
  const datasets = metricDatasets(args.state)
  if (datasets.length === 0) {
    return JSON.stringify({
      error: 'No metric datasets available for athlete sheets',
      hint: 'Linker must harvest domain macros before build_athlete_sheets',
    })
  }
  const presentMap = mapPresentPlayersByDataset(args.state.datasets.values())
  const presentNames = collectPresentPlayerNames(presentMap)
  const athletes = orderAthletesForSheets({
    athletes: resolveAthletes({
      state: args.state,
      roster: args.roster,
      requiredAthletes: args.requiredAthletes,
      input: args.input,
    }),
    brief: args.brief,
    datasets: args.state.datasets.values(),
    presentNames,
  })
  if (athletes.length === 0) {
    return JSON.stringify({ error: 'No athletes to build sheets for' })
  }
  const inputMetrics = readStringList(args.input.metrics)
  const inputDomains = readStringList(args.input.domains) as PremiumDomain[]
  const resolved = resolveSheetMetrics({
    datasets,
    domains: inputDomains.length > 0 ? inputDomains : args.domains,
    metrics: inputMetrics.length > 0 ? inputMetrics : args.metrics,
  })
  const metrics = resolved.picks
  if (metrics.length === 0) {
    return JSON.stringify({
      error: 'No metrics found in live datasets for athlete sheets',
      available_ids: datasets.map((row) => row.id),
    })
  }
  const headings: string[] = []
  const charts: string[] = []
  const tables: string[] = []
  const shortSheets: string[] = []
  const sheetBlockIds: string[] = []
  let cursor: string | undefined
  const language = args.state.language === 'en' ? 'en' : 'fr'
  const chartPicks = metrics.slice(0, 2)
  args.state.limits = {
    ...args.state.limits,
    maxCharts: Math.max(
      args.state.limits?.maxCharts ?? PREMIUM_REPORT_MAX_CHARTS,
      athletes.length * chartPicks.length + 4
    ),
    maxBlocks: Math.max(
      args.state.limits?.maxBlocks ?? PREMIUM_REPORT_MAX_BLOCKS,
      athletes.length * 8 + 8
    ),
  }

  for (const athlete of athletes) {
    const heading: PremiumReportBlock = {
      id: newBlockId(),
      type: PREMIUM_BLOCK_TYPE.HEADING,
      text: athlete.name.slice(0, 200),
      level: 2,
    }
    const headingResult = commitInsert(args.state, heading, cursor)
    try {
      const parsed = JSON.parse(headingResult) as { ok?: boolean; id?: string; error?: string }
      if (parsed.error) return headingResult
      cursor = parsed.id ?? heading.id
      headings.push(cursor)
      sheetBlockIds.push(cursor)
    } catch {
      cursor = heading.id
      headings.push(cursor)
      sheetBlockIds.push(cursor)
    }

    const hasData = athletePresentInAnyDataset(athlete.name, presentNames)
    if (!hasData) {
      const next = insertTextAfter(
        args.state,
        `${athlete.name}: no data for the display period — short sheet delivered.`,
        cursor
      )
      if (next) {
        cursor = next
        sheetBlockIds.push(next)
      }
      shortSheets.push(athlete.name)
      continue
    }

    cursor = insertTextAfter(args.state, resolved.choiceRule, cursor) ?? cursor
    if (cursor) sheetBlockIds.push(cursor)

    const kpiStrip = formatKpiStrip({
      athlete: athlete.name,
      picks: metrics,
      datasets: args.state.datasets,
      language,
    })
    if (kpiStrip) {
      cursor = insertTextAfter(args.state, kpiStrip, cursor) ?? cursor
      if (cursor) sheetBlockIds.push(cursor)
    }

    let sheetCharts = 0
    for (const { datasetId, metric } of chartPicks) {
      const dataset = args.state.datasets.get(datasetId)
      if (!dataset) continue
      const filtered = filterDatasetByAthletes(dataset, [athlete.name])
      if (filtered.rows.length === 0) continue
      const chartType = pickDateColumn(filtered.columns) ? 'line' : inferChartType(filtered)
      const metricLabel = displayColumnLabel(metric, language)
      const chartResult = await executeAddChart(args.state, {
        title: `${metricLabel} — team mean ref`,
        datasetId,
        chartType,
        values: [metric],
        athletes: [athlete.name],
        after: cursor,
      })
      try {
        const parsed = JSON.parse(chartResult) as {
          ok?: boolean
          id?: string
          charts?: Array<{ id: string }>
          error?: string
        }
        if (parsed.error) continue
        const chartId = parsed.id ?? parsed.charts?.[0]?.id
        if (chartId) {
          await applyChartsToTeam(args.state, { id: chartId, mode: 'overlay', op: 'mean' })
          cursor = chartId
          charts.push(chartId)
          sheetBlockIds.push(chartId)
          sheetCharts += 1
        }
      } catch {
        continue
      }
    }

    const tableSource = metrics[0] ? args.state.datasets.get(metrics[0].datasetId) : undefined
    if (tableSource) {
      const filtered = filterDatasetByAthletes(tableSource, [athlete.name])
      if (filtered.rows.length > 0) {
        const athleteCol = pickCategoryColumn(filtered)
        const dateCol = pickDateColumn(filtered.columns)
        const metricCols = metrics
          .filter((row) => row.datasetId === tableSource.id)
          .map((row) => row.metric)
        const columns = [...(dateCol ? [dateCol] : []), athleteCol, ...metricCols].filter(
          (col): col is string => Boolean(col)
        )
        const projected = projectDatasetColumns(filtered, [...new Set(columns)])
        const forTable = typeof projected === 'string' ? filtered : projected
        const built = tableFromDataset(forTable, args.state.language)
        if (built.columns.length > 0 && built.rows.length > 0) {
          const tableBlock: PremiumReportBlock = {
            id: newBlockId(),
            type: PREMIUM_BLOCK_TYPE.TABLE,
            title: sheetCharts === 0 ? athlete.name : `${athlete.name} — summary`,
            columns: built.columns,
            rows: built.rows,
          }
          const inserted = commitInsert(args.state, tableBlock, cursor)
          try {
            const parsed = JSON.parse(inserted) as { ok?: boolean; id?: string; error?: string }
            if (!parsed.error) {
              cursor = parsed.id ?? tableBlock.id
              tables.push(cursor)
              sheetBlockIds.push(cursor)
            }
          } catch {
            cursor = tableBlock.id
            tables.push(cursor)
            sheetBlockIds.push(cursor)
          }
        }
      }
    }
  }

  const priorLocks = args.state.sheetLockedBlockIds ?? new Set<string>()
  args.state.sheetLockedBlockIds = new Set([...priorLocks, ...sheetBlockIds])
  args.state.sheetRetainedMeasures = metrics.map((row) => ({
    datasetId: row.datasetId,
    metric: row.metric,
  }))

  const sheetCommentFacts: Record<string, SheetCommentFact[]> = {}
  for (const athlete of athletes) {
    sheetCommentFacts[athlete.name] = buildSheetCommentFactsForAthlete({
      athlete: athlete.name,
      measures: args.state.sheetRetainedMeasures,
      datasets: args.state.datasets.values(),
    })
  }

  return JSON.stringify({
    ok: true,
    athletes: athletes.map((row) => row.name),
    order: athletes.map((row) => ({ name: row.name, position: row.position })),
    headings: headings.length,
    charts: charts.length,
    tables: tables.length,
    shortSheets,
    metrics: metrics.map((row) => row.metric),
    choiceRule: resolved.choiceRule,
    presentPlayers: presentMap,
    sheetCommentFacts,
  })
}

const resolveSheetCommentMeasures = (state: PremiumReportState): Array<{
  datasetId: string
  metric: string
}> => {
  if (state.sheetRetainedMeasures?.length) return state.sheetRetainedMeasures
  const datasets = metricDatasets(state)
  if (datasets.length === 0) return []
  const selected = selectSheetMeasures({
    datasets,
    domains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.LOAD, PREMIUM_DOMAIN.SCORES],
    maxMeasures: 4,
  })
  return selected.picks.map((row) => ({ datasetId: row.datasetId, metric: row.metric }))
}

export const executeAddSheetComments = async (args: {
  state: PremiumReportState
  input: Record<string, unknown>
}): Promise<string> => {
  const raw = args.input.comments
  if (!Array.isArray(raw) || raw.length === 0) {
    return JSON.stringify({
      error: 'comments[] required',
      hint: 'Pass one array of { athlete, text } for all sheets in a single call',
    })
  }
  const allowed = collectGroundedAthleteNames(
    (args.state.limits?.groundedAthleteNames ?? []).map((name) => ({ name })),
    args.state.datasets.values()
  )
  const allowNutrition = Boolean(args.state.limits?.allowNutritionScope)
  const measures = resolveSheetCommentMeasures(args.state)
  const language = args.state.language === 'en' ? 'en' : 'fr'
  const applied: Array<{ athlete: string; blockId: string; facts: SheetCommentFact[] }> = []
  const rejected: Array<{ athlete: string; error: string }> = []
  const factsByAthlete: Record<string, SheetCommentFact[]> = {}

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    const athlete = readString(row.athlete)?.trim()
    const text = stripMarkdownDecorations(readString(row.text)?.replace(/\r\n/g, '\n') ?? '').trim()
    if (!athlete || !text) {
      rejected.push({ athlete: athlete || '?', error: 'athlete and text required' })
      continue
    }
    const facts = buildSheetCommentFactsForAthlete({
      athlete,
      measures,
      datasets: args.state.datasets.values(),
    })
    factsByAthlete[athlete] = facts
    const imputed = commentCitesImputedValue({
      text,
      athlete,
      datasets: args.state.datasets.values(),
      language,
    })
    if (imputed) {
      rejected.push({ athlete, error: imputed })
      continue
    }
    if (facts.length > 0) {
      const factGate = gateSheetCommentAgainstFacts({ text, facts })
      if (factGate) {
        rejected.push({ athlete, error: factGate })
        continue
      }
    }
    const gated = gateDeterministicCaption(text, allowed, allowNutrition)
    if (gated) {
      try {
        const parsed = JSON.parse(gated) as { error?: string }
        rejected.push({ athlete, error: parsed.error || 'caption rejected' })
      } catch {
        rejected.push({ athlete, error: 'caption rejected' })
      }
      continue
    }
    const heading = args.state.document.blocks.find(
      (block) =>
        block.type === PREMIUM_BLOCK_TYPE.HEADING && foldName(block.text) === foldName(athlete)
    )
    if (!heading) {
      rejected.push({ athlete, error: 'athlete heading not found — call build_athlete_sheets first' })
      continue
    }
    const block: PremiumReportBlock = {
      id: newBlockId(),
      type: PREMIUM_BLOCK_TYPE.TEXT,
      text: text.slice(0, 8000),
    }
    const inserted = commitInsert(args.state, block, heading.id)
    try {
      const parsed = JSON.parse(inserted) as { ok?: boolean; id?: string; error?: string }
      if (parsed.error) {
        rejected.push({ athlete, error: parsed.error })
        continue
      }
      applied.push({ athlete, blockId: parsed.id ?? block.id, facts })
    } catch {
      applied.push({ athlete, blockId: block.id, facts })
    }
  }

  if (applied.length === 0) {
    return JSON.stringify({ error: 'No sheet comments applied', rejected, factsByAthlete })
  }
  return JSON.stringify({
    ok: true,
    applied,
    rejected: rejected.length > 0 ? rejected : undefined,
    factsByAthlete,
  })
}

export const createAthleteSheetsTools = (args: {
  state: PremiumReportState
  roster: RosterAthlete[]
  requiredAthletes: string[]
  domains: PremiumDomain[]
  metrics: string[]
  getBrief?: () => ReportBrief | null
}): PremiumTool[] => [
  {
    schema: {
      name: 'build_athlete_sheets',
      description:
        'Rebuild ALL individual athlete sheets from the ask contract (athletes, domains, metrics). Sheets are usually prebuilt by code before the Analyst runs — call only for soft/recovery. Default order: position then name (ReportBrief athlete sections may override). Prefer add_sheet_comments once — never hand-build with add_heading/add_chart loops.',
      input_schema: {
        type: 'object',
        properties: {
          athleteIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional athlete ids. Default: ask-contract required athletes.',
          },
          athletes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional athlete names. Default: ask-contract required athletes.',
          },
          allWithData: {
            type: 'boolean',
            description: 'When true, include every athlete present in metric datasets.',
          },
          domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional domain filter. Default: ask-contract domains.',
          },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional metric columns. Default: ask-contract / harvest metrics.',
          },
        },
      },
    },
    execute: async (input) =>
      executeBuildAthleteSheets({
        state: args.state,
        roster: args.roster,
        requiredAthletes: args.requiredAthletes,
        domains: args.domains,
        metrics: args.metrics,
        brief: args.getBrief?.() ?? null,
        input,
      }),
  },
  {
    schema: {
      name: 'add_sheet_comments',
      description:
        'Write staff comments for athlete sheets in ONE call after build_athlete_sheets. Pass comments:[{athlete,text}]. Each athlete receives sheet facts for retained measures (min/max/mean/delta vs team) — cite only those values; ranges need both bounds as facts. Imputed/sentinel cells are forbidden. Roster ∪ dataset athletes only.',
      input_schema: {
        type: 'object',
        properties: {
          comments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                athlete: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['athlete', 'text'],
            },
          },
        },
        required: ['comments'],
      },
    },
    execute: async (input) => executeAddSheetComments({ state: args.state, input }),
  },
]
