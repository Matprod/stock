import {
  PREMIUM_CANVAS_ASK,
  PREMIUM_LINE_MAX_ATHLETES,
  type PremiumCanvasAskKind,
} from '#constants/premium_report.constants'

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

export const REPORT_V4_SOFT_LINKER_MAX_ITERATIONS = 5
export const REPORT_V4_SOFT_LINKER_MIN_ITERATIONS = 1
export const REPORT_V4_SOFT_LINKER_FORCE_ANSWER_AT = 5
export const REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS = 4
export const REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS = 1
export const REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT = 3
export const REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS = 6
export const REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT = 5

export const REPORT_V4_CHART_CHUNK = PREMIUM_LINE_MAX_ATHLETES
export const REPORT_V4_BAR_CHUNK_HORIZONTAL = 12
export const REPORT_V4_BAR_CHUNK_VERTICAL = 8

export const REPORT_V4_LEAN_WINDOW_DAYS = 14
export const REPORT_V4_MS_PER_DAY = 86_400_000

export const REPORT_V4_ISO_DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$'

export const REPORT_V4_DATA_PROFILE_DEFAULT_SHARE = 0.4

export const REPORT_V4_IMPUTED_DISPLAY = '—'

export const REPORT_V4_IMPUTED_SENTINELS: ReadonlyArray<{
  column: RegExp
  value: number
  reason: string
}> = [
  // Hamburg/Sunderland ML mid-scale when features are missing (Hard24 HTML ×13 at 50; fixture scores ~51)
  { column: /performance_score/i, value: 50, reason: 'sentinel:performance_score=50' },
  // Model/db injury-risk floor when no elevated signal (Hard24 HTML risk cells often 0)
  { column: /injury_risk_score/i, value: 0, reason: 'sentinel:injury_risk_score=0' },
]

export const ARTIFACT_MIN_HTML_BYTES = 400

export const REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES = ['amazonaws.com'] as const

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

export const windowDayCount = (from: string, to: string): number | null => {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / REPORT_V4_MS_PER_DAY) + 1
}
