/**
 * Bedrock invoke metrics & structured logging helpers for the agent loop.
 *
 * All functions are no-ops unless AGENT_BEDROCK_METRICS_LOG=true.
 */

import logger from '@adonisjs/core/services/logger'

const AGENT_BEDROCK_METRICS_LOG = process.env.AGENT_BEDROCK_METRICS_LOG === 'true'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MessageContent = Array<Record<string, unknown>>
export type Message = { role: 'user' | 'assistant'; content: string | MessageContent }

export type AgentInvokeMetrics = {
  iteration: number
  iteration_status: boolean
  system_chars: number
  messages_count: number
  messages_chars: number
  tools_schema_chars: number
  request_json_chars: number
  approx_input_tokens: number
  max_tokens: number
  largest_message_index: number
  largest_message_role: string
  largest_message_chars: number
  /** Every tool invoked so far in this agent run (from assistant tool_use blocks). */
  tool_use_sequence: string[]
  /** Tools requested in the latest assistant turn that used tools (empty before first tool round). */
  last_round_tool_names: string[]
  /** Wall time for this iteration (Bedrock invoke + tool execution when tool_use), in ms. */
  iteration_duration_ms?: number
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function messageContentCharLen(content: string | MessageContent): number {
  if (typeof content === 'string') return content.length
  try {
    return JSON.stringify(content).length
  } catch {
    return 0
  }
}

function toolNamesFromAssistantContent(content: string | MessageContent): string[] {
  if (typeof content === 'string') return []
  const names: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as { type?: string; name?: string }
    if (b.type === 'tool_use' && b.name) names.push(b.name)
  }
  return names
}

/** All tool_use names from assistant messages, in chronological order (may repeat). */
function collectToolUseSequence(messages: Message[]): string[] {
  const seq: string[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    seq.push(...toolNamesFromAssistantContent(m.content))
  }
  return seq
}

/** Tool names from the most recent assistant message that contains tool_use blocks. */
function lastAssistantRoundToolNames(messages: Message[]): string[] {
  for (let idx = messages.length - 1; idx >= 0; idx--) {
    const m = messages[idx]
    if (m.role !== 'assistant') continue
    const names = toolNamesFromAssistantContent(m.content)
    if (names.length > 0) return names
  }
  return []
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function buildInvokeMetrics(args: {
  iteration: number
  iterationStatus: boolean
  systemPrompt: string
  messages: Message[]
  toolSchemas: unknown[]
  maxTokens: number
  requestBody: Record<string, unknown>
}): AgentInvokeMetrics {
  const messagesChars = args.messages.reduce((acc, m) => acc + messageContentCharLen(m.content), 0)
  let largestIdx = 0
  let largestChars = 0
  args.messages.forEach((m, idx) => {
    const c = messageContentCharLen(m.content)
    if (c > largestChars) {
      largestChars = c
      largestIdx = idx
    }
  })
  const requestJsonChars = JSON.stringify(args.requestBody).length
  return {
    iteration: args.iteration,
    iteration_status: args.iterationStatus,
    system_chars: args.systemPrompt.length,
    messages_count: args.messages.length,
    messages_chars: messagesChars,
    tools_schema_chars: args.iterationStatus ? JSON.stringify(args.toolSchemas).length : 0,
    request_json_chars: requestJsonChars,
    approx_input_tokens: Math.ceil(requestJsonChars / 4),
    max_tokens: args.maxTokens,
    largest_message_index: largestIdx,
    largest_message_role: args.messages[largestIdx]?.role ?? '',
    largest_message_chars: largestChars,
    tool_use_sequence: collectToolUseSequence(args.messages),
    last_round_tool_names: lastAssistantRoundToolNames(args.messages),
  }
}

export function logInvokeIterationIfEnabled(
  metrics: AgentInvokeMetrics,
  iterationDurationMs: number
): void {
  if (!AGENT_BEDROCK_METRICS_LOG) return
  logger.info(
    { ...metrics, iteration_duration_ms: Math.round(iterationDurationMs) },
    '[AGENT_BEDROCK] invoke_request_sizes'
  )
}

export function logAgentReasoningIfEnabled(
  iteration: number,
  text: string,
  mode: string | undefined
): void {
  if (!AGENT_BEDROCK_METRICS_LOG) return
  const trimmed = text.trim()
  if (!trimmed) return
  logger.info(
    { iteration, mode: mode ?? 'unknown', reasoning: trimmed },
    '[AGENT_REASONING] assistant_text'
  )
}

export function logAgentToolCallIfEnabled(
  iteration: number,
  toolName: string,
  input: unknown,
  mode: string | undefined
): void {
  if (!AGENT_BEDROCK_METRICS_LOG) return
  logger.info(
    { iteration, mode: mode ?? 'unknown', tool: toolName, input },
    '[AGENT_TOOL_CALL] tool_use'
  )
}

export function logAgentToolResultIfEnabled(
  iteration: number,
  toolName: string,
  result: string,
  mode: string | undefined
): void {
  if (!AGENT_BEDROCK_METRICS_LOG) return
  let parsed: unknown
  try {
    parsed = JSON.parse(result)
  } catch {
    parsed = undefined
  }
  const isArray = Array.isArray(parsed)
  const hasError = !isArray && typeof parsed === 'object' && parsed !== null && 'error' in parsed
  const preview = result.length > 500 ? `${result.slice(0, 500)}…` : result
  logger.info(
    {
      iteration,
      mode: mode ?? 'unknown',
      tool: toolName,
      row_count: isArray ? (parsed as unknown[]).length : undefined,
      result_chars: result.length,
      error: hasError ? (parsed as { error: string }).error : undefined,
      preview,
    },
    '[AGENT_TOOL_RESULT] tool_result'
  )
}

export function logBedrockInvokeFailure(err: unknown, metrics: AgentInvokeMetrics): void {
  const requestId =
    typeof err === 'object' && err !== null && '$metadata' in err
      ? (err as { $metadata?: { requestId?: string; httpStatusCode?: number } }).$metadata
          ?.requestId
      : undefined
  const httpStatus =
    typeof err === 'object' && err !== null && '$metadata' in err
      ? (err as { $metadata?: { requestId?: string; httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
      : undefined
  logger.error(
    {
      ...metrics,
      error_name: err instanceof Error ? err.name : 'unknown',
      error_message: err instanceof Error ? err.message : String(err),
      aws_request_id: requestId,
      aws_http_status: httpStatus,
    },
    '[AGENT_BEDROCK] invoke_failed'
  )
}
