import { VANNA_PROMPT_TITLES } from '#constants/agent.constants'
import Prompt from '#models_pg/prompt'
import { trainSql } from '#services/vanna_client'
import { isFeedbackOrCorrectionPrompt } from '#services/vanna_prompt_utils'

type Verdict = 'PASS' | 'FAIL' | 'UNSURE'

const GATE_DEBUG = process.env.VANNA_GATE_DEBUG === 'true'

type PendingTraining = {
  prompt: string
  canonicalPrompt: string
  answer: string
  sql: string[]
  createdAtMs: number
  timeoutId: NodeJS.Timeout
}

const PENDING_TTL_MS = 5 * 60 * 1000

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_JUDGE_MODEL ?? 'gemma4:e4B'
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_JUDGE_TIMEOUT_MS ?? '60000')

const pendingByDiscussionId = new Map<string, PendingTraining>()

function debugLog(step: string, data?: Record<string, unknown>): void {
  if (!GATE_DEBUG) return
  const ts = new Date().toISOString()
  const payload = data ? ` ${JSON.stringify(data)}` : ''
  console.log(`[VANNA_GATE][${ts}] ${step}${payload}`)
}

function normalizeUserText(text: string): string {
  return text.trim().toLowerCase()
}

function sqlPreviews(sql: string[], maxItems = 5, maxChars = 180): string[] {
  return sql.slice(0, maxItems).map((s) => s.replace(/\s+/g, ' ').trim().slice(0, maxChars))
}

function heuristicVerdict(nextUserMessage: string): Verdict | null {
  const t = normalizeUserText(nextUserMessage)
  if (!t) return null

  // Do not treat feedback/corrections as strong PASS.
  if (isFeedbackOrCorrectionPrompt(nextUserMessage)) {
    // Still allow a strict PASS for very short confirmations like "ok" / "merci".
    // Those are handled by passPatterns below (without doubt markers).
  }

  const doubtOrComplaintMarkers = [
    '?',
    ' but ',
    ' however ',
    ' though ',
    ' mais ',
    ' pourtant ',
    ' still ',
    ' not possible',
    ' impossible',
    ' wrong',
    " doesn't",
    ' does not',
    ' not correct',
  ]

  const hasDoubtOrComplaint = doubtOrComplaintMarkers.some((m) => t.includes(m))

  const failPatterns = [
    "c'est faux",
    'faux',
    "t'as faux",
    'tu as faux',
    'tu te trompes',
    'non',
    'pas ça',
    'pas ca',
    "tu n'as pas compris",
    "t'as pas compris",
    'tu comprends pas',
    'ça répond pas',
    'ca repond pas',
    'ça ne répond pas',
    'ca ne repond pas',
    'refais',
    'corrige',
    'recommence',
    'je voulais dire',
    'en fait',

    // English
    'no it is not possible',
    "it's not possible",
    'not possible',
    'impossible',
    'this is wrong',
    "that's wrong",
    'wrong',
  ]

  const passPatterns = [
    'merci',
    'parfait',
    "c'est bon",
    'ok',
    'super',
    'nickel',
    'top',

    // English
    'thanks',
    'thank you',
    'thx',
    'okay',
    'okey',
    'okeyy',
    'perfect',
    'great',
    'helpful',
    "that's correct",
    'that is correct',
    'it was correct',
    'correct',
  ]

  if (failPatterns.some((p) => t.includes(p))) return 'FAIL'
  if (
    !hasDoubtOrComplaint &&
    passPatterns.some((p) => t === p || t.startsWith(`${p} `) || t.endsWith(` ${p}`))
  ) {
    return 'PASS'
  }
  return null
}

async function ollamaJudge(args: {
  prompt: string
  answer: string
  nextUserMessage?: string
  sqlCount: number
}): Promise<Verdict> {
  const next = args.nextUserMessage?.trim() ?? ''

  const judgeTemplate = await Prompt.findByOrFail('title', VANNA_PROMPT_TITLES.judge).then(
    (p) => p.content
  )
  const judgePrompt = judgeTemplate
    .replaceAll('{{prompt}}', args.prompt)
    .replaceAll('{{answer}}', args.answer)
    .replaceAll('{{sqlCount}}', String(args.sqlCount))
    .replaceAll('{{nextUser}}', next)

  const startMs = Date.now()
  try {
    debugLog('judge:ollama:request', {
      model: OLLAMA_MODEL,
      has_next_user: Boolean(next),
      sql_count: args.sqlCount,
    })
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: judgePrompt,
        stream: false,
        format: 'json',
      }),
    })

    const durationMs = Date.now() - startMs
    debugLog('judge:ollama:response_meta', {
      status: res.status,
      ok: res.ok,
      duration_ms: durationMs,
    })

    if (!res.ok) return 'UNSURE'
    const data = (await res.json()) as { response?: string }
    const raw = (data.response ?? '').trim()
    if (!raw) return 'UNSURE'
    const parsed = JSON.parse(raw) as { verdict?: string }
    const verdict = parsed.verdict
    if (verdict === 'PASS' || verdict === 'FAIL' || verdict === 'UNSURE') return verdict
    return 'UNSURE'
  } catch (err: unknown) {
    const durationMs = Date.now() - startMs
    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        (err as { code?: string }).code === 'ABORT_ERR' ||
        err.message.toLowerCase().includes('timeout'))
    debugLog('judge:ollama:error', {
      timeout: isTimeout,
      duration_ms: durationMs,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
    return 'UNSURE'
  }
}

async function judgeAndTrain(params: {
  discussionId: string
  pending: PendingTraining
  nextUserMessage?: string
}): Promise<void> {
  const heuristic = params.nextUserMessage ? heuristicVerdict(params.nextUserMessage) : null
  const verdict =
    heuristic ??
    (await ollamaJudge({
      prompt: params.pending.prompt,
      answer: params.pending.answer,
      nextUserMessage: params.nextUserMessage,
      sqlCount: params.pending.sql.length,
    }))

  debugLog('judge:done', {
    discussion_id: params.discussionId,
    verdict,
    source: heuristic ? 'heuristic' : 'ollama',
    sql_count: params.pending.sql.length,
    has_next_user: Boolean(params.nextUserMessage?.trim()),
    age_ms: Date.now() - params.pending.createdAtMs,
  })

  if (verdict !== 'PASS') return

  debugLog('train:inputs', {
    discussion_id: params.discussionId,
    prompt_preview: params.pending.prompt.slice(0, 140),
    canonical_prompt_preview: params.pending.canonicalPrompt.slice(0, 140),
    sql_count: params.pending.sql.length,
    sql_previews: sqlPreviews(params.pending.sql),
  })

  debugLog('train:start', {
    discussion_id: params.discussionId,
    sql_count: params.pending.sql.length,
  })
  for (const sql of params.pending.sql) {
    trainSql(params.pending.canonicalPrompt, sql).catch(() => {})
  }
  debugLog('train:queued', { discussion_id: params.discussionId })
}

export function vannaGateClosePendingWithNextUserMessage(args: {
  discussionId: string
  nextUserMessage: string
}): void {
  const pending = pendingByDiscussionId.get(args.discussionId)
  if (!pending) {
    debugLog('close:no_pending', { discussion_id: args.discussionId })
    return
  }

  pendingByDiscussionId.delete(args.discussionId)
  clearTimeout(pending.timeoutId)

  debugLog('close:with_next_user', {
    discussion_id: args.discussionId,
    next_user_preview: args.nextUserMessage.slice(0, 120),
    sql_count: pending.sql.length,
    sql_previews: sqlPreviews(pending.sql),
  })
  void judgeAndTrain({
    discussionId: args.discussionId,
    pending,
    nextUserMessage: args.nextUserMessage,
  })
}

export function vannaGateClearPending(discussionId: string): void {
  const pending = pendingByDiscussionId.get(discussionId)
  if (!pending) return

  pendingByDiscussionId.delete(discussionId)
  clearTimeout(pending.timeoutId)
  debugLog('clear:pending', { discussion_id: discussionId })
}

export function vannaGateStorePending(args: {
  discussionId: string
  prompt: string
  canonicalPrompt: string
  answer: string
  sql: string[]
}): void {
  const existing = pendingByDiscussionId.get(args.discussionId)
  if (existing) {
    pendingByDiscussionId.delete(args.discussionId)
    clearTimeout(existing.timeoutId)
    debugLog('store:replaced_existing', { discussion_id: args.discussionId })
  }

  const timeoutId = setTimeout(() => {
    const pending = pendingByDiscussionId.get(args.discussionId)
    if (!pending) return
    pendingByDiscussionId.delete(args.discussionId)
    debugLog('timeout:triggered', {
      discussion_id: args.discussionId,
      sql_count: pending.sql.length,
      sql_previews: sqlPreviews(pending.sql),
    })
    void judgeAndTrain({ discussionId: args.discussionId, pending })
  }, PENDING_TTL_MS)

  pendingByDiscussionId.set(args.discussionId, {
    prompt: args.prompt,
    canonicalPrompt: args.canonicalPrompt,
    answer: args.answer,
    sql: args.sql,
    createdAtMs: Date.now(),
    timeoutId,
  })
  debugLog('store:pending', {
    discussion_id: args.discussionId,
    sql_count: args.sql.length,
    sql_previews: sqlPreviews(args.sql),
  })
}
