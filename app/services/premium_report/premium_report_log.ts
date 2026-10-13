import { inspect } from 'node:util'

export const elapsedSec = (t0: number): number => Number(((Date.now() - t0) / 1000).toFixed(3))

export type PremiumReportTokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

const USE_COLOR = Boolean(process.stdout.isTTY) && process.env.NO_COLOR == null

const wrap =
  (open: string, close = '\u001b[0m') =>
  (text: string): string =>
    USE_COLOR ? `${open}${text}${close}` : text

const c = {
  dim: wrap('\u001b[2m'),
  bold: wrap('\u001b[1m'),
  cyan: wrap('\u001b[36m'),
  green: wrap('\u001b[32m'),
  yellow: wrap('\u001b[33m'),
  red: wrap('\u001b[31m'),
  magenta: wrap('\u001b[35m'),
  blue: wrap('\u001b[34m'),
  gray: wrap('\u001b[90m'),
}

const PREFIX = c.magenta(c.bold('premium'))

const sep = (): string => c.dim('│')

const joinParts = (parts: Array<string | undefined>): string =>
  parts.filter(Boolean).join(`  ${sep()}  `)

const tag = (label: string, tone: (s: string) => string = c.cyan): string =>
  tone(label.padEnd(6))

const statusOk = (ok: boolean): string => (ok ? c.green('ok') : c.red('ERR'))

export const premiumLog = (line: string): void => {
  process.stdout.write(`${PREFIX}  ${line}\n`)
}

const formatTokens = (usage: {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}): string => {
  const parts = [
    `in=${fmtCount(usage.inputTokens)}`,
    `out=${fmtCount(usage.outputTokens)}`,
  ]
  if (usage.cacheReadInputTokens) parts.push(`cacheR=${fmtCount(usage.cacheReadInputTokens)}`)
  if (usage.cacheCreationInputTokens) {
    parts.push(`cacheW=${fmtCount(usage.cacheCreationInputTokens)}`)
  }
  return c.gray(parts.join(' '))
}

const formatUsd = (usd: number): string =>
  c.yellow(`$${usd.toFixed(usd < 0.01 ? 4 : 3)}`)

export const logPremiumStart = (args: {
  clubId: string
  domains: string[]
  athleteCount: number
  toolCount: number
  promptPreview: string
}): void => {
  premiumLog(
    joinParts([
      tag('START', c.bold),
      c.cyan(`club=${args.clubId}`),
      `domains=${c.blue(args.domains.join(',') || '—')}`,
      `athletes=${args.athleteCount}`,
      `tools=${args.toolCount}`,
    ])
  )
  premiumLog(
    joinParts([
      tag('prompt', c.dim),
      c.dim(args.promptPreview.replace(/\s+/g, ' ').trim()),
    ])
  )
}

export const logPremiumSparse = (args: {
  daysWithData: number
  athletesWithData: number
  minDays: number
  minAthletes: number
  dateRange: { from: string; to: string }
}): void => {
  premiumLog(
    joinParts([
      tag('SPARSE', c.yellow),
      `${args.dateRange.from}→${args.dateRange.to}`,
      `days=${args.daysWithData}/${args.minDays}`,
      `athletesWithData=${args.athletesWithData}/${args.minAthletes}`,
    ])
  )
}

export const logPremiumIteration = (args: {
  iteration: number
  stopReason: string
  durationSec: number
  toolCount: number
  usage: PremiumReportTokenUsage
  cumulative: PremiumReportTokenUsage
}): void => {
  let reasonTone = c.yellow
  if (args.stopReason === 'tool_use') reasonTone = c.cyan
  else if (args.stopReason === 'end_turn') reasonTone = c.green
  premiumLog(
    joinParts([
      tag(`iter ${String(args.iteration).padStart(2, '0')}`, c.bold),
      reasonTone(args.stopReason),
      c.dim(`${args.durationSec}s`),
      args.toolCount > 0 ? `${args.toolCount} tool(s)` : undefined,
      formatTokens(args.usage),
      formatUsd(args.usage.estimatedCostUsd),
      `cum ${formatUsd(args.cumulative.estimatedCostUsd)}`,
    ])
  )
}

export const logPremiumJev = (args: {
  kind: 'intent' | 'chart_type' | 'chart_rules' | 'table_heat' | 'text_caption' | 'canvas_ask' | 'route' | 'team_chart'
  durationSec: number
  ok: boolean
  decision: string
  score?: number
  provider?: 'jev' | 'heuristic' | 'fallback' | 'skip'
  detail?: string
}): void => {
  premiumLog(
    joinParts([
      tag('jev', c.magenta),
      c.cyan(args.kind.padEnd(12)),
      args.ok ? c.green('ok') : c.red('BLOCK'),
      c.dim(`${args.durationSec}s`),
      args.provider ? c.gray(`via=${args.provider}`) : undefined,
      args.score != null ? c.gray(`score=${args.score.toFixed(2)}`) : undefined,
      `${c.dim('→')} ${c.bold(args.decision)}`,
      args.detail ? c.dim(args.detail) : undefined,
    ])
  )
}

export const logPremiumSql = (args: {
  durationSec: number
  rowCount: number
  error?: string
  sql: string
  templateId?: string
}): void => {
  const scope = args.templateId ? `template=${args.templateId}` : 'query_database'
  if (args.error) {
    premiumLog(
      joinParts([
        tag('sql', c.red),
        statusOk(false),
        c.dim(`${args.durationSec}s`),
        scope,
        `rows=${args.rowCount}`,
      ])
    )
    premiumLog(joinParts([tag('sql', c.red), c.red(args.error)]))
    logSqlBody(args.sql)
    return
  }
  premiumLog(
    joinParts([
      tag('sql', c.blue),
      statusOk(true),
      c.dim(`${args.durationSec}s`),
      c.cyan(scope),
      `rows=${args.rowCount}`,
    ])
  )
}

export const logPremiumTool = (args: {
  tool: string
  ok: boolean
  durationSec: number
  detail?: string
}): void => {
  premiumLog(
    joinParts([
      tag('tool', args.ok ? c.green : c.red),
      statusOk(args.ok),
      c.dim(`${args.durationSec}s`),
      c.bold(args.tool),
      args.detail ? c.dim(args.detail) : undefined,
    ])
  )
}

export const logPremiumDone = (args: {
  iterations: number
  durationSec: number
  usage: PremiumReportTokenUsage
  blockCount?: number
  chartCount?: number
  datasetCount?: number
  blockSql?: boolean
  maxIterations?: boolean
  sqlErrors?: number
  jevValidations?: number
  jevBlocked?: number
  chartsBackfilled?: number
}): void => {
  const label = args.maxIterations ? 'MAX' : 'DONE'
  premiumLog(
    joinParts([
      tag(label, args.maxIterations ? c.yellow : c.green),
      `${args.iterations} iters`,
      c.dim(`${args.durationSec}s`),
      c.gray(`tok=${fmtCount(args.usage.totalTokens)} (${formatTokens(args.usage)})`),
      formatUsd(args.usage.estimatedCostUsd),
      args.blockCount != null ? `blocks=${args.blockCount}` : undefined,
      args.chartCount != null ? `charts=${args.chartCount}` : undefined,
      args.chartsBackfilled != null ? `charts+=${args.chartsBackfilled}` : undefined,
      args.datasetCount != null ? `datasets=${args.datasetCount}` : undefined,
      args.blockSql ? c.yellow('sql=blocked') : undefined,
      args.sqlErrors != null && args.sqlErrors > 0
        ? c.red(`sql_errors=${args.sqlErrors}`)
        : undefined,
      args.jevValidations != null && args.jevValidations > 0
        ? `jev=${args.jevValidations}/${args.jevBlocked || 0}`
        : undefined,
    ])
  )
}

/** Pretty-print a structured object on one or more indented lines (debug). */
export const logPremiumPretty = (label: string, value: unknown): void => {
  const body = inspect(value, {
    colors: USE_COLOR,
    depth: 4,
    compact: false,
    breakLength: 100,
  })
  premiumLog(joinParts([tag('dump', c.cyan), c.bold(label)]))
  for (const line of body.split('\n')) {
    premiumLog(c.dim(`       ${line}`))
  }
}

const SQL_LOG_MAX = 2_000

const logSqlBody = (sql: string): void => {
  const normalized = sql.replace(/\r\n/g, '\n').trim()
  if (!normalized) return
  const clipped =
    normalized.length > SQL_LOG_MAX
      ? `${normalized.slice(0, SQL_LOG_MAX)}\n… (${normalized.length - SQL_LOG_MAX} more chars)`
      : normalized
  for (const line of clipped.split('\n')) {
    premiumLog(c.dim(`sql    │ ${line}`))
  }
}

const fmtCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}
