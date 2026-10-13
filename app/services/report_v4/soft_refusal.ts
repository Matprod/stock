import type { AppLanguage } from '#utils/localize'

export type SoftEditPath =
  | 'local'
  | 'local_refused'
  | 'full_rebuild'
  | 'template_recovered'
  | 'unchanged'

export type SoftRefusalCode =
  | 'soft_truth_escalate'
  | 'soft_diff_gate'
  | 'zero_mutations'
  | 'prose_miss'
  | 'missing_hosts'
  | 'finalize_html'
  | 'editorial_gates'
  | 'diff_order'
  | 'diff_doc'
  | 'template_recovered'
  | 'designer_template_recovered'

export type SoftRefusal = {
  code: SoftRefusalCode
  reason: string
  blockIds: string[]
}

export const softRefusal = (args: {
  code: SoftRefusalCode
  reason: string
  blockIds?: string[]
}): SoftRefusal => ({
  code: args.code,
  reason: args.reason,
  blockIds: args.blockIds ?? [],
})

export const refusalsFromSoftBlocked = (args: {
  softBlocked: string[]
  unsyncedBlockIds?: string[]
  language: AppLanguage
}): SoftRefusal[] => {
  const fr = args.language !== 'en'
  const refusals: SoftRefusal[] = []
  const unsynced = args.unsyncedBlockIds ?? args.softBlocked
    .filter((code) => code.startsWith('unsynced:'))
    .map((code) => code.slice('unsynced:'.length))

  if (args.softBlocked.includes('zero_mutations')) {
    refusals.push(
      softRefusal({
        code: 'zero_mutations',
        reason: fr
          ? 'Aucune modification applicable pour cette demande.'
          : 'No applicable change for this ask.',
      })
    )
  }
  if (args.softBlocked.includes('prose_miss') || unsynced.length) {
    refusals.push(
      softRefusal({
        code: 'prose_miss',
        reason: fr
          ? 'Synchronisation locale du texte incomplète.'
          : 'Local prose sync incomplete.',
        blockIds: unsynced,
      })
    )
  }
  if (args.softBlocked.includes('missing_hosts')) {
    refusals.push(
      softRefusal({
        code: 'missing_hosts',
        reason: fr
          ? 'Des graphiques requis manquent dans le HTML.'
          : 'Required chart hosts are missing from the HTML.',
      })
    )
  }
  if (args.softBlocked.includes('finalize_html')) {
    refusals.push(
      softRefusal({
        code: 'finalize_html',
        reason: fr
          ? 'Finalisation HTML locale impossible.'
          : 'Local HTML finalize failed.',
      })
    )
  }
  if (args.softBlocked.includes('editorial_gates')) {
    refusals.push(
      softRefusal({
        code: 'editorial_gates',
        reason: fr
          ? 'Contrôles éditoriaux locaux non satisfaits.'
          : 'Local editorial gates were not met.',
      })
    )
  }
  if (
    args.softBlocked.includes('prose_miss') ||
    args.softBlocked.includes('missing_hosts') ||
    args.softBlocked.includes('finalize_html') ||
    args.softBlocked.includes('editorial_gates')
  ) {
    refusals.push(
      softRefusal({
        code: 'soft_truth_escalate',
        reason: fr
          ? 'Édition locale refusée ; le rapport précédent a été conservé.'
          : 'Local edit refused; the previous report was kept.',
        blockIds: unsynced,
      })
    )
  }
  return refusals
}

export const refusalFromDiffGate = (args: {
  mutatedOutsideAllowlist: string[]
  orderChanged: boolean
  documentFieldsChanged: string[]
  language: AppLanguage
}): SoftRefusal[] => {
  const fr = args.language !== 'en'
  const refusals: SoftRefusal[] = [
    softRefusal({
      code: 'soft_diff_gate',
      reason: fr
        ? 'Modification hors du périmètre demandé.'
        : 'Change outside the requested scope.',
      blockIds: args.mutatedOutsideAllowlist,
    }),
  ]
  if (args.orderChanged) {
    refusals.push(
      softRefusal({
        code: 'diff_order',
        reason: fr
          ? 'L’ordre des blocs hors cible a changé.'
          : 'Order of out-of-scope blocks changed.',
      })
    )
  }
  for (const field of args.documentFieldsChanged) {
    refusals.push(
      softRefusal({
        code: 'diff_doc',
        reason: fr
          ? `Champ document modifié hors demande : ${field}.`
          : `Document field changed outside the ask: ${field}.`,
      })
    )
  }
  return refusals
}

export const refusalFromTemplateRecovered = (args: {
  reason: string
  language: AppLanguage
}): SoftRefusal => {
  const fr = args.language !== 'en'
  return softRefusal({
    code: 'designer_template_recovered',
    reason: fr
      ? `Mise en page libre impossible (${args.reason}) ; modèle de secours utilisé.`
      : `Free layout failed (${args.reason}); fallback template used.`,
  })
}

export const formatSoftEditPathMessage = (args: {
  path: SoftEditPath
  language: AppLanguage
  detail?: string
}): string => {
  const fr = args.language !== 'en'
  const detail = args.detail?.trim()
  switch (args.path) {
    case 'local':
      return fr
        ? detail
          ? `Modifié localement. ${detail}`
          : 'Modifié localement.'
        : detail
          ? `Updated locally. ${detail}`
          : 'Updated locally.'
    case 'local_refused':
      return (
        detail ??
        (fr
          ? "Je n'ai pas pu appliquer la modification localement. Le rapport précédent a été conservé. Voulez-vous que je refasse le rapport ?"
          : 'I could not apply the change locally. The previous report was kept. Should I rebuild the report?')
      )
    case 'unchanged':
      return (
        detail ??
        (fr
          ? 'Rien à changer sur le rapport pour cette demande.'
          : 'Nothing to change on the report for this ask.')
      )
    case 'full_rebuild':
      return fr
        ? detail
          ? `Rapport refait entièrement. ${detail}`
          : 'Rapport refait entièrement.'
        : detail
          ? `Report fully rebuilt. ${detail}`
          : 'Report fully rebuilt.'
    case 'template_recovered':
      return (
        detail ??
        (fr
          ? 'La mise en page libre a échoué ; j’ai utilisé le modèle de secours.'
          : 'Free layout failed; I used the fallback template.')
      )
    default:
      return detail ?? ''
  }
}

export const proposeRebuildFollowUp = (language: AppLanguage) =>
  language === 'en'
    ? {
        title: 'Rebuild',
        question: 'Should I rebuild the full report instead of a local edit?',
      }
    : {
        title: 'Refaire',
        question: 'Voulez-vous que je refasse le rapport en entier plutôt qu’une édition locale ?',
      }
