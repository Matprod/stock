import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import env from '#start/env'
import {
  PREMIUM_REPORT_ANTHROPIC_VERSION,
  PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK,
  PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK,
  PREMIUM_REPORT_FORCE_ANSWER_AT,
  PREMIUM_REPORT_INPUT_USD_PER_MTOK,
  PREMIUM_REPORT_MAX_ITERATIONS,
  PREMIUM_REPORT_MAX_TOKENS,
  PREMIUM_REPORT_MODEL_ID,
  PREMIUM_REPORT_OUTPUT_USD_PER_MTOK,
  PREMIUM_REPORT_TEMPERATURE,
  PREMIUM_TOOL_HISTORY_CAP,
  PREMIUM_TOOL_HISTORY_TRIM,
} from '#constants/premium_report.constants'
import type { Message } from '#utils/agent/agent_logger'
import { consumeBedrockStream } from '#utils/agent/agent_bedrock_stream'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import {
  elapsedSec,
  logPremiumIteration,
  logPremiumTool,
  type PremiumReportTokenUsage,
} from '#services/premium_report/premium_report_log'
import { detectToolLoop } from '#services/premium_report/premium_report_query_validator'

export type { PremiumReportTokenUsage }

export type PremiumAgentResult = {
  message: string
  iterations: number
  usage: PremiumReportTokenUsage
}

let bedrockClient: BedrockRuntimeClient | undefined

const getClient = (): BedrockRuntimeClient => {
  bedrockClient ??= new BedrockRuntimeClient({
    region: env.get('AWS_REGION'),
    credentials: {
      accessKeyId: env.get('AWS_ACCESS_KEY'),
      secretAccessKey: env.get('AWS_SECRET_KEY'),
    },
  })
  return bedrockClient
}

const SQL_TOOL_NAMES = new Set(['query_database'])
const ERROR_KEY_RE = /"error"\s*:/
const CACHE_EPHEMERAL = { type: 'ephemeral' as const }
const PREMIUM_AGENT_KEEP_TOOL_TURNS = 5
const TOOL_RESULT_SUMMARY_KEYS = [
  'datasetId',
  'rowCount',
  'blockId',
  'id',
  'ids',
  'chartId',
  'athleteCount',
  'columns',
] as const

const simpleError = (state: PremiumReportState): string =>
  state.language === 'fr' ? 'Une erreur est survenue.' : 'Something went wrong.'

const toolsWithCache = (
  schemas: Array<PremiumTool['schema']>
): Array<PremiumTool['schema'] & { cache_control?: { type: 'ephemeral' } }> => {
  if (schemas.length === 0) return schemas
  return schemas.map((schema, index) =>
    index === schemas.length - 1 ? { ...schema, cache_control: CACHE_EPHEMERAL } : schema
  )
}

export type PremiumAgentIterationEvent = {
  iteration: number
  stopReason: string
  durationSec: number
  usage: PremiumReportTokenUsage
  cumulative: PremiumReportTokenUsage
  tools: Array<{ name: string; ok: boolean; detail?: string; durationSec?: number }>
  textPreview?: string
}

export const runPremiumReportAgent = async (args: {
  systemPrompt: string
  userPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: PremiumTool[]
  state: PremiumReportState
  onIteration?: (event: PremiumAgentIterationEvent) => void
  maxIterations?: number
  forceAnswerAt?: number
  maxTokens?: number
  temperature?: number
  /** Soft floor: nudge past early end_turn until this many iterations. */
  minIterations?: number
  maxEndTurnNudges?: number
  continuePrompt?: string
  /** Return a nudge message to reject end_turn (e.g. empty canvas); null accepts. */
  acceptEndTurn?: (state: PremiumReportState) => string | null
  signal?: AbortSignal
}): Promise<PremiumAgentResult> => {
  const client = getClient()
  const maxIterations = args.maxIterations ?? PREMIUM_REPORT_MAX_ITERATIONS
  const forceAnswerAt = args.forceAnswerAt ?? PREMIUM_REPORT_FORCE_ANSWER_AT
  const maxTokens = args.maxTokens ?? PREMIUM_REPORT_MAX_TOKENS
  const temperature = args.temperature ?? PREMIUM_REPORT_TEMPERATURE
  const minIterations = Math.min(args.minIterations ?? 1, maxIterations)
  const maxEndTurnNudges = args.maxEndTurnNudges ?? 0
  const continuePrompt =
    args.continuePrompt?.trim() ||
    'Continue building the report. Do not finish yet — add missing charts/tables and polish.'
  const messages: Message[] = [
    ...normalizeHistory(args.history),
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: args.userPrompt,
          cache_control: CACHE_EPHEMERAL,
        },
      ],
    },
  ]
  let idleRetried = false
  let unchangedRetried = false
  let endTurnNudges = 0
  const startBlocksSnap = JSON.stringify(args.state.document.blocks)
  const startDatasetCount = args.state.datasets.size
  const totals = emptyUsage()

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (args.signal?.aborted) {
      const err = new Error('Report generation cancelled')
      err.name = 'AbortError'
      throw err
    }
    const toolsEnabled = iteration < forceAnswerAt
    const activeTools = toolsEnabled
      ? args.state.blockSql
        ? args.tools.filter((tool) => !SQL_TOOL_NAMES.has(tool.schema.name))
        : args.tools
      : []
    const toolMap = new Map(activeTools.map((tool) => [tool.schema.name, tool]))
    const toolSchemas = toolsWithCache(activeTools.map((tool) => tool.schema))
    const forceToolUse =
      toolsEnabled &&
      args.state.mustUseTools &&
      args.state.toolHistory.length === 0 &&
      toolSchemas.length > 0

    const iterationStarted = Date.now()
    const raw = await client.send(
      new InvokeModelWithResponseStreamCommand({
        modelId: PREMIUM_REPORT_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: PREMIUM_REPORT_ANTHROPIC_VERSION,
          max_tokens: maxTokens,
          temperature,
          system: [
            {
              type: 'text',
              text: args.systemPrompt,
              cache_control: CACHE_EPHEMERAL,
            },
          ],
          tools: toolSchemas,
          ...(forceToolUse ? { tool_choice: { type: 'any' } } : {}),
          messages,
        }),
      }),
      args.signal ? { abortSignal: args.signal } : undefined
    )

    const turn = await consumeBedrockStream({
      body: raw.body!,
      shouldStreamToClient: false,
      filterJsonResponse: false,
      signal: args.signal,
    })
    addUsage(totals, turn.usage)
    const uses = turn.content.filter((block) => block.type === 'tool_use')
    const turnUsage: PremiumReportTokenUsage = {
      ...turn.usage,
      totalTokens: turn.usage.inputTokens + turn.usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(turn.usage),
    }
    logPremiumIteration({
      iteration,
      stopReason: turn.stopReason,
      durationSec: elapsedSec(iterationStarted),
      toolCount: uses.length,
      usage: turnUsage,
      cumulative: totals,
    })

    const hasToolUses = uses.length > 0
    if (hasToolUses) {
      messages.push({ role: 'assistant', content: turn.content })
      const loop = detectToolLoop({ toolHistory: args.state.toolHistory })
      const truncated = turn.stopReason === 'max_tokens'

      const toolResults: Array<Record<string, unknown>> = []
      const toolEvents: PremiumAgentIterationEvent['tools'] = []
      const ordered = uses.sort(
        (a, b) => toolPriority(String(a.name ?? '')) - toolPriority(String(b.name ?? ''))
      )
      for (const block of ordered) {
        const name = String(block.name ?? '')
        const tool = toolMap.get(name)
        const input =
          block.input && typeof block.input === 'object' && !Array.isArray(block.input)
            ? (block.input as Record<string, unknown>)
            : {}
        const htmlPayload = typeof input.html === 'string' ? input.html : ''
        const inputLooksTruncated =
          truncated &&
          (Object.keys(input).length === 0 ||
            (htmlPayload.length > 0 && !htmlPayload.toLowerCase().includes('</html>')))

        args.state.toolHistory.push({ name, input, timestamp: Date.now() })
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
          }
          result = JSON.stringify({
            error: 'tool_input_truncated',
            hint: truncHint,
          })
        } else {
          result = tool
            ? await tool.execute(input)
            : JSON.stringify({ error: `Unknown tool: ${name}` })
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
      args.onIteration?.({
        iteration,
        stopReason: turn.stopReason,
        durationSec: elapsedSec(iterationStarted),
        usage: turnUsage,
        cumulative: { ...totals },
        tools: toolEvents,
        textPreview: turn.iterationText.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
      })
      const truncatedNudge =
        'Previous tool call hit max_tokens. Finish with a smaller tool payload (shorter set_report_html if needed).'
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
      compactPremiumAgentMessages(messages)
      continue
    }

    if (turn.stopReason === 'end_turn' || turn.stopReason === 'max_tokens') {
      const canvasUnchanged =
        JSON.stringify(args.state.document.blocks) === startBlocksSnap &&
        args.state.datasets.size === startDatasetCount
      const noToolsYet = args.state.toolHistory.length === 0
      args.onIteration?.({
        iteration,
        stopReason: turn.stopReason,
        durationSec: elapsedSec(iterationStarted),
        usage: turnUsage,
        cumulative: { ...totals },
        tools: [],
        textPreview: turn.iterationText.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
      })
      if (toolsEnabled && args.state.mustUseTools && noToolsYet && !idleRetried) {
        idleRetried = true
        messages.push({ role: 'assistant', content: turn.content })
        messages.push({ role: 'user', content: 'Continue.' })
        continue
      }
      if (toolsEnabled && args.state.mustUseTools && canvasUnchanged && !unchangedRetried) {
        unchangedRetried = true
        messages.push({ role: 'assistant', content: turn.content })
        messages.push({ role: 'user', content: 'Continue.' })
        continue
      }
      const rejectMsg = toolsEnabled ? (args.acceptEndTurn?.(args.state) ?? null) : null
      if (rejectMsg) {
        const briefGate = /commit_report_brief|report\s*brief|hasBrief/i.test(rejectMsg)
        if (!briefGate && endTurnNudges >= maxEndTurnNudges) {
          return {
            message: turn.iterationText.trim() || simpleError(args.state),
            iterations: iteration,
            usage: { ...totals },
          }
        }
        endTurnNudges += 1
        messages.push({ role: 'assistant', content: turn.content })
        messages.push({ role: 'user', content: rejectMsg })
        continue
      }
      if (
        toolsEnabled &&
        !args.acceptEndTurn &&
        iteration < minIterations &&
        endTurnNudges < maxEndTurnNudges
      ) {
        endTurnNudges += 1
        messages.push({ role: 'assistant', content: turn.content })
        messages.push({
          role: 'user',
          content: `${continuePrompt} (${iteration}/${minIterations} min turns)`,
        })
        continue
      }
      return {
        message: turn.iterationText.trim() || simpleError(args.state),
        iterations: iteration,
        usage: { ...totals },
      }
    }
  }

  return {
    message: simpleError(args.state),
    iterations: maxIterations,
    usage: { ...totals },
  }
}

export const emptyUsage = (): PremiumReportTokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
})

const addUsage = (
  totals: PremiumReportTokenUsage,
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
  }
): void => {
  totals.inputTokens += usage.inputTokens
  totals.outputTokens += usage.outputTokens
  totals.cacheReadInputTokens += usage.cacheReadInputTokens
  totals.cacheCreationInputTokens += usage.cacheCreationInputTokens
  totals.totalTokens = totals.inputTokens + totals.outputTokens
  totals.estimatedCostUsd = estimateCostUsd(totals)
}

export const estimateCostUsd = (usage: {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}): number => {
  const usd =
    (usage.inputTokens / 1_000_000) * PREMIUM_REPORT_INPUT_USD_PER_MTOK +
    (usage.outputTokens / 1_000_000) * PREMIUM_REPORT_OUTPUT_USD_PER_MTOK +
    (usage.cacheReadInputTokens / 1_000_000) * PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK +
    (usage.cacheCreationInputTokens / 1_000_000) * PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK
  return Number(usd.toFixed(6))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasToolResultBlocks = (message: Message): boolean => {
  if (typeof message.content === 'string') return false
  return message.content.some((block) => block.type === 'tool_result')
}

const collectToolUseNames = (messages: Message[]): Map<string, string> => {
  const map = new Map<string, string>()
  for (const message of messages) {
    if (message.role !== 'assistant' || typeof message.content === 'string') continue
    for (const block of message.content) {
      if (block.type !== 'tool_use') continue
      const id = typeof block.id === 'string' ? block.id : undefined
      const name = typeof block.name === 'string' ? block.name : undefined
      if (id && name) map.set(id, name)
    }
  }
  return map
}

const summarizeCompactedToolResult = (toolName: string, content: unknown): string => {
  const text =
    typeof content === 'string'
      ? content
      : content === undefined || content === null
        ? ''
        : JSON.stringify(content)

  if (text.includes('"compacted":true') || text.includes('"compacted": true')) {
    return text
  }

  const summary: Record<string, unknown> = {
    tool: toolName,
    ok: true,
    compacted: true,
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (isRecord(parsed)) {
      if ('error' in parsed) {
        summary.ok = false
        if (typeof parsed.error === 'string' && parsed.error.trim()) {
          summary.error = parsed.error.replace(/\s+/g, ' ').trim().slice(0, 120)
        }
      }
      for (const key of TOOL_RESULT_SUMMARY_KEYS) {
        if (!(key in parsed)) continue
        const value = parsed[key]
        if (key === 'columns' && Array.isArray(value)) {
          summary.columnCount = value.length
          continue
        }
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          summary[key] = value
          continue
        }
        if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
          summary[key] = value.slice(0, 8)
        }
      }
    }
  } catch {
    summary.ok = !ERROR_KEY_RE.test(text.slice(0, 200))
    summary.chars = text.length
  }

  return JSON.stringify(summary)
}

const compactPremiumAgentMessages = (messages: Message[]): Message[] => {
  const toolResultIndexes: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user' && hasToolResultBlocks(messages[i])) {
      toolResultIndexes.push(i)
    }
  }
  const staleCount = toolResultIndexes.length - PREMIUM_AGENT_KEEP_TOOL_TURNS
  if (staleCount <= 0) return messages

  const toolNames = collectToolUseNames(messages)
  for (let t = 0; t < staleCount; t++) {
    const message = messages[toolResultIndexes[t]]
    if (typeof message.content === 'string') continue
    for (const block of message.content) {
      if (block.type !== 'tool_result') continue
      const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : ''
      const toolName = toolNames.get(toolUseId) ?? 'unknown'
      block.content = summarizeCompactedToolResult(toolName, block.content)
    }
  }
  return messages
}

const summarizeToolDetail = (
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
      } catch {
        /* ignore */
      }
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

const summarizeToolError = (
  name: string,
  input: Record<string, unknown>,
  result: string
): string => {
  const base = summarizeToolDetail(name, input, result)
  let err = 'error'
  try {
    const parsed = JSON.parse(result) as { error?: unknown; dateRange?: { from?: string; to?: string } }
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

const toolPriority = (name: string): number => {
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

const normalizeHistory = (
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> => {
  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const turn of history) {
    const last = merged[merged.length - 1]
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n${turn.content}`
      continue
    }
    merged.push({ role: turn.role, content: turn.content })
  }
  while (merged.length > 0 && merged[merged.length - 1].role === 'user') merged.pop()
  if (merged[0]?.role === 'assistant') merged.shift()
  return merged
}
