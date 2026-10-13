import type { PremiumDomain } from '#constants/premium_report_domains'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import type { AppLanguage } from '#utils/localize'

export type SoftClarifyQuestion = {
  id: string
  question: string
}

export type SoftClarifyResult = {
  needsClarify: boolean
  confidence: number
  reason: string
  questions: SoftClarifyQuestion[]
  markdown: string
}

export type FreshClarifyResult = SoftClarifyResult & {
  skipped: boolean
  skipReason: string
}

const COPY = {
  fr: {
    softIntro: 'Avant de modifier le rapport, j’ai besoin d’une précision :',
    softTargetMany: (titles: string[]) =>
      `Plusieurs graphiques / sections possibles (${titles.join(', ')}). Indiquez lequel viser.`,
    softTargetNone:
      'Je ne sais pas quel graphique ou quelle section modifier. Précisez le titre exact.',
    softVague: 'Le changement demandé n’est pas assez précis. Décrivez concrètement quoi faire.',
    softAsk: 'Répondez en une phrase dans le champ ci-dessous.',
    freshIntro: 'Avant de générer, quelques points sont flous :',
    freshPeriod: 'La période / les dates ne sont pas précisées.',
    freshDomains: 'Les données à utiliser ne sont pas claires (charge, scores, blessures, GPS…).',
    freshAsk: 'Précisez à l’écrit ce que vous voulez — une phrase suffit.',
  },
  en: {
    softIntro: 'Before editing the report, I need a quick clarification:',
    softTargetMany: (titles: string[]) =>
      `Several charts / sections could match (${titles.join(', ')}). Say which one.`,
    softTargetNone:
      'I am not sure which chart or section to edit. Give the exact title.',
    softVague: 'The requested change is too vague. Describe concretely what to do.',
    softAsk: 'Reply in one sentence in the field below.',
    freshIntro: 'Before generating, a few points are unclear:',
    freshPeriod: 'The period / dates are not specified.',
    freshDomains: 'Which data to use is unclear (load, scores, injuries, GPS…).',
    freshAsk: 'Clarify in writing what you want — one sentence is enough.',
  },
} as const

export const hasConcreteSoftSignal = (args: {
  envelope: ArtifactEnvelope
  softOps?: SoftEditOpsPlan | null
}): boolean => {
  if (args.envelope.contracts.vizOps.length > 0) return true
  if (args.envelope.contracts.designOps.length > 0) return true
  if (args.envelope.mode === 'soft_ops' || args.envelope.mode === 'gated_rebuild') return true
  const softOps = args.softOps
  if (!softOps) return false
  return (
    softOps.ops.length > 0 ||
    softOps.ensureToc ||
    softOps.wantsTeamMean ||
    softOps.enrichExistingCharts ||
    softOps.restoreSheets ||
    softOps.addSectionProse ||
    softOps.layoutRepair ||
    softOps.hasDataOps
  )
}

export const scoreSoftIntentConfidence = (args: {
  envelope: ArtifactEnvelope
  softTargetsUnresolved: boolean
  candidateTitles: string[]
  softOps?: SoftEditOpsPlan | null
}): number => {
  const concrete = hasConcreteSoftSignal({
    envelope: args.envelope,
    softOps: args.softOps,
  })
  let score = 0.55
  if (args.envelope.mode === 'soft_ops') score += 0.25
  if (args.envelope.mode === 'gated_rebuild') score += 0.15
  if (args.envelope.contracts.designOps.length > 0) score += 0.1
  if (args.envelope.contracts.vizOps.length > 0) score += 0.1
  if (concrete) score += 0.15
  if (!concrete) score -= 0.35
  if (args.softTargetsUnresolved) score -= 0.4
  if (args.candidateTitles.length > 3 && args.softTargetsUnresolved) score -= 0.1
  return Math.max(0, Math.min(1, Number(score.toFixed(2))))
}

export const resolveSoftClarify = (args: {
  prompt: string
  envelope: ArtifactEnvelope
  preserveCanvas: boolean
  softTargetsUnresolved: boolean
  candidateTitles?: string[]
  softOps?: SoftEditOpsPlan | null
  language?: AppLanguage
}): SoftClarifyResult => {
  if (!args.preserveCanvas) {
    return {
      needsClarify: false,
      confidence: 1,
      reason: 'fresh_report',
      questions: [],
      markdown: '',
    }
  }
  const lang = args.language === 'en' ? 'en' : 'fr'
  const copy = COPY[lang]
  const candidates = (args.candidateTitles ?? []).filter((t) => t.trim().length > 0).slice(0, 6)
  const concrete = hasConcreteSoftSignal({
    envelope: args.envelope,
    softOps: args.softOps,
  })
  const confidence = scoreSoftIntentConfidence({
    envelope: args.envelope,
    softTargetsUnresolved: args.softTargetsUnresolved,
    candidateTitles: candidates,
    softOps: args.softOps,
  })

  const bullets: string[] = []
  const questions: SoftClarifyQuestion[] = []
  let reason = 'ok'

  if (args.softTargetsUnresolved) {
    reason = 'soft_targets_unresolved'
    const line =
      candidates.length > 0 ? copy.softTargetMany(candidates) : copy.softTargetNone
    bullets.push(line)
    questions.push({ id: 'target', question: line })
  }

  if (!concrete) {
    reason = reason === 'ok' ? 'vague_soft_intent' : reason
    bullets.push(copy.softVague)
    questions.push({ id: 'intent', question: copy.softVague })
  }

  const needsClarify = bullets.length > 0 && confidence < 0.62
  const markdown = needsClarify
    ? [copy.softIntro, ...bullets.map((b) => `• ${b}`), copy.softAsk].join('\n')
    : ''

  return {
    needsClarify,
    confidence,
    reason,
    questions: needsClarify ? questions.slice(0, 3) : [],
    markdown,
  }
}

export const resolveFreshClarify = (args: {
  language?: AppLanguage
  preserveCanvas: boolean
  askRound: number
  explicitPeriod: boolean
  askDomains: PremiumDomain[]
  preferredDomains: PremiumDomain[]
}): FreshClarifyResult => {
  if (args.preserveCanvas) {
    return {
      needsClarify: false,
      confidence: 1,
      reason: 'soft_path',
      questions: [],
      markdown: '',
      skipped: true,
      skipReason: 'soft_path',
    }
  }
  if (args.askRound >= 1) {
    return {
      needsClarify: false,
      confidence: 1,
      reason: 'ask_round_exhausted',
      questions: [],
      markdown: '',
      skipped: true,
      skipReason: 'ask_round_exhausted',
    }
  }

  const lang = args.language === 'en' ? 'en' : 'fr'
  const copy = COPY[lang]
  const hasDomains = args.askDomains.length > 0 || args.preferredDomains.length > 0
  const bullets: string[] = []
  const reasons: string[] = []
  const questions: SoftClarifyQuestion[] = []

  if (!args.explicitPeriod) {
    reasons.push('period_unclear')
    bullets.push(copy.freshPeriod)
    questions.push({ id: 'period', question: copy.freshPeriod })
  }
  if (!hasDomains) {
    reasons.push('domains_unclear')
    bullets.push(copy.freshDomains)
    questions.push({ id: 'domains', question: copy.freshDomains })
  }

  if (bullets.length === 0) {
    return {
      needsClarify: false,
      confidence: 1,
      reason: 'prompt_clear_enough',
      questions: [],
      markdown: '',
      skipped: true,
      skipReason: 'prompt_clear_enough',
    }
  }

  const reason = reasons.join('+')
  const markdown = [copy.freshIntro, ...bullets.map((b) => `• ${b}`), copy.freshAsk].join('\n')

  return {
    needsClarify: true,
    confidence: 0,
    reason,
    questions: questions.slice(0, 3),
    markdown,
    skipped: false,
    skipReason: 'ok',
  }
}
