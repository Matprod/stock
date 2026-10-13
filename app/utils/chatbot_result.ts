export type ChatbotQuestion = {
  id: string
  title: string
  question: string
}

export type ChatbotJsonResponse = {
  response: string
  questions: ChatbotQuestion[]
}

export interface ChatbotReportPayload {
  daily_report?: string
  full_report?: string
}

export const classifyJsonStringQuote = (
  text: string,
  quoteIndex: number
): 'close' | 'literal' | 'wait' => {
  let j = quoteIndex + 1
  while (
    j < text.length &&
    (text[j] === ' ' || text[j] === '\n' || text[j] === '\r' || text[j] === '\t')
  ) {
    j++
  }
  if (j >= text.length) return 'wait'
  const next = text[j]
  if (next === ',' || next === '}' || next === ']') return 'close'
  return 'literal'
}

const decodeJsonEscapeChar = (ch: string): string => {
  if (ch === 'n') return '\n'
  if (ch === 't') return '\t'
  if (ch === 'r') return '\r'
  return ch
}

const stripMarkdownFence = (raw: string): string => {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) return fenced[1].trim()
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

export function cleanJsonResponse(response: string): string {
  const stripped = stripMarkdownFence(response)
  try {
    JSON.parse(stripped)
    return stripped
  } catch {
    const jsonStart = stripped.indexOf('{')
    if (jsonStart === -1) throw new Error('No valid JSON structure found')

    const jsonEnd = stripped.lastIndexOf('}')
    let jsonPart =
      jsonEnd > jsonStart ? stripped.substring(jsonStart, jsonEnd + 1) : stripped.slice(jsonStart)

    jsonPart = jsonPart
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    let inString = false
    let escaped = false
    let result = ''

    for (let i = 0; i < jsonPart.length; i++) {
      const char = jsonPart[i]

      if (escaped) {
        result += char
        escaped = false
      } else if (char === '\\') {
        result += char
        escaped = true
      } else if (char === '"') {
        if (!inString) {
          inString = true
          result += char
        } else if (classifyJsonStringQuote(jsonPart, i) === 'close') {
          inString = false
          result += char
        } else {
          result += '\\"'
        }
      } else if (char === '\n' && inString) {
        result += '\\n'
      } else if (char === '\t' && inString) {
        result += '\\t'
      } else {
        result += char
      }
    }

    if (inString) result += '"'
    if (!result.trimEnd().endsWith('}')) result += '}'

    return result
  }
}

export const findJsonStringFieldMarker = (
  raw: string,
  field: string
): { start: number; len: number } | null => {
  const markers = [`"${field}": "`, `"${field}":"`]
  let best: { start: number; len: number } | null = null
  for (const marker of markers) {
    const idx = raw.indexOf(marker)
    if (idx < 0) continue
    if (!best || idx < best.start) best = { start: idx, len: marker.length }
  }
  return best
}

export const extractJsonStringField = (raw: string, field: string): string | null => {
  const marker = findJsonStringFieldMarker(raw, field)
  if (!marker) return null

  let i = marker.start + marker.len
  let escaped = false
  let out = ''
  while (i < raw.length) {
    const ch = raw[i]
    if (escaped) {
      out += decodeJsonEscapeChar(ch)
      escaped = false
    } else if (ch === '\\') {
      escaped = true
    } else if (ch === '"') {
      const decision = classifyJsonStringQuote(raw, i)
      if (decision === 'close' || decision === 'wait') break
      out += '"'
    } else {
      out += ch
    }
    i += 1
  }
  return out.trim() ? out : null
}

const normalizeQuestions = (raw: unknown): ChatbotQuestion[] => {
  if (!Array.isArray(raw)) return []
  const out: ChatbotQuestion[] = []
  for (let i = 0; i < raw.length && out.length < 5; i++) {
    const item = raw[i]
    if (typeof item === 'string') {
      const text = item.trim()
      if (!text) continue
      out.push({ id: `q${out.length + 1}`, title: text, question: text })
      continue
    }
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    let question = ''
    if (typeof record.question === 'string') question = record.question.trim()
    else if (typeof record.prompt === 'string') question = record.prompt.trim()
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const text = question || title
    if (!text) continue
    out.push({
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `q${out.length + 1}`,
      title: title || text,
      question: text,
    })
  }
  return out
}

const toChatbotJsonResponse = (parsed: unknown): ChatbotJsonResponse | null => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (typeof record.response !== 'string') return null
  return {
    response: record.response,
    questions: normalizeQuestions(record.questions),
  }
}

export const tryParseCompleteJsonResponse = (response: string): ChatbotJsonResponse | null => {
  try {
    return toChatbotJsonResponse(JSON.parse(stripMarkdownFence(response)))
  } catch {
    return null
  }
}

export const tryParseJsonResponse = (response: string): ChatbotJsonResponse | null => {
  const stripped = stripMarkdownFence(response)
  const complete = tryParseCompleteJsonResponse(stripped)
  if (complete) return complete

  try {
    const cleaned = cleanJsonResponse(stripped)
    const fromClean = tryParseCompleteJsonResponse(cleaned)
    if (fromClean) return fromClean
  } catch {}

  const extracted = extractJsonStringField(stripped, 'response')
  if (!extracted) return null
  return { response: extracted, questions: [] }
}

const toChatbotReportPayload = (parsed: unknown): ChatbotReportPayload | null => {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  const dailyReport = typeof record.daily_report === 'string' ? record.daily_report : undefined
  const fullReport = typeof record.full_report === 'string' ? record.full_report : undefined
  if (!dailyReport && !fullReport) return null
  return { daily_report: dailyReport, full_report: fullReport }
}

export const parseChatbotReportPayload = (response: string): ChatbotReportPayload | null => {
  const stripped = stripMarkdownFence(response)
  try {
    const direct = toChatbotReportPayload(JSON.parse(stripped))
    if (direct) return direct
  } catch {}

  try {
    const cleaned = toChatbotReportPayload(JSON.parse(cleanJsonResponse(stripped)))
    if (cleaned) return cleaned
  } catch {}

  const dailyReport = extractJsonStringField(stripped, 'daily_report') ?? undefined
  const fullReport = extractJsonStringField(stripped, 'full_report') ?? undefined
  if (!dailyReport && !fullReport) return null
  return { daily_report: dailyReport, full_report: fullReport }
}

export const forwardJsonStringChars = (
  text: string,
  startEscaped: boolean,
  startState: 'preamble' | 'in_value' | 'done',
  onToken: (t: string) => void,
  startPendingQuote = false
): { escaped: boolean; state: 'preamble' | 'in_value' | 'done'; pendingQuote: boolean } => {
  let buffer = ''
  let escaped = startEscaped
  let state = startState
  let pendingQuote = startPendingQuote

  const flush = () => {
    if (buffer) {
      onToken(buffer)
      buffer = ''
    }
  }

  if (pendingQuote && state === 'in_value') {
    const decision = classifyJsonStringQuote(text, -1)
    if (decision === 'wait') return { escaped, state, pendingQuote: true }
    pendingQuote = false
    if (decision === 'close') {
      flush()
      return { escaped: false, state: 'done', pendingQuote: false }
    }
    buffer += '"'
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (state !== 'in_value') break
    if (escaped) {
      buffer += decodeJsonEscapeChar(ch)
      escaped = false
    } else if (ch === '\\') {
      escaped = true
    } else if (ch === '"') {
      const decision = classifyJsonStringQuote(text, i)
      if (decision === 'wait') {
        flush()
        return { escaped: false, state: 'in_value', pendingQuote: true }
      }
      if (decision === 'close') {
        flush()
        state = 'done'
      } else {
        buffer += '"'
      }
    } else {
      buffer += ch
    }
  }

  flush()
  return { escaped, state, pendingQuote }
}
