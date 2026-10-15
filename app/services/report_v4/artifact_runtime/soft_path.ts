import type { PremiumReportDocument } from '#contracts/premium_report'
import { applyArtifactOpsToDocument } from '#services/report_v4/artifact_runtime/ops'
import type { ArtifactDesignOp, ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'

const emptySoftOpsPlan = (): SoftEditOpsPlan => ({
  ops: [],
  editorialOnly: false,
  needsAnalyst: false,
  needsFetch: false,
  removeQueries: [],
  ensureToc: false,
  hasDataOps: true,
  restoreSheets: false,
  addSectionProse: false,
  additiveSoft: false,
  layoutRepair: false,
  wantsTeamMean: false,
  enrichExistingCharts: false,
})

export type SoftArtifactPrep = {
  document: PremiumReportDocument
  softOps: SoftEditOpsPlan | null
  softEditorialOnly: boolean
  designOps: ArtifactDesignOp[]
  opResult: { patched: number; applied: string[] }
}

export const prepareSoftArtifactPath = (args: {
  document: PremiumReportDocument
  envelope: ArtifactEnvelope
  softOps: SoftEditOpsPlan | null
  softEditorialOnly: boolean
}): SoftArtifactPrep => {
  const opResult = applyArtifactOpsToDocument(args.document, args.envelope.contracts)
  const designOps = [...args.envelope.contracts.designOps]
  const softOps =
    opResult.patched > 0 || designOps.length > 0
      ? {
          ...(args.softOps ?? emptySoftOpsPlan()),
          ...(opResult.patched > 0
            ? { chartOptionsPatched: opResult.patched, hasDataOps: true }
            : {}),
        }
      : args.softOps
  return {
    document: opResult.document,
    softOps,
    softEditorialOnly: args.softEditorialOnly && args.envelope.contracts.softAllowed,
    designOps,
    opResult: { patched: opResult.patched, applied: opResult.applied },
  }
}

export const analystIterationBudget = (args: {
  envelope: ArtifactEnvelope
  base: { min: number; max: number; forceAnswerAt: number }
}): { min: number; max: number; forceAnswerAt: number } => args.base
