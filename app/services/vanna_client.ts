const VANNA_URL = process.env.VANNA_SERVICE_URL ?? 'http://localhost:8002'
const REQUEST_TIMEOUT_MS = 1500
const MAX_EXAMPLES_CHARS = 1500
const VANNA_DEBUG = process.env.VANNA_DEBUG === 'true'

type SqlExample = { question: string; sql: string }

/** Returns similar SQL examples, or empty string if the service is unavailable. */
export async function getSimilarSql(question: string, limit = 3): Promise<string> {
  try {
    const url = `${VANNA_URL}/similar?q=${encodeURIComponent(question)}&limit=${limit}`
    if (VANNA_DEBUG) {
      console.log(`[VANNA] GET /similar limit=${limit} q_preview=${JSON.stringify(question.slice(0, 120))}`)
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) return ''

    const data = (await res.json()) as { examples: SqlExample[] }
    if (!data.examples?.length) return ''

    const lines: string[] = []
    let totalChars = 0
    for (const e of data.examples) {
      const entry = `-- ${e.question}\n${e.sql}`
      if (totalChars + entry.length > MAX_EXAMPLES_CHARS && lines.length > 0) break
      lines.push(entry)
      totalChars += entry.length
    }

    if (lines.length === 0) return ''
    return `\nVALIDATED SQL EXAMPLES (use as reference for similar questions):\n${lines.join('\n\n')}`
  } catch {
    return ''
  }
}

/** Store a question/SQL pair. Fire-and-forget -- never throws. */
export async function trainSql(question: string, sql: string): Promise<void> {
  try {
    if (VANNA_DEBUG) {
      console.log(`[VANNA] POST /train q_preview=${JSON.stringify(question.slice(0, 120))} sql_preview=${JSON.stringify(sql.slice(0, 200))}`)
    }
    await fetch(`${VANNA_URL}/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sql }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {}
}
