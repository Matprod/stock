export const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0'
export const AGENT_TEMPERATURE = 0.5
export const MAX_ITERATIONS = 10
export const FORCE_ANSWER_AT = 9
export const SQL_PARTITION_TARGET_ROWS = 100
export const SQL_PARTITION_TARGET_CHARS = 15000
export const MAX_RESULT_ROWS = 500
export const MAX_RESULT_BYTES = 200_000
export const SQL_STATEMENT_TIMEOUT_MS = 15_000
export const SQL_RESULT_DECIMAL_PLACES = 3
export const SQL_PARTITION_AGGREGATED_MAX_ROWS = 250
export const SQL_PARTITION_AGGREGATED_MAX_CHARS = 80_000
export const CLUB_METRICS_LOOKBACK_DAYS = 30
export const CLUB_METRICS_CACHE_TTL_MS = 10 * 60 * 1000

export const FALLBACK_DOMAINS = [
  'Athlete Identity',
  'Daily Scores',
  'Health & Wellness',
  'Sport Activities & Training',
  'Sleep',
]

export const SERIES_SCHEMA_FALLBACK = `series: SELECT s.id,s.type,a.id AS athlete_id — never data_encoded.
Types: HEART_RATE|SPEED_METERS_PER_SECOND|TOTAL_DISTANCE_IN_METERS|ELEVATION_IN_METERS|POWER_IN_WATTS
JOIN: series→periods→sport_activities→days→athletes`

export const REFERENCE_TABLES = new Set([
  'sports',
  'activities',
  'player_positions',
  'injury_types',
  'injury_sections',
  'pain_discomfort_locations',
  'disease_types',
  'event_types',
  'day_metrics',
  'period_metrics',
  'period_metric_club_units',
  'sport_activity_metrics',
  'health_metrics',
  'sleep_metrics',
  'biomarker_types',
  'insights',
  'zones',
])

export const TOOL_STATUS_LABELS: Record<string, string> = {
  query_database: 'Analyzing data',
  suggest_chart: 'Creating visualization',
  decode_series: 'Preparing activity curves',
  get_response_structure: 'Structuring response',
}

export const INTENT_DESCRIPTIONS = `metric_deep_analysis: deep dive one metric. strategic_evaluation: trade-offs. conceptual_clarification: definitions. hypothesis_claim_checking: verify claims. direct_data_question: brief facts. global_analysis: holistic domains. contributing_variable_analysis: contributors + weekly trends. general: fallback.`

export const DB_TOOL_SERIES_DESCRIPTION_PREFIX = `Read-only SELECT for series charts. ONE call, ONE s.type. Never data_encoded / GPS.
Select s.id,s.type,a.id AS athlete_id, names, ad.date_of_day. TRIM+ILIKE names; team → a.club_id.
"N graphs" = N sessions of same type.

SCHEMA:
`

export const DB_TOOL_FULL_DESCRIPTION_PREFIX = `Execute a read-only SQL SELECT against mauna.
Use CLUB * METRICS / CLUB BIOMARKERS / CLUB HEALTH METRICS blocks for names; always SELECT unit with values.
RPE / perceived exertion: if CLUB HEALTH METRICS lists any *rpe* name, those are the ONLY session-RPE source — query health_metric_values. Do NOT query/mention sport_activities.rpe. Daily body wellness (body_soreness_rating) comes from club subjective scales, not sa.rpe.
USER-FACING: never expose table/column/SQL names. For subjective fields, use the exact label from the Club subjective scale configuration block (answers + chart titles). Do not hardcode "RPE Body" or any other club nickname unless that label appears in the club catalogue.
Pain intensity: health_pains.rating / sport_activity_pains.rating is ALWAYS present (1–5). Always SELECT it; never claim intensity was missing.
injury_risk_score is 0-100 (higher = more injury risk). "High injury risk" = this club's injury.high in CLUB SCORE THRESHOLDS — never use performance.high (often 70) for injury. Prefer days joins for health/sleep; biomarkers use athlete_id + measured_at (no day_id).

DATABASE SCHEMA:
`

export const DB_TOOL_TEAM_PARTITION_FORMAT = `

TEAM PARTITION: successful queries return { "rows": [...], "partition_meta": {...} }. Prefer disjoint dates.
On REDUCE_SCOPE/REDUCE_PAYLOAD: rows were not returned. Rewrite SQL with GROUP BY / COUNT / FILTER (smaller date range). Never invent names, dates, scores, or counts.`

export const SERIES_QUESTION_HINT =
  '[SERIES] ONE s.type (N graphs = N sessions). No GPS. SELECT s.id,s.type,names.'

export const SERIES_TO_PERIOD_METRICS_FALLBACK_HINT = `No GPS/time-series curves found in \`series\`. FALLBACK now enabled:
1. Query period_metric_values (JOIN period_metrics pm) for daily/session totals. pm.name comes from CLUB PERIOD METRICS only. Use the unit returned with the value. Do not convert it.
2. Then call suggest_chart with the aggregated rows.
3. Do NOT claim missing data until that period-metrics query returns empty.`

export const TOKEN_LIMIT_CONTINUE_HINT =
  'Draft answer hit the output token limit. Tools are still enabled — do not answer yet. Query missing dates or wait for the final-answer iteration.'

export const TOKEN_LIMIT_FINISH_JSON_HINT =
  'Your previous answer was truncated, invalid JSON, or missing follow-up questions. Output ONE complete JSON only (no markdown fences): {"response":"<concise meeting brief>","questions":[{"id":"q1","title":"Short label","question":"Full follow-up question?"},{"id":"q2","title":"Short label","question":"Full follow-up question?"}]}. Answer all asked points briefly. Include 2-3 questions. Close all braces.'

export const CLAIMS_JSON_HINT = `
FINAL ANSWER FORMAT — raw JSON only, NO markdown fences:
{"response":"<concise coach markdown>","questions":[{"id":"q1","title":"Short label","question":"Full follow-up question?"}]}
Rules:
- No \`\`\` fences. Keep response SHORT (meeting brief: names + key numbers, no waffle).
- questions: 2-3 follow-ups (max 5). Each item MUST be {"id":"qN","title":"<3-6 words>","question":"<full question>"}. Never return an empty questions array.
- Never invent names, counts, or scores not present in tool evidence.
- Prefer bullet points over long paragraphs so the JSON fits in one generation.`

export const AGENT_PROMPT_TITLES = {
  system: 'agent-system',
  athleteGuardrails: 'agent-athlete-guardrails',
  teamGuardrails: 'agent-team-guardrails',
  teamSqlPartition: 'agent-team-sql-partition',
  series: 'agent-series',
} as const

export const PLAYER_CHATBOT_PROMPT_TITLES = {
  titleGenerator: 'chatbot-title-generator',
  followupGenerator: 'chatbot-followup-generator',
} as const

export const VANNA_PROMPT_TITLES = {
  judge: 'vanna-judge',
} as const
