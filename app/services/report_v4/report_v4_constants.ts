import {
  PREMIUM_CANVAS_ASK,
  PREMIUM_LINE_MAX_ATHLETES,
  type PremiumCanvasAskKind,
} from '#constants/premium_report.constants'
import { escapeHtml as escapeHtmlUtil, foldKey as foldKeyUtil } from '#utils/html_text'

export const REPORT_V4_LINKER_MAX_ITERATIONS = 14
export const REPORT_V4_LINKER_MIN_ITERATIONS = 3
export const REPORT_V4_LINKER_FORCE_ANSWER_AT = 12
export const REPORT_V4_LINKER_MAX_ITERATIONS_SHORT = 5
export const REPORT_V4_LINKER_MIN_ITERATIONS_SHORT = 2
export const REPORT_V4_LINKER_FORCE_ANSWER_AT_SHORT = 4
export const REPORT_V4_LINKER_MAX_TOKENS_SHORT = 8192

export const REPORT_V4_ANALYST_MAX_ITERATIONS = 22
export const REPORT_V4_ANALYST_MIN_ITERATIONS = 4
export const REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP = 5
export const REPORT_V4_ANALYST_FORCE_ANSWER_AT = 14

export const REPORT_V4_SHORT_WINDOW_DAYS = 7
export const REPORT_V4_MAX_FETCH_LOOKBACK_BEFORE_DISPLAY = 45
export const REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT = 12
export const REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT = 3
export const REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT = 10
export const REPORT_V4_ANALYST_RECOVERY_MAX_ITERATIONS = 8

export const REPORT_V4_DESIGNER_MAX_ITERATIONS = 14
export const REPORT_V4_DESIGNER_MIN_ITERATIONS = 2
export const REPORT_V4_DESIGNER_FORCE_ANSWER_AT = 12
export const REPORT_V4_DESIGNER_MAX_TOKENS = 28_672

export const REPORT_V4_MAX_END_TURN_NUDGES = 6
export const REPORT_V4_MAX_TOKENS = 28_672
export const REPORT_V4_TEMPERATURE = 0.3

export const REPORT_V4_MAX_CHARTS = 64
export const REPORT_V4_MAX_BLOCKS = 200
export const REPORT_V4_MIN_CHARTS = 2
export const REPORT_V4_MIN_TABLES = 1
export const REPORT_V4_MIN_CHARTS_SHORT = 1
export const REPORT_V4_MIN_TABLES_SHORT = 0

export const REPORT_V4_SOFT_LINKER_MAX_ITERATIONS = 5
export const REPORT_V4_SOFT_LINKER_MIN_ITERATIONS = 1
export const REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT = 5
export const REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS = 4
export const REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS = 1
export const REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT = 3
export const REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS = 6
export const REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT = 5

export const REPORT_V4_LINKER_CONTINUE =
  'HarvestPlan incomplete. Call the remaining domain macros (load→build_load_summary on Load lookback; scores→fetch_daily_scores; gps→fetch_gps_intensity_daily; match→fetch_match_stats_daily then fetch_match_stats; injury→fetch_injuries; wellness/sleep/biomarkers/vald/body as listed). Empty once = OK then move on. Do not invent ACWR on empty load. Then end_turn.'

export const REPORT_V4_ANALYST_CONTINUE =
  'Canvas still below the soft floor for THIS ask. Reuse datasetIds. Add only what the coach asked (comparators / cross-domain when relevant). Units on axes. commit_report_brief. Do not pad a staff monitoring pack.'

export const REPORT_V4_ANALYST_RECOVERY_CONTINUE =
  'RECOVERY: below soft floor. No free SQL. Macros + datasetIds. Reach ≥2 charts and ≥1 table that answer THIS coach ask — do not invent a full briefing. commit_report_brief. Then end_turn.'

export const softAnalystContinueForAsk = (opts?: {
  additive?: boolean
  restoreSheets?: boolean
  addSectionProse?: boolean
  layoutRepair?: boolean
  enrichExistingCharts?: boolean
}): string => {
  if (opts?.layoutRepair) {
    return [
      'Soft LAYOUT REPAIR (Virtual DOM): prior blocks are unlocked (reshape).',
      'Pair each athlete with THEIR charts: update_block titles with athlete name, remove_block orphan stacked headings, add_chart only if a sheet is missing a metric.',
      'Never leave a list of athlete headings above a single shared chart. Keep mutating until each athlete sheet is self-contained, then end_turn.',
    ].join(' ')
  }
  if (opts?.enrichExistingCharts) {
    return [
      'Soft ENRICH existing charts (Virtual DOM): prior blocks unlocked for reshape.',
      'update_block(id, datasetId, values) on existing individual/focus chart ids — do not spam add_chart duplicates.',
      'Fetch every asked domain first. Keep mutating until energy/soreness (or named metrics) appear on the target charts, then end_turn.',
    ].join(' ')
  }
  if (opts?.additive || opts?.restoreSheets || opts?.addSectionProse) {
    const goals: string[] = []
    if (opts.restoreSheets) {
      goals.push(
        'Restore individual athlete sheets: add_heading + add_chart/add_text per athlete (use live datasetIds; splitAthletes or athletes:[...] as needed)'
      )
    }
    if (opts.addSectionProse) {
      goals.push(
        'Add grounded add_text captions under each major chart/section the coach asked to annotate (not one global heading)'
      )
    }
    if (opts?.additive && goals.length === 0) {
      goals.push('Complete every additive part of the coach ask with add_*/update_block')
    }
    return [
      'Soft ADDITIVE edit (Virtual DOM): keep prior layout; mutate by exact block.id; add_* for new content.',
      goals.join('. ') + '.',
      'Do NOT end_turn after a single tool — keep mutating until the coach ask is covered, then end_turn. Never omit id.',
    ].join(' ')
  }
  return 'Soft edit (Virtual DOM): mutate by exact block.id from current only (update_block / remove_block / filter_block / charts_to_team with ids / add_*). After ONE successful mutation → end_turn. Never omit id.'
}

export const REPORT_V4_DESIGNER_CONTINUE =
  'Artifact HTML not set. get_design_context then set_report_html with every requiredChartIds host. Fix grounding cites and retry set_report_html if rejected — server auto-templates after two rejects.'

export const REPORT_V4_CHART_CHUNK = PREMIUM_LINE_MAX_ATHLETES
export const REPORT_V4_BAR_CHUNK_HORIZONTAL = 12
export const REPORT_V4_BAR_CHUNK_VERTICAL = 8
export const REPORT_V4_MAX_INLINE_PHOTOS = 8

export const REPORT_V4_LEAN_WINDOW_DAYS = 14
export const REPORT_V4_MS_PER_DAY = 86_400_000
export const REPORT_V4_COVERAGE_MIN_DAYS = 2
export const REPORT_V4_COVERAGE_MIN_ATHLETES = 2

export const REPORT_V4_DATA_PROFILE_ENABLED = true
export const REPORT_V4_DATA_PROFILE_DEFAULT_SHARE = 0.4
export const REPORT_V4_SQL_ROW_CAP_HINT = 10_000
export const REPORT_V4_DATA_PROFILE_APPEND_CANVAS = false

export const REPORT_V4_DATA_FACTS_ENABLED = true
export const REPORT_V4_DATA_FACTS_STRICT_HTML = true

export const REPORT_V4_GROUNDING_TOKENIZER_ENABLED = true
export const REPORT_V4_GROUNDING_YEAR_MIN = 1990
export const REPORT_V4_GROUNDING_YEAR_MAX = 2100

export const REPORT_V4_REPAIR_ENABLED = true
export const REPORT_V4_REPAIR_MAX_ROUNDS = 2
export const REPORT_V4_REPAIR_PROSE_DROP_RATIO = 0.3

export const REPORT_V4_GROUNDING_COUNT_NOUNS = [
  'injuries',
  'injury',
  'players',
  'player',
  'matches',
  'match',
  'doses',
  'dose',
  'days',
  'day',
  'sessions',
  'session',
  'athletes',
  'athlete',
]

export const REPORT_V4_PROMPT_MAX = 48_000
export const REPORT_V4_ISO_DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$'

export const REPORT_V4_MAX_HTML_BYTES = 2_500_000
export const ARTIFACT_MIN_HTML_BYTES = 400

export const REPORT_V4_PRESIGN_CONCURRENCY = 8

export const REPORT_V4_A4_VIEWPORT = { width: 794, height: 1123 }
export const REPORT_V4_PDF_TIMEOUT_MS = 15_000
export const REPORT_V4_CHARTS_READY_MS = 5_000
export const REPORT_V4_ALLOWED_FETCH_MS = 8_000
export const REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'amazonaws.com',
] as const

export const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js'

export const REPORT_DESIGN_PACK_IDS = ['mauna', 'clinical', 'editorial'] as const

export const REPORT_V4_FAKE_TILE_TITLE = /^(injury\s*risk|monitoring\s*comment)$/i
export const REPORT_V4_COUNT_SERIES_RE = /^n$|^count\b|sessions?\b|sample size/i
export const REPORT_V4_DISTANCE_TITLE_RE =
  /total\s*distance|high[-\s]*speed|\bhsr\b|\bhmld\b|sprint|metre|meter|\(m\)|\bkm\b/i
export const REPORT_V4_DISTANCE_SERIES_RE =
  /distance|hsr|hmld|sprint|high[-\s]*speed|total.*_m|\b_m\b|\(m\)/i
export const REPORT_V4_SCORE_RATING_SERIES_RE =
  /quality|rating|score|mood|soreness|wellness|performance|injury|risk/i
export const REPORT_V4_KPI_TILE_TEXT_RE =
  /\bmax\s*[·•]\s*avg\b|\bn\s*=\s*\d+\b|kpi\s*tile|monitoring\s*comment/i
export const REPORT_V4_MONITORING_COMMENT_RE = /^monitoring\s*comment/i

export const REPORT_V4_MICRO_EDIT_KINDS = new Set<PremiumCanvasAskKind>([
  PREMIUM_CANVAS_ASK.MICRO_EDIT,
  PREMIUM_CANVAS_ASK.RESHAPE,
  PREMIUM_CANVAS_ASK.REMOVE,
  PREMIUM_CANVAS_ASK.SPLIT,
  PREMIUM_CANVAS_ASK.DUPLICATE,
  PREMIUM_CANVAS_ASK.EXPLAIN,
  PREMIUM_CANVAS_ASK.NONE,
])

export const REPORT_V4_RANGE_SEP = String.raw`(?:to|->|→|⇒|–|-|—)`

export const windowDayCount = (from: string, to: string): number => {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return REPORT_V4_LEAN_WINDOW_DAYS
  return Math.round((b - a) / REPORT_V4_MS_PER_DAY) + 1
}

export const escapeHtml = escapeHtmlUtil
export const foldKey = foldKeyUtil
