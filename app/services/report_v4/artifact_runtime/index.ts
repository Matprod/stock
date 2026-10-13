export type {
  ArtifactContracts,
  ArtifactCoverageResult,
  ArtifactDesignOp,
  ArtifactEnvelope,
  ArtifactHarvestResult,
  ArtifactHarvestStatus,
  ArtifactMode,
  ArtifactOpResult,
  ArtifactVizOp,
  AthleteCoverageKind,
} from '#services/report_v4/artifact_runtime/types'

export { SOFT_ARTIFACT_VIZ_KINDS } from '#services/report_v4/artifact_runtime/types'

export {
  analystPacketFromEnvelope,
  artifactContractsFromIntent,
  envelopeFromContracts,
  markLineValuesFromContracts,
  resolveArtifactContracts,
  resolveArtifactEnvelope,
  resolveArtifactEnvelopeAsync,
  wantsDropEmptyDays,
  type ArtifactIntentFlags,
} from '#services/report_v4/artifact_runtime/resolve'

export { applyArtifactOpsToDocument } from '#services/report_v4/artifact_runtime/ops'

export { applyDesignOpsToHtml } from '#services/report_v4/artifact_runtime/design_ops'

export {
  hasConcreteSoftSignal,
  resolveFreshClarify,
  resolveSoftClarify,
  scoreSoftIntentConfidence,
  type FreshClarifyResult,
  type SoftClarifyQuestion,
  type SoftClarifyResult,
} from '#services/report_v4/artifact_runtime/clarify'

export {
  evaluateSoftDiffGate,
  hashPremiumBlock,
  type SoftDiffGateResult,
} from '#services/report_v4/artifact_runtime/diff_gate'

export {
  buildSoftRunSummary,
  type SoftFollowUp,
  type SoftRunSummary,
} from '#services/report_v4/artifact_runtime/soft_summary'

export {
  pathCostBudgetUsd,
  resolvePathCostClass,
  type PathCostClass,
} from '#services/report_v4/artifact_runtime/path_cost'

export {
  acwrHarvestNudge,
  annotateBriefCoverageShortfall,
  countSoftMutations,
  coverageGateMessage,
  evaluateCoverageGate,
  listCoveredAthleteNames,
  verifyAcwrHarvest,
} from '#services/report_v4/artifact_runtime/gates'

export {
  analystIterationBudget,
  prepareSoftArtifactPath,
  type SoftArtifactPrep,
} from '#services/report_v4/artifact_runtime/soft_path'
