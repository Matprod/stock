import { findJsonStringFieldMarker, forwardJsonStringChars } from '#utils/chatbot_result'
import type { Message } from '#utils/agent/agent_logger'

type JsonStreamState = 'preamble' | 'in_value' | 'done'

export type StreamedBedrockTurn = {
  stopReason: string
  content: Array<Record<string, unknown>>
  iterationText: string
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheCreationInputTokens: number
  }
}

const createTextForwarder = (
  onTextToken: ((token: string) => void) | undefined,
  filterJsonResponse: boolean
) => {
  let jsonAccumulated = ''
  let jsonState: JsonStreamState = 'preamble'
  let jsonEscaped = false
  let jsonPendingQuote = false

  const forwardText = (chunk: string) => {
    if (!onTextToken) return
    if (!filterJsonResponse) {
      onTextToken(chunk)
      return
    }
    jsonAccumulated += chunk
    if (jsonState === 'preamble') {
      const marker = findJsonStringFieldMarker(jsonAccumulated, 'response')
      if (!marker) return
      jsonState = 'in_value'
      const afterMarker = jsonAccumulated.slice(marker.start + marker.len)
      const r = forwardJsonStringChars(
        afterMarker,
        jsonEscaped,
        jsonState,
        onTextToken,
        jsonPendingQuote
      )
      jsonEscaped = r.escaped
      jsonState = r.state
      jsonPendingQuote = r.pendingQuote
    } else if (jsonState === 'in_value') {
      const r = forwardJsonStringChars(
        chunk,
        jsonEscaped,
        jsonState,
        onTextToken,
        jsonPendingQuote
      )
      jsonEscaped = r.escaped
      jsonState = r.state
      jsonPendingQuote = r.pendingQuote
    }
  }

  const flushBufferedFinalAnswer = (fullText: string, streamTokens: boolean) => {
    if (!onTextToken || streamTokens || !fullText.trim()) return
    if (filterJsonResponse) {
      jsonAccumulated = ''
      jsonState = 'preamble'
      jsonEscaped = false
      jsonPendingQuote = false
    }
    forwardText(fullText)
  }

  return { forwardText, flushBufferedFinalAnswer }
}

const reconstructContent = (
  blockMeta: Record<number, { type: string; id?: string; name?: string }>,
  blockTexts: Record<number, string>,
  blockInputs: Record<number, string>
): Array<Record<string, unknown>> => {
  const maxIdx =
    Object.keys(blockMeta).length > 0 ? Math.max(...Object.keys(blockMeta).map(Number)) : -1
  const content: Array<Record<string, unknown>> = []
  for (let idx = 0; idx <= maxIdx; idx++) {
    const meta = blockMeta[idx]
    if (!meta) continue
    if (meta.type === 'text') {
      content.push({ type: 'text', text: blockTexts[idx] ?? '' })
    } else if (meta.type === 'tool_use') {
      let input: unknown = {}
      try {
        input = JSON.parse(blockInputs[idx] ?? '{}')
      } catch {
        /* keep empty input */
      }
      content.push({ type: 'tool_use', id: meta.id, name: meta.name, input })
    }
  }
  return content
}

/**
 * Consumes a Bedrock Anthropic response stream and rebuilds message content.
 * When `shouldStreamToClient` is true, text deltas are forwarded live (with optional
 * JSON `response` field filtering for team/athlete chat).
 */
export const consumeBedrockStream = async (args: {
  body: AsyncIterable<{ chunk?: { bytes?: Uint8Array } }>
  shouldStreamToClient: boolean
  filterJsonResponse: boolean
  onTextToken?: (token: string) => void
  signal?: AbortSignal
}): Promise<StreamedBedrockTurn & { flushBufferedFinalAnswer: (text: string) => void }> => {
  const { body, shouldStreamToClient, filterJsonResponse, onTextToken, signal } = args
  const { forwardText, flushBufferedFinalAnswer } = createTextForwarder(
    onTextToken,
    filterJsonResponse
  )

  let stopReason = ''
  const blockTexts: Record<number, string> = {}
  const blockInputs: Record<number, string> = {}
  const blockMeta: Record<number, { type: string; id?: string; name?: string }> = {}
  let iterationText = ''
  let streamTokens = false
  let decided = false
  let pendingText = ''
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadInputTokens = 0
  let cacheCreationInputTokens = 0
  const decoder = new TextDecoder()

  for await (const event of body) {
    if (signal?.aborted) {
      const err = new Error('Report generation cancelled')
      err.name = 'AbortError'
      throw err
    }
    if (!event.chunk?.bytes) continue
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(decoder.decode(event.chunk.bytes)) as Record<string, unknown>
    } catch {
      continue
    }

    if (parsed.type === 'message_start') {
      const message = parsed.message as { usage?: Record<string, unknown> } | undefined
      const usage = message?.usage
      if (usage) {
        inputTokens = readTokenCount(usage.input_tokens) ?? inputTokens
        outputTokens = readTokenCount(usage.output_tokens) ?? outputTokens
        cacheReadInputTokens =
          readTokenCount(usage.cache_read_input_tokens) ?? cacheReadInputTokens
        cacheCreationInputTokens =
          readTokenCount(usage.cache_creation_input_tokens) ?? cacheCreationInputTokens
      }
    } else if (parsed.type === 'content_block_start') {
      const idx = parsed.index as number
      const cb = parsed.content_block as {
        type: string
        id?: string
        name?: string
        text?: string
      }
      blockMeta[idx] = { type: cb.type, id: cb.id, name: cb.name }
      blockTexts[idx] = cb.text ?? ''
      blockInputs[idx] = ''
      if (idx === 0) {
        decided = true
        if (cb.type === 'text' && shouldStreamToClient) {
          streamTokens = true
          if (pendingText) {
            forwardText(pendingText)
            pendingText = ''
          }
        } else {
          streamTokens = false
          pendingText = ''
        }
      }
    } else if (parsed.type === 'content_block_delta') {
      const idx = parsed.index as number
      const delta = parsed.delta as { type: string; text?: string; partial_json?: string }
      if (delta.type === 'text_delta' && delta.text) {
        blockTexts[idx] = (blockTexts[idx] ?? '') + delta.text
        iterationText += delta.text
        if (!decided) pendingText += delta.text
        else if (streamTokens) forwardText(delta.text)
      } else if (delta.type === 'input_json_delta' && delta.partial_json) {
        blockInputs[idx] = (blockInputs[idx] ?? '') + delta.partial_json
      }
    } else if (parsed.type === 'message_delta') {
      const delta = parsed.delta as { stop_reason?: string }
      if (delta.stop_reason) stopReason = delta.stop_reason
      const usage = parsed.usage as Record<string, unknown> | undefined
      if (usage) {
        const nextInput = readTokenCount(usage.input_tokens)
        const nextOutput = readTokenCount(usage.output_tokens)
        if (nextInput != null) inputTokens = nextInput
        if (nextOutput != null) outputTokens = nextOutput
        cacheReadInputTokens =
          readTokenCount(usage.cache_read_input_tokens) ?? cacheReadInputTokens
        cacheCreationInputTokens =
          readTokenCount(usage.cache_creation_input_tokens) ?? cacheCreationInputTokens
      }
    }
  }

  return {
    stopReason,
    content: reconstructContent(blockMeta, blockTexts, blockInputs),
    iterationText,
    usage: {
      inputTokens,
      outputTokens,
      cacheReadInputTokens,
      cacheCreationInputTokens,
    },
    flushBufferedFinalAnswer: (text: string) => flushBufferedFinalAnswer(text, streamTokens),
  }
}

const readTokenCount = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value)
  return null
}

const lastMessageHasPartitionHint = (messages: Message[]): boolean => {
  for (let idx = messages.length - 1; idx >= 0; idx--) {
    const message = messages[idx]
    if (message.role !== 'user') continue
    const { content } = message
    if (typeof content === 'string') return content.includes('partition_hint')
    if (!Array.isArray(content)) return false
    return content.some((block) => {
      const value = (block as { content?: unknown }).content
      return typeof value === 'string' && value.includes('"partition_hint"')
    })
  }
  return false
}

export const appendForceAnswerHint = (args: {
  messages: Message[]
  iteration: number
  forceAnswerAt: number
  seriesIntent: boolean
  seriesDecodedOnce: boolean
  seriesForceAnswerAt: number
}): void => {
  const {
    messages,
    iteration: i,
    forceAnswerAt,
    seriesIntent,
    seriesDecodedOnce,
    seriesForceAnswerAt,
  } = args

  if (i === forceAnswerAt) {
    let content =
      'Tools are disabled — final answer now from tool results only. Do not invent players, dates, metrics, or counts.'
    if (seriesIntent) {
      content = 'Tools disabled — final answer from series summary. Do not invent charts.'
    } else if (lastMessageHasPartitionHint(messages)) {
      content =
        'Tools are disabled. Full SQL rows were not returned (partition_hint). Say you need a narrower query — do not invent player names, injuries, dates, or counts.'
    }
    messages.push({
      role: 'user',
      content,
    })
  } else if (seriesIntent && !seriesDecodedOnce && i === seriesForceAnswerAt) {
    messages.push({
      role: 'user',
      content: 'No charts yet. ONE SQL + correct s.type; N derniers → LIMIT N.',
    })
  }
}
