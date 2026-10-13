import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'

export type SoftClarifyQuestion = {
  id: string
  question: string
  choices?: string[]
}

export type SoftClarifyResult = {
  needsClarify: boolean
  confidence: number
  reason: string
  questions: SoftClarifyQuestion[]
  markdown: string
}

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
  const candidates = (args.candidateTitles ?? []).filter((t) => t.trim().length > 0).slice(0, 8)
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
  const questions: SoftClarifyQuestion[] = []
  let reason = 'ok'

  if (args.softTargetsUnresolved && candidates.length > 0) {
    reason = 'soft_targets_unresolved'
    questions.push({
      id: 'target_block',
      question: 'Which chart or section should I edit?',
      choices: candidates,
    })
  } else if (args.softTargetsUnresolved) {
    reason = 'soft_targets_unresolved'
    questions.push({
      id: 'target_hint',
      question: 'Name the chart or section title to edit (exact words from the report).',
    })
  }

  if (!concrete) {
    reason = reason === 'ok' ? 'vague_soft_intent' : reason
    questions.push({
      id: 'soft_intent',
      question: 'What should change?',
      choices: [
        'Add ACWR thresholds 0.6 / 1.3',
        'Drop empty days on load curves',
        'Remove color scale (visualMap)',
        'Make titles stronger',
        'Rebuild the chart',
      ],
    })
  }

  const needsClarify = questions.length > 0 && confidence < 0.62
  const markdown = needsClarify
    ? [
        'I need a quick clarification before changing the report:',
        ...questions.map((q, i) => {
          const choices =
            q.choices && q.choices.length
              ? `\n   - ${q.choices.slice(0, 6).join('\n   - ')}`
              : ''
          return `${i + 1}. ${q.question}${choices}`
        }),
      ].join('\n')
    : ''

  return {
    needsClarify,
    confidence,
    reason,
    questions,
    markdown,
  }
}
