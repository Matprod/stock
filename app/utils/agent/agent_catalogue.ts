import { DateTime } from 'luxon'
import Athlete from '#models_pg/athlete'
import type { AgentContext } from '#contracts/agent'
import { CLUB_METRICS_LOOKBACK_DAYS } from '#constants/agent.constants'
import { PeriodMetricService } from '#services/period_metric_service'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

export type ClubCatalogueId =
  'period_metrics' | 'sport_activity_metrics' | 'biomarkers' | 'vald_tests' | 'health_metrics'

type ClubLookbackWindow = { clubId: string; startDate: string; endDate: string }

type CatalogueMeta = {
  title: string
  nameField: string
  stubHint: string
  emptyMessage: string
  rules: string[]
}

const periodMetrics = new PeriodMetricService()

const CATALOGUE_META: Record<ClubCatalogueId, CatalogueMeta> = {
  period_metrics: {
    title: 'CLUB PERIOD METRICS',
    nameField: 'pm.name',
    stubHint: 'Do not invent names.',
    emptyMessage: 'none with values.',
    rules: [
      'Use ONLY these pm.name.',
      'Unit is club-aware: COALESCE(period_metric_club_units.unit, pm.unit). Always SELECT the resolved unit — never hardcode m/km.',
    ],
  },
  sport_activity_metrics: {
    title: 'CLUB SPORT ACTIVITY METRICS',
    nameField: 'sam.name',
    stubHint: 'Do not invent names.',
    emptyMessage: 'none with values.',
    rules: [
      'Use ONLY these sam.name. Always SELECT sam.unit. Tackles: tackles_won / tackles_contested.',
    ],
  },
  biomarkers: {
    title: 'CLUB BIOMARKERS',
    nameField: 'bt.name',
    stubHint: 'Do not invent type names.',
    emptyMessage: 'none enabled for this club.',
    rules: ['Use ONLY these bt.name. Always SELECT bt.unit. Date via measured_at (no day_id).'],
  },
  vald_tests: {
    title: 'CLUB VALD TESTS (ForceDecks)',
    nameField: 't.test_type + trial metric column',
    stubHint: 'Do not invent test types or metric columns. Detailed numbers are on vald_trials.',
    emptyMessage: 'none with values for this club.',
    rules: [
      'Detailed metrics are available by querying vald_trial',
      'Use ONLY listed test_type values and trial metric columns (trial_jump_height, trial_rsi_modified, trial_peak_takeoff_power, trial_concentric_rfd, trial_peak_landing_force, trial_time_to_stabilisation, trial_rsi, trial_eccentric_braking_rfd).',
      'Join: vald_tests t → vald_trials vt (vt.vald_test_id = t.id) → days d (d.id = t.day_id) → athletes a (a.id = d.athlete_id). Filter a.club_id.',
      'Aggregate with MAX(vt.<metric>) per athlete and d.date_of_day (daily max across trials). Never AVG trials unless the user explicitly asks for an average.',
    ],
  },
  health_metrics: {
    title: 'CLUB HEALTH METRICS (additional self-reported/subjective data for this club)',
    nameField: 'hm.name',
    stubHint: 'Do not invent names.',
    emptyMessage: 'none with values (this club has no custom health_metrics).',
    rules: [
      'IMPORTANT: these ARE subjective/self-reported data (e.g. training RPE variants), same category as health_ratings / sleeps subjective ratings. A question asking broadly for "subjective data" or "wellness" MUST also consider these — for some clubs these are the ONLY populated subjective columns.',
      'Use ONLY these hm.name. If combining into an existing aggregate query is complex, run it as a separate query_database call instead of skipping it.',
      "Pivot pattern per metric, aggregated by day (adapt <NAME> and alias):\nSELECT d.date_of_day, ROUND(AVG(hmv.value::numeric), 1) AS avg_metric\nFROM health_metric_values hmv\nJOIN health_metrics hm ON hm.id = hmv.metric_id AND hm.name = '<NAME>'\nJOIN health_ratings hr ON hr.id = hmv.health_id\nJOIN days d ON d.id = hr.day_id\nJOIN athletes a ON a.id = d.athlete_id\nWHERE a.club_id = '<club_id>' AND d.date_of_day BETWEEN <start> AND <end>\nGROUP BY d.date_of_day ORDER BY d.date_of_day",
    ],
  },
}

const ALL_CATALOGUE_IDS = Object.keys(CATALOGUE_META) as ClubCatalogueId[]
const CHATBOT_CATALOGUE_IDS = ALL_CATALOGUE_IDS.filter((id) => id !== 'vald_tests')
const CHATBOT_PERIOD_METRIC_RULES = ['Use ONLY these pm.name. Always SELECT pm.unit.']

export const buildClubMetricsPromptBlocks = async (
  context?: AgentContext,
  catalogueIds?: ClubCatalogueId[],
  opts?: { reportSql?: boolean }
): Promise<{ block: string; stub: string }> => {
  const window = await resolveClubLookbackWindow(context)
  if (!window) return { block: '', stub: '' }

  const reportSql = opts?.reportSql === true
  const defaultIds = reportSql ? ALL_CATALOGUE_IDS : CHATBOT_CATALOGUE_IDS
  const ids = catalogueIds?.length ? catalogueIds : defaultIds
  const blocks = await Promise.all(ids.map((id) => buildCatalogueBlock(id, window, reportSql)))

  const healthBlock = blocks.find((_, i) => ids[i] === 'health_metrics')
  const rpeAlert = extractRpeAlertFromBlock(healthBlock?.block ?? '')

  return {
    block: `${rpeAlert}${blocks.map((b) => b.block).join('')}`,
    stub: `${rpeAlert}${blocks.map((b) => b.stub).join('')}`,
  }
}

const extractRpeAlertFromBlock = (block: string): string => {
  const match = block.match(/HARD RULE —[^\n]*RPE[^\n]+/)
  return match ? `\n\n⚠️ ${match[0]}` : ''
}

const buildCatalogueBlock = async (
  id: ClubCatalogueId,
  window: ClubLookbackWindow,
  reportSql: boolean
): Promise<{ block: string; stub: string }> => {
  const meta = CATALOGUE_META[id]
  if (!meta) throw new Error(`Unknown club catalogue: ${id}`)

  const names = await loadCatalogueNames(id, window, reportSql)
  const rules = id === 'period_metrics' && !reportSql ? CHATBOT_PERIOD_METRIC_RULES : meta.rules
  const extraRules = buildDynamicCatalogueRules(id, names)
  const allRules = [...rules, ...extraRules]
  const stubRules = extraRules.length ? ` ${extraRules.join(' ')}` : ''
  const stub = `\n\n${meta.title}: reuse ${meta.nameField} from this club list / prior SQL. ${meta.stubHint}${stubRules}`

  if (!names.length) {
    return { block: `\n\n${meta.title}: ${meta.emptyMessage}`, stub }
  }

  const range = `${window.startDate}→${window.endDate}`
  const block = [
    `\n\n${meta.title}`,
    `Source of truth (${range}, ${names.length}): ${names.join(', ')}`,
    ...allRules,
  ].join('\n')

  return { block, stub }
}

const buildDynamicCatalogueRules = (id: ClubCatalogueId, names: string[]): string[] => {
  if (id !== 'health_metrics' || names.length === 0) return []
  const rpeNames = names.filter((name) => /rpe/i.test(name))
  if (rpeNames.length === 0) return []
  return [
    `HARD RULE — Session RPE is ONLY health_metric_values (hm.name IN: ${rpeNames.join(', ')}). Query hmv+hm+hr+days+athletes. NEVER query/mention sport_activities.rpe or an "Activity RPE" section. Daily body wellness (body_soreness_rating) uses the club subjective scales block — answer with that block's label, not sa.rpe.`,
  ]
}

const loadCatalogueNames = async (
  id: ClubCatalogueId,
  window: ClubLookbackWindow,
  reportSql: boolean
): Promise<string[]> => {
  switch (id) {
    case 'period_metrics': {
      if (!reportSql) {
        return periodMetrics.getClubMetrics(window.clubId, window.startDate, window.endDate)
      }
      const rows = await periodMetrics.getClubMetricsWithUnits(
        window.clubId,
        window.startDate,
        window.endDate
      )
      return rows.map((r) => (r.unit ? `${r.name} (${r.unit})` : r.name))
    }
    case 'sport_activity_metrics':
      return getClubSportActivityMetricNames(window)
    case 'biomarkers':
      return getClubBiomarkerNames(window.clubId)
    case 'vald_tests':
      return getClubValdTestTypeNames(window)
    case 'health_metrics':
      return getClubHealthMetricNames(window)
  }
}

const loadDistinctNames = async (
  label: string,
  run: () => Promise<Array<{ name?: unknown }>>,
  meta: Record<string, unknown> = {}
): Promise<string[]> => {
  try {
    const rows = await run()
    return rows.map((r) => String(r.name))
  } catch (error) {
    logger.warn({ err: error, ...meta }, `Failed to load ${label}`)
    return []
  }
}

const getClubSportActivityMetricNames = (window: ClubLookbackWindow): Promise<string[]> =>
  loadDistinctNames(
    'club sport activity metrics',
    () =>
      db
        .from('sport_activity_metrics as sam')
        .join('sport_activity_metric_values as samv', 'samv.metric_id', 'sam.id')
        .join('sport_activities as sa', 'sa.id', 'samv.sport_activity_id')
        .join('days as d', 'd.id', 'sa.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .where('a.club_id', window.clubId)
        .whereBetween('d.date_of_day', [window.startDate, window.endDate])
        .distinct('sam.name')
        .orderBy('sam.name')
        .select('sam.name'),
    window
  )

const getClubBiomarkerNames = (clubId: string): Promise<string[]> =>
  loadDistinctNames(
    'club biomarker types',
    () =>
      db
        .from('biomarker_types as bt')
        .where((builder) => {
          builder
            .whereNotExists((sub) => {
              sub.from('biomarker_type_clubs as scoped').whereRaw('scoped.biomarker_type_id = bt.id')
            })
            .orWhereExists((sub) => {
              sub
                .from('biomarker_type_clubs as scoped')
                .whereRaw('scoped.biomarker_type_id = bt.id')
                .andWhere('scoped.club_id', clubId)
            })
        })
        .distinct('bt.name')
        .orderBy('bt.name')
        .select('bt.name'),
    { clubId }
  )

const getClubValdTestTypeNames = (window: ClubLookbackWindow): Promise<string[]> =>
  loadDistinctNames(
    'club vald test types',
    () =>
      db
        .from('vald_tests as t')
        .join('days as d', 'd.id', 't.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .join('vald_trials as vt', 'vt.vald_test_id', 't.id')
        .where('a.club_id', window.clubId)
        .whereBetween('d.date_of_day', [window.startDate, window.endDate])
        .distinct('t.test_type')
        .orderBy('t.test_type')
        .select('t.test_type as name'),
    window
  )

export const getClubHealthMetricNames = (window: {
  clubId: string
  startDate: string
  endDate: string
}): Promise<string[]> =>
  loadDistinctNames(
    'club health metrics',
    () =>
      db
        .from('health_metrics as hm')
        .join('health_metric_values as hmv', 'hmv.metric_id', 'hm.id')
        .join('health_ratings as hr', 'hr.id', 'hmv.health_id')
        .join('days as d', 'd.id', 'hr.day_id')
        .join('athletes as a', 'a.id', 'd.athlete_id')
        .where('a.club_id', window.clubId)
        .whereBetween('d.date_of_day', [window.startDate, window.endDate])
        .distinct('hm.name')
        .orderBy('hm.name')
        .select('hm.name'),
    window
  )

export const clubCatalogueLookbackWindow = (
  clubId: string,
  opts?: { referenceDate?: string; lookbackDays?: number }
): ClubLookbackWindow | null => {
  const end = opts?.referenceDate ? DateTime.fromISO(opts.referenceDate) : DateTime.utc()
  if (!end.isValid) return null
  const lookbackDays = opts?.lookbackDays ?? CLUB_METRICS_LOOKBACK_DAYS
  const startDate = end.minus({ days: lookbackDays }).toISODate()
  const endDate = end.toISODate()
  if (!startDate || !endDate) return null
  return { clubId, startDate, endDate }
}

export const getClubPeriodMetricCatalogue = async (
  clubId: string,
  opts?: { referenceDate?: string; lookbackDays?: number }
): Promise<Array<{ name: string; unit: string | null }>> => {
  const window = clubCatalogueLookbackWindow(clubId, opts)
  if (!window) return []
  return periodMetrics.getClubMetricsWithUnits(window.clubId, window.startDate, window.endDate, {
    vendorWhitelist: false,
  })
}

export const getPeriodMetricAggregationMethods = async (
  names: readonly string[]
): Promise<Map<string, string>> => {
  if (names.length === 0) return new Map()
  const rows = await db
    .from('period_metrics')
    .whereIn('name', [...names])
    .select('name', 'aggregation_method')
  const out = new Map<string, string>()
  for (const row of rows) {
    const name = String(row.name ?? '').trim()
    if (!name) continue
    out.set(name, String(row.aggregation_method ?? '').trim())
  }
  return out
}

const resolveClubLookbackWindow = async (
  context?: AgentContext
): Promise<ClubLookbackWindow | null> => {
  if (!context?.referenceDate) return null

  let clubId: string | null
  if (context.mode === 'team') {
    clubId = context.clubId
  } else {
    const athlete = await Athlete.query().where('id', context.athleteId).select('clubId').first()
    clubId = athlete?.clubId ?? null
  }
  if (!clubId) return null

  return clubCatalogueLookbackWindow(clubId, { referenceDate: context.referenceDate })
}

const SUBJECTIVE_INTENT_RE =
  /\b(subjective|subjectif|subjectifs|subjective\s+data|donn[eé]es?\s+subjectives?|wellness|bien-?[eê]tre|ressentis?|self-?reported|rpe\s+body|sleep\s+quality|qualit[eé]\s+de\s+sommeil)\b/i

export const isSubjectiveDataQuestion = (question: string): boolean =>
  SUBJECTIVE_INTENT_RE.test(question)

export const getUnusedHealthMetricNames = async (
  context: AgentContext | undefined,
  sql: string
): Promise<string[]> => {
  if (/\bhealth_metric_values\b/i.test(sql)) return []
  if (!/\b(health_ratings|sleeps|sport_activities)\b/i.test(sql)) return []

  const window = await resolveClubLookbackWindow(context)
  if (!window) return []

  return getClubHealthMetricNames(window)
}
