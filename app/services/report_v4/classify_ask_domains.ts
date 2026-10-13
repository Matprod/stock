import {
  PREMIUM_DOMAIN_NOUL_THRESHOLD,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier, type IntentProvider } from '#services/report_v4/jev_guard'
import { noulScore } from '#utils/jev_answers'
import type { AppLanguage } from '#utils/localize'
import { ASK_FAITHFUL_NOTE } from '#services/report_v4/coach_policy_heuristic'

const HAIKU_SYSTEM = [
  'Classify which premium report domains a coach ask names.',
  'Respond ONLY with valid JSON booleans for each domain key:',
  `{"${PREMIUM_DOMAINS.join('":false,"')}":false}`,
  'true only when the coach named that domain or its metrics.',
  ASK_FAITHFUL_NOTE,
].join(' ')

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  return false
}

export const askDomainsFromHaikuJson = (raw: Record<string, unknown>): PremiumDomain[] =>
  PREMIUM_DOMAINS.filter((domain) => boolFromUnknown(raw[domain]))

const classifyWithJev = async (
  client: TypeSafeClient,
  prompt: string
): Promise<PremiumDomain[]> => {
  const preferQs = Object.fromEntries(
    PREMIUM_DOMAINS.map((domain) => [
      `prefer_${domain}`,
      noul(
        `Did the coach explicitly ask to include the ${domain} domain or its metrics?`,
        {
          true: `Include ${domain}`,
          false: `Do not include ${domain} from this ask alone`,
        }
      ),
    ])
  )

  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      coach_prompt: prompt.slice(0, 3500),
      domains: PREMIUM_DOMAINS.join(','),
      note: ASK_FAITHFUL_NOTE,
    },
    questions: preferQs,
  })

  const answers = response.answers as Record<string, unknown>
  return PREMIUM_DOMAINS.filter(
    (domain) => noulScore(answers, `prefer_${domain}`) >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  )
}

const classifyWithHaiku = async (prompt: string): Promise<PremiumDomain[]> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: HAIKU_SYSTEM,
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return askDomainsFromHaikuJson(raw)
}

export const classifyAskDomains = async (args: {
  prompt: string
  language?: AppLanguage
}): Promise<{ domains: PremiumDomain[]; provider: IntentProvider }> => {
  const { value, provider } = await runIntentClassifier({
    context: 'ask_domains',
    language: args.language,
    jev: (client) => classifyWithJev(client, args.prompt),
    haiku: () => classifyWithHaiku(args.prompt),
  })
  
  return { domains: value, provider }
}
