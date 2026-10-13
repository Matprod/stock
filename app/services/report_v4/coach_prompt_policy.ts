import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAIN_NOUL_THRESHOLD,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { choice, noul } from '#services/jev_service'
import {
  ASK_FAITHFUL_NOTE,
  finalizePolicy,
  COACH_LOAD_FLAG,
  COACH_REPORT_SHAPE,
  type CoachLoadFlag,
  type CoachPromptPolicy,
  type CoachReportShape,
} from '#services/report_v4/coach_policy_heuristic'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier } from '#services/report_v4/jev_guard'
import { choiceValue, noulScore } from '#utils/jev_answers'
import type { TypeSafeClient } from '#services/jev_service'
import type { AppLanguage } from '#utils/localize'

export type { CoachPromptPolicy }

const POLICY_SHAPE_NOTE = [
  'Infer from intent. Prefer free unless the coach clearly asks for a fixed monitoring structure.',
  'NEGATIVE: "report on my team" (any language) + performance/injury scores (individual lines + team mean/min/max) → free, squad_overview, or individual_focus — NOT monitoring_playbook.',
  'NEGATIVE: scores + mean/minmax graphs alone must NOT unlock a multi-domain monitoring stack.',
  'monitoring_playbook only when the coach asks for a structured multi-domain monitoring brief / watchlist / team→individuals→gaps — not a generic team report.',
].join(' ')

const POLICY_PREFER_NOTE =
  'true only when the coach named this domain or its metrics. NEGATIVE: performance_score / injury_risk_score / team mean-min-max → prefer_scores true; prefer_injury false. Clinical injury log / availability / rehab → prefer_injury true; prefer_scores false unless ML scores also asked. prefer_biomarkers, prefer_wellness, prefer_sleep, prefer_gps false unless also asked. prefer_load only for ACWR / sRPE / load volume asks.'

const isReportShape = (value: string): value is CoachReportShape =>
  (Object.values(COACH_REPORT_SHAPE) as string[]).includes(value)

const isLoadFlag = (value: string): value is CoachLoadFlag =>
  (Object.values(COACH_LOAD_FLAG) as string[]).includes(value)

const buildPolicyQuestions = () => {
  const banQs = Object.fromEntries(
    PREMIUM_DOMAINS.map((domain) => [
      `ban_${domain}`,
      noul(
        `Did the coach explicitly forbid using the ${domain} domain (or say it is absent / not collected / must not be inferred)?`,
        {
          true: `Ban ${domain}`,
          false: `${domain} allowed if populated`,
        }
      ),
    ])
  )
  const preferQs = Object.fromEntries(
    PREMIUM_DOMAINS.map((domain) => [
      `prefer_${domain}`,
      noul(
        `Did the coach explicitly ask to emphasise or include the ${domain} domain? (${POLICY_PREFER_NOTE})`,
        {
          true: `Prioritise ${domain}`,
          false: `No special emphasis on ${domain}`,
        }
      ),
    ])
  )

  return {
    report_shape: choice(
      {
        question: 'Which report shape best matches the coach brief?',
        note: POLICY_SHAPE_NOTE,
      },
      {
        [COACH_REPORT_SHAPE.MONITORING_PLAYBOOK]:
          'Coach asked for a structured multi-domain monitoring brief (team → individuals of interest → gaps) — not a thin scores/charts ask',
        [COACH_REPORT_SHAPE.SQUAD_OVERVIEW]: 'Squad / team overview first, light individual',
        [COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS]:
          'Named athletes or individual deep-dives / per-player score lines are the main ask',
        [COACH_REPORT_SHAPE.FREE]: 'Open staff brief — no fixed section playbook',
      }
    ),
    load_flag: choice(
      {
        question: 'Did the coach specify a load reference method?',
        note: 'Choose none unless the brief names a method. Do not invent a default flag recipe. Score charts alone → none.',
      },
      {
        [COACH_LOAD_FLAG.ACWR_EWMA]: 'Coach asked for EWMA ACWR as load reference',
        [COACH_LOAD_FLAG.COUPLED_7_28]: 'Coach asked for coupled 7:28 ACWR',
        [COACH_LOAD_FLAG.VOLUME_ONLY]:
          'Coach asked for volume / minutes / distance without ratio flags',
        [COACH_LOAD_FLAG.NONE]: 'No load-flag method specified — analyst chooses relevant metrics',
      }
    ),
    wants_vald: noul(
      'Did the coach explicitly ask for physical tests / trials (jump, CMJ, RSI, strength) when available?',
      {
        true: 'Emphasise tests/trials when populated',
        false: 'No special tests/trials ask',
      }
    ),
    wants_match: noul(
      'Did the coach explicitly ask for match / competition stats when available?',
      {
        true: 'Emphasise match when populated',
        false: 'No special match ask',
      }
    ),
    wants_availability: noul(
      'Did the coach explicitly ask for clinical injuries, injury log, availability, rehab, or return-to-play when data exists?',
      {
        true: 'Cover clinical injuries / availability / rehab when data exists',
        false: 'No special clinical injury / availability ask',
      }
    ),
    allow_wellness_inference: noul(
      'May the report infer fatigue/sleep/internal load from GPS or other proxies when wellness/sleep are absent?',
      {
        true: 'Inference allowed carefully',
        false: 'Do not infer wellness/sleep/internal load from GPS alone',
      }
    ),
    flags_descriptive_only: noul(
      'Must attention signals stay descriptive (worth a look / review) with no injury prediction or diagnosis?',
      {
        true: 'Descriptive signals only',
        false: 'Broader analytical language allowed (still no invented injury scores)',
      }
    ),
    allow_nutrition_scope: noul(
      'Did the coach explicitly ask about nutrition, macros, hydration, caffeine, or meal composition?',
      {
        true: 'Nutrition/hydration scope allowed',
        false: 'No nutrition ask',
      }
    ),
    ...banQs,
    ...preferQs,
  }
}

const jevPlaybookReason = (
  reportShape: CoachReportShape,
  preferredDomains: PremiumDomain[]
): string => {
  if (reportShape === COACH_REPORT_SHAPE.MONITORING_PLAYBOOK) {
    return `jev_shape=${reportShape}`
  }
  if (preferredDomains.length) {
    return `jev_ask_domains=${preferredDomains.join(',')};shape=${reportShape}`
  }
  return `jev_shape=${reportShape};not_playbook`
}

const policyFromJevAnswers = (
  answers: Record<string, unknown>,
  confidence?: number
): CoachPromptPolicy => {
  const excludedDomains = PREMIUM_DOMAINS.filter(
    (domain) => noulScore(answers, `ban_${domain}`) >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  )
  const preferredDomains = PREMIUM_DOMAINS.filter(
    (domain) => noulScore(answers, `prefer_${domain}`) >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  )

  const shapeRaw = choiceValue(answers, 'report_shape')
  let reportShape = shapeRaw && isReportShape(shapeRaw) ? shapeRaw : COACH_REPORT_SHAPE.FREE

  const scoresOnlyPrefer =
    preferredDomains.includes(PREMIUM_DOMAIN.SCORES) &&
    preferredDomains.every(
      (domain) => domain === PREMIUM_DOMAIN.SCORES || domain === PREMIUM_DOMAIN.LOAD
    )
  if (reportShape === COACH_REPORT_SHAPE.MONITORING_PLAYBOOK && scoresOnlyPrefer) {
    reportShape =
      preferredDomains.length === 1 ? COACH_REPORT_SHAPE.FREE : COACH_REPORT_SHAPE.SQUAD_OVERVIEW
  }

  const loadRaw = choiceValue(answers, 'load_flag')
  const loadFlag = loadRaw && isLoadFlag(loadRaw) ? loadRaw : COACH_LOAD_FLAG.NONE

  const bannedWellnessOrSleep =
    excludedDomains.includes(PREMIUM_DOMAIN.WELLNESS) ||
    excludedDomains.includes(PREMIUM_DOMAIN.SLEEP)
  const allowWellnessInference =
    !bannedWellnessOrSleep &&
    noulScore(answers, 'allow_wellness_inference') >= PREMIUM_DOMAIN_NOUL_THRESHOLD

  return finalizePolicy({
    excludedDomains,
    preferredDomains,
    reportShape,
    loadFlag,
    wantsVald: noulScore(answers, 'wants_vald') >= PREMIUM_DOMAIN_NOUL_THRESHOLD,
    wantsMatch: noulScore(answers, 'wants_match') >= PREMIUM_DOMAIN_NOUL_THRESHOLD,
    wantsAvailability: noulScore(answers, 'wants_availability') >= PREMIUM_DOMAIN_NOUL_THRESHOLD,
    allowWellnessInference,
    allowNutritionScope:
      noulScore(answers, 'allow_nutrition_scope') >= PREMIUM_DOMAIN_NOUL_THRESHOLD,
    flagsAreDescriptiveOnly:
      noulScore(answers, 'flags_descriptive_only') >= PREMIUM_DOMAIN_NOUL_THRESHOLD ||
      reportShape === COACH_REPORT_SHAPE.MONITORING_PLAYBOOK,
    provider: 'jev',
    confidence,
    monitoringPlaybookReason: jevPlaybookReason(reportShape, preferredDomains),
  })
}

const POLICY_HAIKU_SYSTEM = [
  'Extract coach report policy constraints as JSON.',
  'Keys: report_shape (free|monitoring_playbook|squad_overview|individual_focus),',
  'load_flag (acwr_ewma|coupled_7_28|volume_only|none),',
  'wants_vald, wants_match, wants_availability, allow_wellness_inference, flags_descriptive_only, allow_nutrition_scope (booleans),',
  `ban_<domain> and prefer_<domain> booleans for: ${PREMIUM_DOMAINS.join(', ')}.`,
  ASK_FAITHFUL_NOTE,
].join(' ')

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= PREMIUM_DOMAIN_NOUL_THRESHOLD
  return false
}

const policyFromHaikuJson = (raw: Record<string, unknown>): CoachPromptPolicy => {
  const answers: Record<string, unknown> = {
    report_shape: { choice: typeof raw.report_shape === 'string' ? raw.report_shape : 'free' },
    load_flag: { choice: typeof raw.load_flag === 'string' ? raw.load_flag : 'none' },
    wants_vald: { noul: boolFromUnknown(raw.wants_vald) ? 1 : 0 },
    wants_match: { noul: boolFromUnknown(raw.wants_match) ? 1 : 0 },
    wants_availability: { noul: boolFromUnknown(raw.wants_availability) ? 1 : 0 },
    allow_wellness_inference: { noul: boolFromUnknown(raw.allow_wellness_inference) ? 1 : 0 },
    flags_descriptive_only: { noul: boolFromUnknown(raw.flags_descriptive_only) ? 1 : 0 },
    allow_nutrition_scope: { noul: boolFromUnknown(raw.allow_nutrition_scope) ? 1 : 0 },
  }
  for (const domain of PREMIUM_DOMAINS) {
    answers[`ban_${domain}`] = { noul: boolFromUnknown(raw[`ban_${domain}`]) ? 1 : 0 }
    answers[`prefer_${domain}`] = { noul: boolFromUnknown(raw[`prefer_${domain}`]) ? 1 : 0 }
  }
  const policy = policyFromJevAnswers(answers)
  return { ...policy, provider: 'haiku' }
}

const routePolicyWithJev = async (
  client: TypeSafeClient,
  prompt: string
): Promise<CoachPromptPolicy> => {
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      coach_prompt: prompt.slice(0, 3500),
      domains: PREMIUM_DOMAINS.join(','),
      note: [
        'Extract hard constraints and report shape from the coach brief.',
        'Prefer bans only when the coach is explicit.',
        ASK_FAITHFUL_NOTE,
        'NEGATIVE EXAMPLE: team report + performance/injury score charts (individual + team mean/min/max) → prefer_scores only; report_shape free/squad_overview/individual_focus; NOT monitoring_playbook; no biomarkers/wellness/sleep/gps.',
      ].join(' '),
    },
    questions: buildPolicyQuestions(),
  })

  const confidences = Object.values(response.answers)
    .map((a) => (a as { confidence?: number }).confidence)
    .filter((c): c is number => typeof c === 'number')
  const confidence =
    confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : undefined

  return policyFromJevAnswers(response.answers, confidence)
}

const routePolicyWithHaiku = async (prompt: string): Promise<CoachPromptPolicy> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: POLICY_HAIKU_SYSTEM,
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return policyFromHaikuJson(raw)
}

export const resolveCoachPromptPolicy = async (
  prompt: string,
  language?: AppLanguage
): Promise<CoachPromptPolicy> => {
  const { value: policy, provider } = await runIntentClassifier({
    context: 'coach_policy',
    language,
    jev: (client) => routePolicyWithJev(client, prompt),
    haiku: () => routePolicyWithHaiku(prompt),
  })
  return { ...policy, provider }
}

export const applyDomainExclusions = (
  domains: PremiumDomain[],
  excluded: PremiumDomain[]
): PremiumDomain[] => {
  if (!excluded.length) return domains
  const ban = new Set(excluded)
  return domains.filter((d) => !ban.has(d))
}

export const applyDomainPreferences = (
  domains: PremiumDomain[],
  preferred: PremiumDomain[]
): PremiumDomain[] => {
  if (!preferred.length) return domains
  const prefer = new Set(preferred)
  const head = domains.filter((d) => prefer.has(d))
  const tail = domains.filter((d) => !prefer.has(d))
  return [...head, ...tail]
}

export const monitoringStructureHint = (policy: CoachPromptPolicy): string => {
  if (!policy.monitoringPlaybook && policy.sectionOrder.length === 0) return ''

  if (policy.sectionOrder.length > 0) {
    const lines = policy.sectionOrder.map((title, i) => `${i + 1}. ${title}`).join('\n')
    return `
## Canvas structure (coach-specified — honour this order)
${lines}

${policy.flagsAreDescriptiveOnly ? 'Descriptive signals only: "worth a look" / review — never injury prediction / diagnosis.' : 'Do not invent Injury Risk Scores.'}
Empty optional sections: one factual line — no padding, no invented data.
${!policy.allowWellnessInference ? 'Do NOT infer fatigue/sleep/internal load from GPS alone.' : ''}
`.trim()
  }

  if (!policy.monitoringPlaybook) return ''

  return `
## Structure principles (conditional — monitoring playbook on)
Build a clear hierarchy that fits THIS ask. No canned Headline / Watchlist / Load×GPS template.
FORBIDDEN: invent a "coverage gaps / unavailable" closing section when Linker datasets for those domains have rows.
${policy.flagsAreDescriptiveOnly ? 'Descriptive signals only: "worth a look" / review — never injury prediction / diagnosis.' : 'Do not invent Injury Risk Scores.'}
${!policy.allowWellnessInference ? 'Do NOT infer fatigue/sleep/internal load from GPS alone.' : ''}
`.trim()
}
