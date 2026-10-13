import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'

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
  white: wrap('\u001b[37m'),
}

const PREFIX = c.blue(c.bold('report-v4'))
const sep = c.dim('│')

const line = (parts: Array<string | undefined>): void => {
  process.stdout.write(`${PREFIX}  ${parts.filter(Boolean).join(`  ${sep}  `)}\n`)
}

const usd = (value: number): string =>
  c.yellow(`$${value.toFixed(value < 0.01 ? 4 : 3)}`)

const sec = (value: number): string => c.cyan(`${value.toFixed(3)}s`)

const fmtTok = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n)

export type ReportV4IterationLog = {
  iteration: number
  stopReason: string
  durationSec: number
  usage: PremiumReportTokenUsage
  cumulative: PremiumReportTokenUsage
  tools: Array<{ name: string; ok: boolean; detail?: string; durationSec?: number }>
  textPreview?: string
}

export const logReportV4Banner = (args: {
  clubName: string
  promptPreview: string
  displayRange: { from: string; to: string }
  domains: string[]
}): void => {
  process.stdout.write(`\n${c.blue('════════════════════════════════════════════════════════════')}\n`)
  line([c.bold('START'), c.white(args.clubName), `${args.displayRange.from} → ${args.displayRange.to}`])
  line([c.dim('domains'), c.cyan(args.domains.join(', ') || '—')])
  line([c.dim('prompt'), c.dim(args.promptPreview.replace(/\s+/g, ' ').trim().slice(0, 180))])
  process.stdout.write(`${c.blue('────────────────────────────────────────────────────────────')}\n`)
}

export const logReportV4Iteration = (args: ReportV4IterationLog): void => {
  const reasonTone =
    args.stopReason === 'tool_use'
      ? c.cyan
      : args.stopReason === 'end_turn'
        ? c.green
        : c.yellow

  const action =
    args.tools.length > 0
      ? `tools: ${args.tools.map((t) => t.name).join(', ')}`
      : args.stopReason === 'end_turn'
        ? 'final answer'
        : args.textPreview
          ? `text: ${args.textPreview}`
          : 'model turn'

  line([
    c.bold(`iter ${String(args.iteration).padStart(2, '0')}`),
    reasonTone(args.stopReason),
    sec(args.durationSec),
    usd(args.usage.estimatedCostUsd),
    c.gray(
      `tok in=${fmtTok(args.usage.inputTokens)} out=${fmtTok(args.usage.outputTokens)}` +
        (args.usage.cacheReadInputTokens
          ? ` cacheR=${fmtTok(args.usage.cacheReadInputTokens)}`
          : '')
    ),
    c.dim(`cum ${usd(args.cumulative.estimatedCostUsd)}`),
  ])
  line([c.dim('action'), c.white(action)])

  for (const tool of args.tools) {
    line([
      c.dim('  └ tool'),
      tool.ok ? c.green('ok') : c.red('ERR'),
      c.bold(tool.name),
      tool.durationSec != null ? sec(tool.durationSec) : undefined,
      tool.detail ? c.dim(tool.detail) : undefined,
    ])
  }

  line([
    c.dim('  └ cost'),
    `this prompt ${usd(args.usage.estimatedCostUsd)}`,
    `total so far ${usd(args.cumulative.estimatedCostUsd)}`,
    `iter time ${sec(args.durationSec)}`,
  ])
}

export const logReportV4Pdf = (args: {
  durationSec: number
  filename: string
  bytes: number
}): void => {
  line([
    c.magenta('pdf'),
    sec(args.durationSec),
    c.white(args.filename),
    c.gray(`${Math.round(args.bytes / 1024)} KB`),
  ])
}

export const logReportV4AgentTotal = (args: {
  agent: 'linker' | 'analyst' | 'designer' | string
  iterations: number
  durationSec: number
  usage: PremiumReportTokenUsage
  detail?: string
}): void => {
  process.stdout.write(`${c.blue('┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄')}\n`)
  line([
    c.green(c.bold('TOTAL')),
    c.white(args.agent),
    `${args.iterations} iteration(s)`,
    sec(args.durationSec),
    usd(args.usage.estimatedCostUsd),
  ])
  line([
    c.dim('tokens'),
    `in=${fmtTok(args.usage.inputTokens)}`,
    `out=${fmtTok(args.usage.outputTokens)}`,
    `cacheR=${fmtTok(args.usage.cacheReadInputTokens)}`,
    `cacheW=${fmtTok(args.usage.cacheCreationInputTokens)}`,
    `all=${fmtTok(args.usage.totalTokens)}`,
  ])
  if (args.detail) {
    line([c.dim('detail'), c.dim(args.detail)])
  }
}

export const logReportV4Done = (args: {
  iterations: number
  durationSec: number
  usage: PremiumReportTokenUsage
  iterationSecs: number[]
  iterationCosts: number[]
  blockCount: number
  chartCount: number
  filename?: string
}): void => {
  process.stdout.write(`${c.blue('────────────────────────────────────────────────────────────')}\n`)
  line([
    c.green(c.bold('TOTAL')),
    `${args.iterations} iteration(s)`,
    sec(args.durationSec),
    usd(args.usage.estimatedCostUsd),
  ])
  line([
    c.dim('tokens'),
    `in=${fmtTok(args.usage.inputTokens)}`,
    `out=${fmtTok(args.usage.outputTokens)}`,
    `cacheR=${fmtTok(args.usage.cacheReadInputTokens)}`,
    `cacheW=${fmtTok(args.usage.cacheCreationInputTokens)}`,
    `all=${fmtTok(args.usage.totalTokens)}`,
  ])
  if (args.iterationSecs.length) {
    line([
      c.dim('per-iter time'),
      ...args.iterationSecs.map((s, i) => c.cyan(`#${i + 1}=${s.toFixed(2)}s`)),
    ])
  }
  if (args.iterationCosts.length) {
    line([
      c.dim('per-iter $'),
      ...args.iterationCosts.map((cost, i) => c.yellow(`#${i + 1}=$${cost.toFixed(cost < 0.01 ? 4 : 3)}`)),
    ])
  }
  line([
    c.dim('canvas'),
    `blocks=${args.blockCount}`,
    `charts=${args.chartCount}`,
    args.filename ? c.white(args.filename) : undefined,
  ])
  process.stdout.write(`${c.blue('════════════════════════════════════════════════════════════')}\n`)
  // HMR / ace serve boot noise scrolls the terminal — pad so reload wipes dashes, not TOTAL.
  const hmrPad = c.dim('-'.repeat(60))
  for (let i = 0; i < 48; i++) {
    process.stdout.write(`${hmrPad}\n`)
  }
  process.stdout.write(`\n`)
}
