/**
 * AgentService — Bedrock agentic loop (orchestration only).
 *
 * Tools: `#services/agent_db_tool`, `#services/agent_tools`
 * SQL guards: `#utils/agent/agent_sql` · partition: `#utils/agent/agent_partition`
 * Schema/prompts: `#utils/agent/agent_schema`, `#utils/agent/agent_prompts`
 */

import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime'
import env from '#start/env'
import type { Message, MessageContent } from '#utils/agent/agent_logger'
import type { IChartSpec } from '#contracts/chatbot'
import type { AgentContext, AgentResult, AgentTool, HistoryEntry } from '#contracts/agent'
import {
  AGENT_TEMPERATURE,
  FORCE_ANSWER_AT,
  MAX_ITERATIONS,
  MODEL_ID,
  SERIES_QUESTION_HINT,
  SERIES_TO_PERIOD_METRICS_FALLBACK_HINT,
  TOKEN_LIMIT_CONTINUE_HINT,
  TOKEN_LIMIT_FINISH_JSON_HINT,
  TOOL_STATUS_LABELS,
} from '#constants/agent.constants'
import { MAX_SERIES_CHARTS, SERIES_FORCE_ANSWER_AT } from '#constants/agent_series.constants'
import {
  isSeriesChartQuestion,
  parseSeriesAutoDecoded,
  parseSeriesMetadata,
} from '#utils/agent/agent_series'
import { autoDecodeSeriesToolResult } from '#services/agent_series_service'
import { createDbTool } from '#services/agent_db_tool'
import { buildSystemPrompt } from '#utils/agent/agent_prompts'
import { tryParseCompleteJsonResponse } from '#utils/chatbot_result'
import { appendForceAnswerHint, consumeBedrockStream } from '#utils/agent/agent_bedrock_stream'
import { buildStatusMessage, createChartTool } from '#services/agent_tools'

export type {
  AgentContext,
  AgentResult,
  AgentTool,
  AthleteAgentContext,
  HistoryEntry,
  TeamAgentContext,
  TeamPartitionState,
} from '#contracts/agent'

export { createDbTool } from '#services/agent_db_tool'
export { createTeamPartitionState } from '#utils/agent/agent_partition'
export { createResponseStructureTool } from '#services/agent_tools'

/** Bedrock output token budget per iteration (required by the API). */
const DEFAULT_MAX_TOKENS = 8192

const getClient = (): BedrockRuntimeClient =>
  new BedrockRuntimeClient({
    region: env.get('AWS_REGION'),
    credentials: {
      accessKeyId: env.get('AWS_ACCESS_KEY'),
      secretAccessKey: env.get('AWS_SECRET_KEY'),
    },
  })

type ToolTurnFlags = {
  seriesDecodedOnce: boolean
  seriesMissed: boolean
}

const isSeriesQuerySql = (sql: string): boolean =>
  /\bseries\b/i.test(sql) ||
  /\bTOTAL_DISTANCE_IN_METERS\b|\bHEART_RATE\b|\bSPEED_METERS_PER_SECOND\b/i.test(sql)

const isEmptySeriesToolResult = (result: string): boolean => {
  if (result.includes('NO_CHARTABLE_SERIES')) return true
  try {
    const parsed = JSON.parse(result) as {
      error?: string
      auto_decoded?: boolean
      curveCount?: number
    }
    if (parsed?.error === 'NO_CHARTABLE_SERIES') return true
    if (parsed?.auto_decoded === true && (parsed.curveCount ?? 0) === 0) return true
  } catch {}
  return false
}

const executeToolTurn = async (args: {
  content: Array<Record<string, unknown>>
  toolMap: Map<string, AgentTool>
  context?: AgentContext
  question: string
  charts: IChartSpec[]
  pushChart: (spec: IChartSpec) => void
  flags: ToolTurnFlags
  seriesMode: boolean
  onStatus?: (status: string) => void
}): Promise<{ toolResults: Array<Record<string, unknown>>; flags: ToolTurnFlags }> => {
  const {
    content,
    toolMap,
    context,
    question,
    charts,
    pushChart,
    seriesMode,
    onStatus,
  } = args
  let { seriesDecodedOnce, seriesMissed } = args.flags

  const toolUseBlocks = content.filter((b) => b.type === 'tool_use')
  onStatus?.(buildStatusMessage(toolUseBlocks.map((b) => b.name as string)))

  const toolResults: Array<Record<string, unknown>> = []
  for (const block of toolUseBlocks) {
    const toolName = block.name as string
    const tool = toolMap.get(toolName)
    let result = tool
      ? await tool.execute(block.input as Record<string, string>)
      : JSON.stringify({ error: `Unknown tool: ${toolName}` })

    if (toolName === 'query_database') {
      const sql = String((block.input as { sql?: string })?.sql ?? '')

      if (seriesMode && isSeriesQuerySql(sql) && isEmptySeriesToolResult(result)) {
        seriesMissed = true
      }

      if (seriesMode) {
        if (seriesDecodedOnce && parseSeriesMetadata(result)) {
          result = JSON.stringify({
            error: 'SERIES_ALREADY_DECODED',
            n: charts.length,
            note: 'Charts already registered. Write the final answer.',
          })
        } else if (!seriesDecodedOnce) {
          const before = charts.length
          const decoded = await autoDecodeSeriesToolResult(result, context, pushChart, question)
          if (decoded) {
            onStatus?.(TOOL_STATUS_LABELS.decode_series)
            result = decoded
            if (parseSeriesAutoDecoded(decoded) && charts.length > before) {
              seriesDecodedOnce = true
            } else if (isEmptySeriesToolResult(decoded)) {
              seriesMissed = true
            }
          }
        }
      }
    }

    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
  }

  return {
    toolResults,
    flags: { seriesDecodedOnce, seriesMissed },
  }
}

export default class AgentService {
  /**
   * Agentic loop until Claude returns a final answer or MAX_ITERATIONS is reached.
   * Series curve questions use a lean path (no suggest_chart / history, auto-decode).
   */
  run = async (
    question: string,
    tools: AgentTool[],
    history: HistoryEntry[] = [],
    context?: AgentContext,
    onTextToken?: (token: string) => void,
    onStatus?: (status: string) => void
  ): Promise<AgentResult> => {
    const start = Date.now()
    const client = getClient()
    let seriesMode = isSeriesChartQuestion(question)
    let systemPrompt = await buildSystemPrompt(context, { leanSeries: seriesMode })
    let forceAnswerAt = seriesMode ? SERIES_FORCE_ANSWER_AT + 1 : FORCE_ANSWER_AT
    const maxTokens = DEFAULT_MAX_TOKENS
    const userQuestion = seriesMode ? `${question}\n${SERIES_QUESTION_HINT}` : question
    const messages: Message[] = [
      ...(seriesMode ? [] : history).map((h) => ({
        role: h.role,
        content: h.content as string | MessageContent,
      })),
      { role: 'user', content: userQuestion },
    ]

    const charts: IChartSpec[] = []
    const pushChart = (spec: IChartSpec) => {
      if (!seriesMode || charts.length < MAX_SERIES_CHARTS) charts.push(spec)
    }
    const chartTool = createChartTool(pushChart)
    let allTools = seriesMode ? [...tools] : [...tools, chartTool]
    let toolSchemas = allTools.map((t) => t.schema)
    let toolMap = new Map(allTools.map((t) => [t.schema.name, t]))
    let fallenBackFromSeries = false

    let flags: ToolTurnFlags = { seriesDecodedOnce: false, seriesMissed: false }
    let hasCompletedToolRound = false

    const fallbackSeriesToPeriodMetrics = async (
      iteration: number,
      opts?: { requireEmptyCharts?: boolean; assistantContent?: Message['content'] }
    ): Promise<boolean> => {
      if (!seriesMode || fallenBackFromSeries) return false
      if (opts?.requireEmptyCharts && charts.length > 0) return false

      if (opts?.assistantContent !== undefined) {
        messages.push({ role: 'assistant', content: opts.assistantContent })
      }

      fallenBackFromSeries = true
      seriesMode = false
      flags = { seriesDecodedOnce: false, seriesMissed: false }

      const fullDbTool = await createDbTool(question, context, undefined, {
        seriesOnly: false,
        useVannaExamples: false,
      })
      allTools = [fullDbTool, chartTool]
      toolSchemas = allTools.map((t) => t.schema)
      toolMap = new Map(allTools.map((t) => [t.schema.name, t]))
      systemPrompt = await buildSystemPrompt(context, { leanSeries: false })
      forceAnswerAt = Math.min(MAX_ITERATIONS, Math.max(forceAnswerAt, iteration + 5))
      messages.push({ role: 'user', content: SERIES_TO_PERIOD_METRICS_FALLBACK_HINT })
      return true
    }

    const filterJsonResponse = context?.mode === 'team' || context?.mode === 'athlete'
    let jsonFinishRetries = 0

    const finish = (answer: string, iterations: number): AgentResult => ({
      answer,
      iterations,
      duration_ms: Date.now() - start,
      charts,
    })

    const tryIncompleteJsonRetry = (
      answerText: string,
      assistantContent: Message['content'],
      iteration: number
    ): boolean => {
      if (!filterJsonResponse || jsonFinishRetries >= 1 || iteration >= MAX_ITERATIONS) return false
      const complete = tryParseCompleteJsonResponse(answerText)
      if (complete && complete.questions.length > 0) return false
      if (!/"response"\s*:/.test(answerText)) return false
      jsonFinishRetries += 1
      messages.push({ role: 'assistant', content: assistantContent })
      messages.push({ role: 'user', content: TOKEN_LIMIT_FINISH_JSON_HINT })
      return true
    }

    for (let i = 1; i <= MAX_ITERATIONS; i++) {
      if (i >= forceAnswerAt) {
        await fallbackSeriesToPeriodMetrics(i, { requireEmptyCharts: true })
      }

      appendForceAnswerHint({
        messages,
        iteration: i,
        forceAnswerAt,
        seriesIntent: seriesMode,
        seriesDecodedOnce: flags.seriesDecodedOnce,
        seriesForceAnswerAt: SERIES_FORCE_ANSWER_AT,
      })

      const iterationStatus = i < forceAnswerAt
      const shouldStreamToClient = !iterationStatus || hasCompletedToolRound
      const body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature: AGENT_TEMPERATURE,
        system: systemPrompt,
        tools: iterationStatus ? toolSchemas : [],
        messages,
      }

      const raw = await client.send(
        new InvokeModelWithResponseStreamCommand({
          modelId: MODEL_ID,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(body),
        })
      )

      const turn = await consumeBedrockStream({
        body: raw.body!,
        shouldStreamToClient,
        filterJsonResponse,
        onTextToken,
      })

      if (turn.stopReason === 'end_turn') {
        if (
          await fallbackSeriesToPeriodMetrics(i, {
            requireEmptyCharts: true,
            assistantContent: turn.content,
          })
        ) {
          continue
        }
        if (tryIncompleteJsonRetry(turn.iterationText, turn.content, i)) {
          continue
        }
        turn.flushBufferedFinalAnswer(turn.iterationText)
        return finish(turn.iterationText, i)
      }

      if (turn.stopReason === 'max_tokens' && turn.iterationText.trim().length > 0) {
        if (i < forceAnswerAt) {
          messages.push({ role: 'assistant', content: turn.content })
          messages.push({
            role: 'user',
            content: TOKEN_LIMIT_CONTINUE_HINT,
          })
          continue
        }
        if (
          await fallbackSeriesToPeriodMetrics(i, {
            requireEmptyCharts: true,
            assistantContent: turn.content,
          })
        ) {
          continue
        }
        if (tryIncompleteJsonRetry(turn.iterationText, turn.content, i)) {
          continue
        }
        turn.flushBufferedFinalAnswer(turn.iterationText)
        return finish(turn.iterationText, i)
      }

      if (turn.stopReason === 'tool_use') {
        messages.push({ role: 'assistant', content: turn.content })
        const toolTurn = await executeToolTurn({
          content: turn.content,
          toolMap,
          context,
          question,
          charts,
          pushChart,
          flags,
          seriesMode,
          onStatus,
        })
        flags = toolTurn.flags
        messages.push({ role: 'user', content: toolTurn.toolResults })
        hasCompletedToolRound = true

        if (toolTurn.flags.seriesMissed) {
          await fallbackSeriesToPeriodMetrics(i)
        }
      }
    }

    return finish('Max iterations reached without a final answer.', MAX_ITERATIONS)
  }
}
