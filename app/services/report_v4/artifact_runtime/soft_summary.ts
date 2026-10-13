import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import type { AskContractReport } from '#services/report_v4/ask_contract'
import {
  proposeRebuildFollowUp,
  type SoftEditPath,
  type SoftRefusal,
} from '#services/report_v4/soft_refusal'

export type SoftFollowUp = {
  title: string
  question: string
}

export type SoftRunSummary = {
  markdown: string
  followUps: SoftFollowUp[]
  editPath?: SoftEditPath
  refusals?: SoftRefusal[]
}

export const buildSoftRunSummary = (args: {
  envelope: ArtifactEnvelope
  softApplied: string[]
  softBlocked: string[]
  coverage?: { delivered: number; required: number; missing: string[]; ok: boolean } | null
  acwrStatus?: 'ok' | 'pending' | 'empty_declared' | null
  clarified?: boolean
  pathCostClass?: string
  language?: 'fr' | 'en'
  askContract?: AskContractReport | null
  editPath?: SoftEditPath
  refusals?: SoftRefusal[]
}): SoftRunSummary => {
  const fr = args.language !== 'en'
  const bullets: string[] = []
  if (args.editPath) {
    const pathLabelsFr: Record<SoftEditPath, string> = {
      local: 'Chemin : édition locale.',
      local_refused: 'Chemin : édition locale refusée (rapport précédent conservé).',
      unchanged: 'Chemin : aucun changement.',
      template_recovered: 'Chemin : modèle de secours.',
      full_rebuild: 'Chemin : rapport refait entièrement.',
    }
    const pathLabelsEn: Record<SoftEditPath, string> = {
      local: 'Path: local edit.',
      local_refused: 'Path: local edit refused (previous report kept).',
      unchanged: 'Path: unchanged.',
      template_recovered: 'Path: fallback template.',
      full_rebuild: 'Path: full rebuild.',
    }
    bullets.push(fr ? pathLabelsFr[args.editPath] : pathLabelsEn[args.editPath])
  }
  if (args.askContract) {
    bullets.push(args.askContract.message)
  }
  if (args.refusals?.length) {
    bullets.push(
      fr
        ? `Refus : ${args.refusals.map((row) => `${row.code}${row.blockIds.length ? ` [${row.blockIds.slice(0, 4).join(', ')}]` : ''}`).join(' · ')}.`
        : `Refusals: ${args.refusals.map((row) => `${row.code}${row.blockIds.length ? ` [${row.blockIds.slice(0, 4).join(', ')}]` : ''}`).join(' · ')}.`
    )
  }
  bullets.push(
    fr
      ? `Mode : ${args.envelope.mode.replace(/_/g, ' ')}.`
      : `Mode: ${args.envelope.mode.replace(/_/g, ' ')}.`
  )
  if (args.pathCostClass) {
    bullets.push(fr ? `Coût du chemin : ${args.pathCostClass}.` : `Path cost: ${args.pathCostClass}.`)
  }
  if (args.envelope.contracts.vizOps.length) {
    bullets.push(
      fr
        ? `Opérations graphiques : ${args.envelope.contracts.vizOps.map((op) => op.kind).join(', ')}.`
        : `Viz ops: ${args.envelope.contracts.vizOps.map((op) => op.kind).join(', ')}.`
    )
  }
  if (args.envelope.contracts.designOps.length) {
    bullets.push(
      fr
        ? `Opérations de mise en page : ${args.envelope.contracts.designOps.map((op) => op.kind).join(', ')}.`
        : `Design ops: ${args.envelope.contracts.designOps.map((op) => op.kind).join(', ')}.`
    )
  }
  if (args.softApplied.length) {
    bullets.push(
      fr
        ? `Appliqué : ${args.softApplied.join(', ')}.`
        : `Applied: ${args.softApplied.join(', ')}.`
    )
  } else {
    bullets.push(fr ? 'Appliqué : rien.' : 'Applied: none.')
  }
  if (args.softBlocked.length) {
    bullets.push(
      fr
        ? `Non appliqué : ${args.softBlocked.join(', ')}.`
        : `Blocked: ${args.softBlocked.join(', ')}.`
    )
  }
  if (args.coverage && args.coverage.required > 0) {
    bullets.push(
      fr
        ? `Couverture : ${args.coverage.delivered}/${args.coverage.required} joueurs${
            args.coverage.missing.length
              ? ` (manquants ${args.coverage.missing.slice(0, 5).join(', ')})`
              : ''
          }.`
        : `Coverage: ${args.coverage.delivered}/${args.coverage.required} players${
            args.coverage.missing.length
              ? ` (missing ${args.coverage.missing.slice(0, 5).join(', ')})`
              : ''
          }.`
    )
  }
  if (args.acwrStatus === 'empty_declared') {
    bullets.push(
      fr
        ? 'ACWR indisponible après la collecte de charge.'
        : 'ACWR unavailable after load harvest (empty declared).'
    )
  } else if (args.acwrStatus === 'pending') {
    bullets.push(fr ? 'Collecte ACWR encore en cours.' : 'ACWR harvest still pending.')
  }
  if (args.clarified) {
    bullets.push(fr ? 'Une clarification a été demandée.' : 'Run waited on clarification.')
  }

  const followUps: SoftFollowUp[] = []
  if (args.softBlocked.includes('zero_mutations')) {
    followUps.push({
      title: fr ? 'Préciser la demande' : 'Be specific',
      question: fr
        ? 'Indiquez le titre du graphique et le changement exact (seuils, jours vides, section à retirer).'
        : 'Name the chart title and the exact change (thresholds, drop empty days, remove section).',
    })
  }
  if (args.softBlocked.some((code) => code.startsWith('unsynced:') || code === 'prose_miss')) {
    followUps.push({
      title: fr ? 'Réessayer autrement' : 'Try another way',
      question: fr
        ? 'Voulez-vous que je refasse uniquement la section concernée ?'
        : 'Should I rebuild only the section that failed?',
    })
  }
  if (args.acwrStatus === 'empty_declared') {
    followUps.push({
      title: fr ? 'Changer de domaine' : 'Pivot domains',
      question: fr
        ? 'Afficher plutôt les scores et le wellness sur la même période ?'
        : 'Show scores and wellness for the same window instead of ACWR?',
    })
  }
  if (args.coverage && args.coverage.delivered < args.coverage.required) {
    followUps.push({
      title: fr ? 'Compléter la couverture' : 'Finish coverage',
      question: fr
        ? 'Continuer les fiches individuelles pour les joueurs manquants seulement ?'
        : 'Continue individual sheets for the missing players only?',
    })
  }
  if (
    args.editPath === 'local_refused' ||
    args.refusals?.some((row) => row.code === 'soft_truth_escalate' || row.code === 'soft_diff_gate')
  ) {
    followUps.push(proposeRebuildFollowUp(fr ? 'fr' : 'en'))
  }
  if (args.askContract && args.askContract.status !== 'delivered') {
    const gap = args.askContract.results.find((row) => row.status !== 'delivered')
    followUps.push({
      title: fr ? 'Compléter la demande' : 'Complete the ask',
      question: fr
        ? `Voulez-vous que je complète ${gap?.labelFr ?? 'ce qui manque'} ?`
        : `Should I complete ${gap?.labelEn ?? 'what is missing'}?`,
    })
  }
  if (!followUps.length && args.envelope.mode === 'soft_ops') {
    followUps.push({
      title: fr ? 'Autre ajustement' : 'Another soft tweak',
      question: fr
        ? 'Retirer les jours vides ou renforcer les titres ensuite ?'
        : 'Drop empty days or strengthen titles next?',
    })
  }

  return {
    markdown: bullets.map((line) => `• ${line}`).join('\n'),
    followUps: followUps.slice(0, 3),
    editPath: args.editPath,
    refusals: args.refusals,
  }
}
