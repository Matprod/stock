import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'

export type PathCostClass = 'editorial' | 'soft_ops' | 'soft_analyst' | 'gated_rebuild' | 'full'

export const resolvePathCostClass = (args: {
  envelope: ArtifactEnvelope
  preserveCanvas: boolean
  softEditorialOnly: boolean
  skipAnalyst: boolean
  needsFetch: boolean
}): PathCostClass => {
  if (!args.preserveCanvas) {
    return args.envelope.mode === 'gated_rebuild' ? 'gated_rebuild' : 'full'
  }
  if (args.softEditorialOnly && args.skipAnalyst) return 'editorial'
  if (args.envelope.mode === 'soft_ops' && args.skipAnalyst && !args.needsFetch) return 'soft_ops'
  if (args.preserveCanvas && !args.needsFetch) return 'soft_analyst'
  if (args.envelope.mode === 'gated_rebuild') return 'gated_rebuild'
  return 'full'
}

export const pathCostBudgetUsd = (path: PathCostClass): number => {
  if (path === 'editorial') return 0.05
  if (path === 'soft_ops') return 0.08
  if (path === 'soft_analyst') return 0.25
  if (path === 'gated_rebuild') return 0.9
  return 1.5
}
