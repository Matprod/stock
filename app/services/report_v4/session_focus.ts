import { PREMIUM_DOMAINS, type PremiumDomain } from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import type { PremiumReportHistoryTurn } from '#contracts/premium_report'
import { noul, type TypeSafeClient } from '#services/jev_service'
import type { PromptFetchSpec } from '#services/report_v4/prompt_scope'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier, type IntentProvider } from '#services/report_v4/jev_guard'
import { noulScore } from '#utils/jev_answers'
import type { AppLanguage } from '#utils/localize'

export type ReportV4SessionFocus = {
  lastPrompt: string
  domains: PremiumDomain[]
  fetches: Array<{ domain: PremiumDomain; from: string; to: string; label?: string }>
  displayRange: { from: string; to: string }
  askRound?: number
  pendingAskIds?: string[]
}

const DOMAIN_SET = new Set<string>(PREMIUM_DOMAINS)

const isPremiumDomain = (value: string): value is PremiumDomain => DOMAIN_SET.has(value)

export const normalizeSessionFocus = (raw: unknown): ReportV4SessionFocus | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const lastPrompt = typeof row.lastPrompt === 'string' ? row.lastPrompt.trim() : ''
  const display = row.displayRange
  if (!display || typeof display !== 'object' || Array.isArray(display)) return null
  const from = typeof (display as { from?: unknown }).from === 'string'
    ? String((display as { from: string }).from)
    : ''
  const to = typeof (display as { to?: unknown }).to === 'string'
    ? String((display as { to: string }).to)
    : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null

  const domains = Array.isArray(row.domains)
    ? row.domains.filter((d): d is PremiumDomain => typeof d === 'string' && isPremiumDomain(d))
    : []
  const fetches: ReportV4SessionFocus['fetches'] = []
  if (Array.isArray(row.fetches)) {
    for (const entry of row.fetches) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      const f = entry as Record<string, unknown>
      const domain = typeof f.domain === 'string' && isPremiumDomain(f.domain) ? f.domain : null
      const fFrom = typeof f.from === 'string' ? f.from : ''
      const fTo = typeof f.to === 'string' ? f.to : ''
      if (!domain || !/^\d{4}-\d{2}-\d{2}$/.test(fFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(fTo)) {
        continue
      }
      const label = typeof f.label === 'string' && f.label.trim() ? f.label.trim() : undefined
      fetches.push({ domain, from: fFrom, to: fTo, ...(label ? { label } : {}) })
    }
  }
  const askRoundRaw = typeof row.askRound === 'number' ? Math.floor(row.askRound) : 0
  const askRound = askRoundRaw > 0 ? Math.min(askRoundRaw, 1) : 0
  const pendingAskIds = Array.isArray(row.pendingAskIds)
    ? row.pendingAskIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim().slice(0, 64))
        .slice(0, 8)
    : []
  if (!domains.length && !fetches.length && askRound < 1) return null
  const resolvedDomains =
    domains.length > 0 ? domains : [...new Set(fetches.map((f) => f.domain))]
  return {
    lastPrompt: lastPrompt.slice(0, 500),
    domains: resolvedDomains,
    fetches,
    displayRange: { from, to },
    ...(askRound > 0 ? { askRound } : {}),
    ...(pendingAskIds.length ? { pendingAskIds } : {}),
  }
}

export const buildSessionFocus = (args: {
  prompt: string
  domains: PremiumDomain[]
  fetches: PromptFetchSpec[]
  displayRange: { from: string; to: string }
  askRound?: number
  pendingAskIds?: string[]
}): ReportV4SessionFocus => {
  const domains =
    args.domains.length > 0
      ? [...new Set(args.domains)]
      : [...new Set(args.fetches.map((row) => row.domain))]
  const askRound = args.askRound && args.askRound > 0 ? Math.min(Math.floor(args.askRound), 1) : 0
  const pendingAskIds = (args.pendingAskIds ?? [])
    .filter((id) => id.trim().length > 0)
    .map((id) => id.trim().slice(0, 64))
    .slice(0, 8)
  return {
    lastPrompt: args.prompt.trim().slice(0, 500),
    domains,
    fetches: args.fetches.map((row) => ({
      domain: row.domain,
      from: row.from,
      to: row.to,
      ...(row.label ? { label: row.label } : {}),
    })),
    displayRange: { from: args.displayRange.from, to: args.displayRange.to },
    ...(askRound > 0 ? { askRound } : {}),
    ...(pendingAskIds.length ? { pendingAskIds } : {}),
  }
}

export const withAskRound = (
  focus: ReportV4SessionFocus | null | undefined,
  args: {
    prompt: string
    displayRange: { from: string; to: string }
    domains?: PremiumDomain[]
    questionIds: string[]
  }
): ReportV4SessionFocus => {
  const base = focus
    ? {
        ...focus,
        lastPrompt: args.prompt.trim().slice(0, 500),
        displayRange: { from: args.displayRange.from, to: args.displayRange.to },
        ...(args.domains?.length ? { domains: [...new Set(args.domains)] } : {}),
      }
    : buildSessionFocus({
        prompt: args.prompt,
        domains: args.domains ?? [],
        fetches: [],
        displayRange: args.displayRange,
      })
  return {
    ...base,
    askRound: 1,
    pendingAskIds: args.questionIds.slice(0, 8),
  }
}

export const priorUserAsks = (
  history: PremiumReportHistoryTurn[] | undefined,
  limit = 2
): string[] => {
  if (!history?.length) return []
  const asks: string[] = []
  for (let i = history.length - 1; i >= 0 && asks.length < limit; i -= 1) {
    const turn = history[i]
    if (turn?.role !== 'user') continue
    const content = turn.content.trim()
    if (!content) continue
    asks.unshift(content.slice(0, 400))
  }
  return asks
}

const NOUL_TRUE = 0.55

export const classifyPeriodStatusFollowUp = async (args: {
  prompt: string
  language?: AppLanguage
}): Promise<{ periodFollowUp: boolean; provider: IntentProvider }> => {
  const { value, provider } = await runIntentClassifier({
    context: 'period_status_follow_up',
    language: args.language,
    jev: async (client: TypeSafeClient) => {
      const response = await client.systemOne({
        model: JEV_ROUTER_MODEL,
        state: { prompt: args.prompt.slice(0, 3500) },
        questions: {
          period_or_status: noul(
            'Is this a period/status follow-up (last season/week/month, today/active status) on prior focus?',
            {
              true: 'Period or status follow-up',
              false: 'Not a period/status follow-up',
            }
          ),
        },
      })
      return noulScore(response.answers as Record<string, unknown>, 'period_or_status') >= NOUL_TRUE
    },
    haiku: async () => {
      const raw = await invokeHaikuJson<{ period_or_status?: boolean }>({
        system:
          'Respond ONLY with JSON {"period_or_status":true|false}. true if coach asks about last/prior/this season|week|month or today/active status follow-up.',
        user: `Coach ask:\n${args.prompt.slice(0, 3500)}`,
      })
      return Boolean(raw.period_or_status)
    },
  })
  
  return { periodFollowUp: value, provider }
}

export const formatSessionFocusBrief = (focus: ReportV4SessionFocus | null | undefined): string => {
  if (!focus) return ''
  const domains = focus.domains.join(',') || 'none'
  const fetches =
    focus.fetches.length > 0
      ? focus.fetches
          .map((row) => `${row.domain}:${row.from}→${row.to}${row.label ? `(${row.label})` : ''}`)
          .join('; ')
      : 'none'
  return [
    'Prior session focus (reuse domains for period-only follow-ups unless the coach names other domains):',
    `lastPrompt: ${focus.lastPrompt || '(none)'}`,
    `domains: ${domains}`,
    `fetches: ${fetches}`,
    `displayRange: ${focus.displayRange.from}→${focus.displayRange.to}`,
  ].join('\n')
}

export const clampFetchesToSessionFocus = (
  fetches: PromptFetchSpec[],
  focus: ReportV4SessionFocus | null | undefined,
  askDomains: PremiumDomain[],
  periodFollowUp: boolean
): PromptFetchSpec[] => {
  if (!focus?.domains.length) return fetches
  if (askDomains.length > 0) return fetches
  const allow = new Set(focus.domains)
  const kept = fetches.filter((row) => allow.has(row.domain))
  if (kept.length > 0 && (periodFollowUp || kept.length < fetches.length)) {
    return kept
  }
  if (fetches.length === 0 && focus.fetches.length > 0 && periodFollowUp) {
    return focus.fetches.map((row) => ({
      domain: row.domain,
      from: row.from,
      to: row.to,
      ...(row.label ? { label: row.label } : {}),
    }))
  }
  return fetches
}
