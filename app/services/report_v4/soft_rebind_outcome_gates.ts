import { countSoftMutations } from '#services/report_v4/artifact_runtime/index'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { ArtifactDesignOp } from '#services/report_v4/artifact_runtime/index'

type FinalizeOk = { ok: true; html: string; injectedCharts: number }
type FinalizeFail = { ok: false; error?: string }
type FinalizeResult = FinalizeOk | FinalizeFail

type ValidationResult = {
  missingHosts: string[]
  proseMiss: boolean
  unsyncedBlockIds: string[]
}

export type SoftRebindGateArgs = {
  softOps: SoftEditOpsPlan | null
  designOps?: ArtifactDesignOp[]
  softProseOnly: boolean
  softEditorialOnly: boolean
  recommendationStrip: boolean
  editorialRemoved: number
  tocAdded: boolean
  emptyStripped: number
  syncedProseSynced: number
  syncedTablesSynced: number
  injectedHostShells: number
  softInject: {
    injectedProse: number
    injectedSections: number
    injectedTables: number
  }
  recoStripped: number
  sheetsRebuilt: number
  designApplied: string[]
  newChartBlocksLength: number
  hostHealInjected: number
  editorialGatesOk: boolean
  rebound: FinalizeResult
  validation: ValidationResult
}

export type SoftRebindGates = {
  chartOptionsPatched: number
  mutationStats: ReturnType<typeof countSoftMutations>
  expectedSoftWork: boolean
  softBlocked: string[]
  zeroMutations: boolean
  hardFail: boolean
  softOk: boolean
}

export const computeSoftRebindGates = (args: SoftRebindGateArgs): SoftRebindGates => {
  const chartOptionsPatched = Number(args.softOps?.chartOptionsPatched ?? 0)
  const mutationStats = countSoftMutations({
    editorialRemoved: args.editorialRemoved,
    tocAdded: args.tocAdded,
    emptyStripped: args.emptyStripped,
    syncedProse: args.syncedProseSynced,
    syncedTables: args.syncedTablesSynced,
    injectedHostShells: args.injectedHostShells,
    injectedProse: args.softInject.injectedProse,
    injectedSections: args.softInject.injectedSections,
    injectedTables: args.softInject.injectedTables,
    injectedCharts: args.rebound.ok ? args.rebound.injectedCharts : 0,
    recoStripped: args.recoStripped,
    sheetsRebuilt: args.sheetsRebuilt,
    chartOptionsPatched,
    designApplied: args.designApplied,
  })
  const expectedSoftWork = Boolean(
    args.softOps ||
      args.designOps?.length ||
      args.softProseOnly ||
      args.softEditorialOnly ||
      args.recommendationStrip ||
      args.newChartBlocksLength > 0 ||
      args.hostHealInjected > 0
  )
  const softBlocked: string[] = []
  if (!args.editorialGatesOk) softBlocked.push('editorial_gates')
  if (!args.rebound.ok) softBlocked.push('finalize_html')
  if (args.validation.missingHosts.length) softBlocked.push('missing_hosts')
  if (args.validation.unsyncedBlockIds.length) {
    softBlocked.push('prose_miss')
    for (const id of args.validation.unsyncedBlockIds) softBlocked.push(`unsynced:${id}`)
  }
  const zeroMutations = expectedSoftWork && mutationStats.appliedCount === 0
  if (zeroMutations) softBlocked.push('zero_mutations')

  const hardFail =
    !args.editorialGatesOk ||
    !args.rebound.ok ||
    args.validation.missingHosts.length > 0 ||
    args.validation.unsyncedBlockIds.length > 0
  const softOk = !hardFail && !zeroMutations

  return {
    chartOptionsPatched,
    mutationStats,
    expectedSoftWork,
    softBlocked,
    zeroMutations,
    hardFail,
    softOk,
  }
}
