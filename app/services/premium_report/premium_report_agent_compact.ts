import type { Message } from '#utils/agent/agent_logger'

const ERROR_KEY_RE = /"error"\s*:/
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

export const compactPremiumAgentMessages = (messages: Message[]): Message[] => {
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

export const normalizeHistory = (
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
