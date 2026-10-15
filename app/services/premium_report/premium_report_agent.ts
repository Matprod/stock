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
} from '#constants/premium_report.constants'
import type { Message } from '#utils/agent/agent_logger'
import { consumeBedrockStream } from '#utils/agent/agent_bedrock_stream'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import {
  elapsedSec,
  logPremiumIteration,
  type PremiumReportTokenUsage,
} from '#services/premium_report/premium_report_log'
import {
  compactPremiumAgentMessages,
  normalizeHistory,
} from '#services/premium_report/premium_report_agent_compact'
import {
  handlePremiumEndTurn,
  simpleError,
  type EndTurnNudgeState,
} from '#services/premium_report/premium_report_agent_end_turn'
import {
  appendToolResultsMessage,
  executePremiumToolUses,
} from '#services/premium_report/premium_report_agent_tools'
import type {
  PremiumAgentIterationEvent,
  PremiumAgentResult,
} from '#services/premium_report/premium_report_agent_types'

export type { PremiumReportTokenUsage, PremiumAgentIterationEvent }

const CACHE_EPHEMERAL = { type: 'ephemeral' as const }
const SQL_TOOL_NAMES = new Set(['query_database'])

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

export const toolsWithCache = (
  schemas: Array<PremiumTool['schema']>
): Array<PremiumTool['schema'] & { cache_control?: { type: 'ephemeral' } }> => {
  if (schemas.length === 0) return schemas
  return schemas.map((schema, index) =>
    index === schemas.length - 1 ? { ...schema, cache_control: CACHE_EPHEMERAL } : schema
  )
}

export const resolveActiveTools = (
  tools: PremiumTool[],
  state: PremiumReportState
): PremiumTool[] => {
  return state.blockSql ? tools.filter((tool) => !SQL_TOOL_NAMES.has(tool.schema.name)) : tools
}

export const stampLastMessageCache = (messages: Message[]): void => {
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue
    for (const block of msg.content) {
      if (block && typeof block === 'object' && 'cache_control' in block) {
        delete block.cache_control
      }
    }
  }
  const last = messages[messages.length - 1]
  if (!last) return
  if (typeof last.content === 'string') {
    last.content = [
      {
        type: 'text',
        text: last.content,
        cache_control: CACHE_EPHEMERAL,
      },
    ]
    return
  }
  if (!Array.isArray(last.content) || last.content.length === 0) return
  const lastBlock = last.content[last.content.length - 1]
  if (lastBlock && typeof lastBlock === 'object') {
    lastBlock.cache_control = CACHE_EPHEMERAL
  }
}

export const buildPremiumSystemBlocks = (args: {
  systemPrompt?: string
  systemStable?: string
  systemRun?: string
}): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> => {
  if (args.systemStable != null) {
    return [
      {
        type: 'text',
        text: args.systemStable,
        cache_control: CACHE_EPHEMERAL,
      },
      ...(args.systemRun
        ? [
            {
              type: 'text' as const,
              text: args.systemRun,
            },
          ]
        : []),
    ]
  }
  return [
    {
      type: 'text',
      text: args.systemPrompt ?? '',
      cache_control: CACHE_EPHEMERAL,
    },
  ]
}

export const resolvePremiumToolChoice = (args: {
  toolsEnabled: boolean
  forceToolUse: boolean
}): { type: 'any' } | { type: 'none' } | undefined => {
  if (!args.toolsEnabled) return { type: 'none' }
  if (args.forceToolUse) return { type: 'any' }
  return undefined
}

export const emptyUsage = (): PremiumReportTokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  totalTokens: 0,
  estimatedCostUsd: 0,
})

const estimateCostUsd = (usage: {
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

export const runPremiumReportAgent = async (args: {
  systemPrompt?: string
  systemStable?: string
  systemRun?: string
  userPrompt: string
  userContentExtra?: Array<Record<string, unknown>>
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  tools: PremiumTool[]
  state: PremiumReportState
  onIteration?: (event: PremiumAgentIterationEvent) => void
  maxIterations?: number
  forceAnswerAt?: number
  maxTokens?: number
  temperature?: number
  minIterations?: number
  maxEndTurnNudges?: number
  continuePrompt?: string
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
        },
        ...(args.userContentExtra ?? []),
      ],
    },
  ]
  const nudgeState: EndTurnNudgeState = {
    idleRetried: false,
    unchangedRetried: false,
    endTurnNudges: 0,
  }
  const startBlocksSnap = JSON.stringify(args.state.document.blocks)
  const startDatasetCount = args.state.datasets.size
  const totals = emptyUsage()
  const systemBlocks = buildPremiumSystemBlocks({
    systemPrompt: args.systemPrompt,
    systemStable: args.systemStable,
    systemRun: args.systemRun,
  })

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (args.signal?.aborted) {
      const err = new Error('Report generation cancelled')
      err.name = 'AbortError'
      throw err
    }
    const toolsEnabled = iteration < forceAnswerAt
    const activeTools = resolveActiveTools(args.tools, args.state)
    const toolMap = new Map(activeTools.map((tool) => [tool.schema.name, tool]))
    const toolSchemas = toolsWithCache(activeTools.map((tool) => tool.schema))
    const forceToolUse =
      toolsEnabled &&
      args.state.mustUseTools &&
      args.state.toolHistory.length === 0 &&
      toolSchemas.length > 0
    const toolChoice = resolvePremiumToolChoice({ toolsEnabled, forceToolUse })

    stampLastMessageCache(messages)

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
          system: systemBlocks,
          tools: toolSchemas,
          ...(toolChoice ? { tool_choice: toolChoice } : {}),
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

    if (uses.length > 0 && toolsEnabled) {
      messages.push({ role: 'assistant', content: turn.content })
      const truncated = turn.stopReason === 'max_tokens'
      const { toolResults, toolEvents } = await executePremiumToolUses({
        uses,
        toolMap,
        state: args.state,
        truncated,
        signal: args.signal,
      })
      args.onIteration?.({
        iteration,
        stopReason: turn.stopReason,
        durationSec: elapsedSec(iterationStarted),
        usage: turnUsage,
        cumulative: { ...totals },
        tools: toolEvents,
        textPreview: turn.iterationText.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
      })
      appendToolResultsMessage(messages, toolResults, truncated)
      compactPremiumAgentMessages(messages)
      continue
    }

    if (uses.length > 0 && !toolsEnabled) {
      args.onIteration?.({
        iteration,
        stopReason: turn.stopReason,
        durationSec: elapsedSec(iterationStarted),
        usage: turnUsage,
        cumulative: { ...totals },
        tools: [],
        textPreview: turn.iterationText.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
      })
      const outcome = handlePremiumEndTurn({
        messages,
        turnContent: turn.content.filter((block) => block.type !== 'tool_use'),
        iterationText: turn.iterationText,
        iteration,
        toolsEnabled: false,
        state: args.state,
        startBlocksSnap,
        startDatasetCount,
        nudgeState,
        minIterations,
        maxEndTurnNudges,
        continuePrompt,
        acceptEndTurn: args.acceptEndTurn,
        totals,
        maxIterations,
        forceAnswerAt,
      })
      if (outcome.action === 'continue') continue
      return outcome.result
    }

    if (turn.stopReason === 'end_turn' || turn.stopReason === 'max_tokens') {
      args.onIteration?.({
        iteration,
        stopReason: turn.stopReason,
        durationSec: elapsedSec(iterationStarted),
        usage: turnUsage,
        cumulative: { ...totals },
        tools: [],
        textPreview: turn.iterationText.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
      })
      const outcome = handlePremiumEndTurn({
        messages,
        turnContent: turn.content,
        iterationText: turn.iterationText,
        iteration,
        toolsEnabled,
        state: args.state,
        startBlocksSnap,
        startDatasetCount,
        nudgeState,
        minIterations,
        maxEndTurnNudges,
        continuePrompt,
        acceptEndTurn: args.acceptEndTurn,
        totals,
        maxIterations,
        forceAnswerAt,
      })
      if (outcome.action === 'continue') continue
      return outcome.result
    }
  }

  return {
    message: simpleError(args.state),
    iterations: maxIterations,
    usage: { ...totals },
    stopClass: 'max_reached',
    maxIterations,
    forceAnswerAt,
  }
}
