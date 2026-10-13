export type AthleteCoverageKind = 'all' | 'named' | 'topn' | 'team'

export type ArtifactVizOp =
  | { kind: 'drop_empty_days'; columns?: string[] }
  | { kind: 'mark_lines'; values: number[]; metricHint?: string }
  | { kind: 'strip_visualMap' }
  | { kind: 'remap_encode'; mode: 'swap_axes' }
  | { kind: 'chart_metric'; metric: string }

export type ArtifactDesignOp =
  | { kind: 'strengthen_title' }
  | { kind: 'accent_band' }
  | { kind: 'tighten_spacing' }
  | { kind: 'emphasize_captions' }

export const SOFT_ARTIFACT_VIZ_KINDS = new Set<ArtifactVizOp['kind']>([
  'drop_empty_days',
  'mark_lines',
  'strip_visualMap',
  'remap_encode',
])

export type ArtifactContracts = {
  athleteCoverage: AthleteCoverageKind
  requiredAthletes: string[]
  vizOps: ArtifactVizOp[]
  designOps: ArtifactDesignOp[]
  requiredMetrics: string[]
  softAllowed: boolean
  individualSheets: boolean
}

export type ArtifactMode = 'free' | 'soft_ops' | 'gated_rebuild'

export type ArtifactEnvelope = {
  mode: ArtifactMode
  contracts: ArtifactContracts
  chartDefaults: {
    dropEmptyDays: boolean
    markLineValues: number[]
  }
  coverage: {
    requiredNames: string[]
    individualSheets: boolean
  }
  harvest: {
    requiredMetrics: string[]
    requireLoadDomain: boolean
  }
}

export type ArtifactOpResult = {
  patched: number
  applied: string[]
}

export type ArtifactCoverageResult = {
  required: number
  delivered: number
  covered: string[]
  missing: string[]
  ok: boolean
}

export type ArtifactHarvestStatus = 'ok' | 'pending' | 'empty_declared'

export type ArtifactHarvestResult = {
  status: ArtifactHarvestStatus
  ok: boolean
  missing: string[]
  triedLoadSummary: boolean
  hasAcwrColumn: boolean
  emptyDeclared: boolean
}
