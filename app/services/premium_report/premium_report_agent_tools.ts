import {
  PREMIUM_TOOL_HISTORY_CAP,
  PREMIUM_TOOL_HISTORY_TRIM,
} from '#constants/premium_report.constants'
import type { Message } from '#utils/agent/agent_logger'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log'
import { detectToolLoop } from '#services/premium_report/premium_report_query_validator'
import type { PremiumAgentIterationEvent } from '#services/premium_report/premium_report_agent_types'
import { recordHarvestTried } from '#services/report_v4/harvest_plan'

const ERROR_KEY_RE = /"error"\s*:/

export const summarizeToolDetail = (
  name: string,
  input: Record<string, unknown>,
  result?: string
): string | undefined => {
  if (name === 'query_database') return undefined
  if (name === 'build_load_summary' || name.startsWith('fetch_')) {
    let resolved = ''
    if (result) {
      try {
        const parsed = JSON.parse(result) as {
          dateRange?: { from?: string; to?: string }
        }
        if (parsed.dateRange?.from && parsed.dateRange?.to) {
          resolved = `${parsed.dateRange.from}→${parsed.dateRange.to}`
        }
      } catch {}
    }
    const asked = `${input.from ?? '?'} → ${input.to ?? '?'}`
    if (resolved && resolved !== `${input.from}→${input.to}`) {
      return `${asked} (sql ${resolved})`
    }
    return asked
  }
  if (name === 'apply_formula') return String(input.id ?? '')
  if (name === 'transform_columns') return String(input.recipe ?? input.op ?? '')
  if (name === 'correlate') return String(input.mode ?? 'matrix')
  if ((name === 'add_chart' || name === 'add_table') && typeof input.datasetId === 'string') {
    return input.datasetId
  }
  if (name === 'charts_to_team') {
    const id = typeof input.id === 'string' ? input.id : undefined
    const op = typeof input.op === 'string' ? input.op : 'mean'
    return id ? `${op} ${id}` : op
  }
  return undefined
}

export const summarizeToolError = (
  name: string,
  input: Record<string, unknown>,
  result: string
): string => {
  const base = summarizeToolDetail(name, input, result)
  let err = 'error'
  try {
    const parsed = JSON.parse(result) as {
      error?: unknown
      dateRange?: { from?: string; to?: string }
    }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      err = parsed.error.replace(/\s+/g, ' ').trim().slice(0, 200)
    }
    if (
      !base?.includes('sql ') &&
      parsed.dateRange?.from &&
      parsed.dateRange?.to &&
      (parsed.dateRange.from !== input.from || parsed.dateRange.to !== input.to)
    ) {
      return `${input.from ?? '?'} → ${input.to ?? '?'} (sql ${parsed.dateRange.from}→${parsed.dateRange.to})  ${err}`
    }
  } catch {
    err = result.replace(/\s+/g, ' ').trim().slice(0, 200) || err
  }
  return base ? `${base}  ${err}` : err
}

export const toolPriority = (name: string): number => {
  if (name === 'build_load_summary') return 10
  if (name.startsWith('fetch_')) return 20
  if (name === 'query_database') return 30
  if (name === 'fill_daily_zeros') return 40
  if (name === 'transform_columns' || name === 'apply_formula') return 50
  if (name === 'correlate') return 60
  if (['take_latest', 'filter_dataset', 'drop_empty_columns', 'join_datasets'].includes(name)) {
    return 70
  }
  if (name === 'charts_to_team' || name === 'aggregate_dataset') return 80
  return 100
}

export const executePremiumToolUses = async (args: {
  uses: Array<{ id?: unknown; name?: unknown; input?: unknown }>
  toolMap: Map<string, PremiumTool>
  state: PremiumReportState
  truncated: boolean
  signal?: AbortSignal
}): Promise<{
  toolResults: Array<Record<string, unknown>>
  toolEvents: PremiumAgentIterationEvent['tools']
}> => {
  const loop = detectToolLoop({ toolHistory: args.state.toolHistory })
  const toolResults: Array<Record<string, unknown>> = []
  const toolEvents: PremiumAgentIterationEvent['tools'] = []
  const ordered = [...args.uses].sort(
    (a, b) => toolPriority(String(a.name ?? '')) - toolPriority(String(b.name ?? ''))
  )
  for (const block of ordered) {
    const name = String(block.name ?? '')
    const tool = args.toolMap.get(name)
    const input =
      block.input && typeof block.input === 'object' && !Array.isArray(block.input)
        ? (block.input as Record<string, unknown>)
        : {}
    const htmlPayload = typeof input.html === 'string' ? input.html : ''
    const inputLooksTruncated = (() => {
      if (!args.truncated) return false
      if (Object.keys(input).length === 0) return true
      if (!htmlPayload) return true
      if (name === 'set_report_pages') {
        const trimmed = htmlPayload.trim()
        if (trimmed.length < 80) return true
        if (!/\bclass=["'][^"']*\bpage\b/i.test(trimmed)) return true
        if (/<(div|section|article|table|svg|p|span|h[1-6])\b[^>]*$/i.test(trimmed)) return true
        return false
      }
      return !htmlPayload.toLowerCase().includes('</html>')
    })()

    args.state.toolHistory.push({ name, input, timestamp: Date.now() })
    recordHarvestTried(args.state, name, input)
    if (args.state.toolHistory.length > PREMIUM_TOOL_HISTORY_CAP) {
      args.state.toolHistory = args.state.toolHistory.slice(-PREMIUM_TOOL_HISTORY_TRIM)
    }

    if (args.signal?.aborted) {
      const err = new Error('Report generation cancelled')
      err.name = 'AbortError'
      throw err
    }
    const toolStarted = Date.now()
    let result: string
    if (loop.isStuck) {
      result = JSON.stringify({ error: 'loop' })
    } else if (inputLooksTruncated) {
      let truncHint = 'Tool input was cut by max_tokens. Retry with a smaller payload.'
      if (name === 'set_report_html') {
        truncHint =
          'HTML was cut by max_tokens. Retry set_report_html with a shorter document (server auto-templates after two rejects).'
      } else if (name === 'set_report_pages') {
        truncHint =
          'set_report_pages was cut by max_tokens. Resend only 1–3 div.page bodies. Use mode=replace for the first batch, mode=append for the rest, done=true on the last batch.'
      }
      result = JSON.stringify({
        error: 'tool_input_truncated',
        hint: truncHint,
      })
    } else {
      result = tool ? await tool.execute(input) : JSON.stringify({ error: `Unknown tool: ${name}` })
    }
    const durationSec = elapsedSec(toolStarted)
    const ok = !ERROR_KEY_RE.test(result.slice(0, 200))
    const detail = loop.isStuck
      ? 'LOOP_DETECTED'
      : inputLooksTruncated
        ? 'TRUNCATED'
        : ok
          ? summarizeToolDetail(name, input, result)
          : summarizeToolError(name, input, result)
    logPremiumTool({
      tool: name,
      ok: loop.isStuck || inputLooksTruncated ? false : ok,
      durationSec,
      detail,
    })
    toolEvents.push({
      name,
      ok: loop.isStuck || inputLooksTruncated ? false : ok,
      durationSec,
      ...(detail ? { detail } : {}),
    })
    toolResults.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: result,
    })
  }
  return { toolResults, toolEvents }
}

export const appendToolResultsMessage = (
  messages: Message[],
  toolResults: Array<Record<string, unknown>>,
  truncated: boolean
): void => {
  const truncatedNudge =
    'Previous tool call hit max_tokens. For set_report_pages: send only 1–3 div.page bodies (mode=replace then mode=append). For set_report_html: send a shorter document.'
  messages.push({
    role: 'user',
    content: truncated
      ? [
          ...toolResults,
          {
            type: 'text',
            text: truncatedNudge,
          },
        ]
      : toolResults,
  })
}
