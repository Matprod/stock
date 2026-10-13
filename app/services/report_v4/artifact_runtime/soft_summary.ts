import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'

export type SoftFollowUp = {
  title: string
  question: string
}

export type SoftRunSummary = {
  markdown: string
  followUps: SoftFollowUp[]
}

export const buildSoftRunSummary = (args: {
  envelope: ArtifactEnvelope
  softApplied: string[]
  softBlocked: string[]
  coverage?: { delivered: number; required: number; missing: string[]; ok: boolean } | null
  acwrStatus?: 'ok' | 'pending' | 'empty_declared' | null
  clarified?: boolean
  pathCostClass?: string
}): SoftRunSummary => {
  const bullets: string[] = []
  bullets.push(`Mode: ${args.envelope.mode.replace(/_/g, ' ')}.`)
  if (args.pathCostClass) {
    bullets.push(`Path cost: ${args.pathCostClass}.`)
  }
  if (args.envelope.contracts.vizOps.length) {
    bullets.push(
      `Viz ops: ${args.envelope.contracts.vizOps.map((op) => op.kind).join(', ')}.`
    )
  }
  if (args.envelope.contracts.designOps.length) {
    bullets.push(
      `Design ops: ${args.envelope.contracts.designOps.map((op) => op.kind).join(', ')}.`
    )
  }
  if (args.softApplied.length) {
    bullets.push(`Applied: ${args.softApplied.join(', ')}.`)
  } else {
    bullets.push('Applied: none.')
  }
  if (args.softBlocked.length) {
    bullets.push(`Blocked: ${args.softBlocked.join(', ')}.`)
  }
  if (args.coverage && args.coverage.required > 0) {
    bullets.push(
      `Coverage: ${args.coverage.delivered}/${args.coverage.required} players${
        args.coverage.missing.length
          ? ` (missing ${args.coverage.missing.slice(0, 5).join(', ')})`
          : ''
      }.`
    )
  }
  if (args.acwrStatus === 'empty_declared') {
    bullets.push('ACWR unavailable after load harvest (empty declared).')
  } else if (args.acwrStatus === 'pending') {
    bullets.push('ACWR harvest still pending.')
  }
  if (args.clarified) {
    bullets.push('Run waited on clarification.')
  }

  const followUps: SoftFollowUp[] = []
  if (args.softBlocked.includes('zero_mutations')) {
    followUps.push({
      title: 'Be specific',
      question: 'Name the chart title and the exact change (thresholds, drop empty days, remove section).',
    })
  }
  if (args.acwrStatus === 'empty_declared') {
    followUps.push({
      title: 'Pivot domains',
      question: 'Show scores and wellness for the same window instead of ACWR?',
    })
  }
  if (args.coverage && args.coverage.delivered < args.coverage.required) {
    followUps.push({
      title: 'Finish coverage',
      question: 'Continue individual sheets for the missing players only?',
    })
  }
  if (!followUps.length && args.envelope.mode === 'soft_ops') {
    followUps.push({
      title: 'Another soft tweak',
      question: 'Drop empty days or strengthen titles next?',
    })
  }

  return {
    markdown: bullets.map((line) => `• ${line}`).join('\n'),
    followUps: followUps.slice(0, 3),
  }
}
