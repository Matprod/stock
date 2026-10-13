import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'

export type GroundingViolationCode =
  | 'brief_missing'
  | 'athlete_unknown'
  | 'metric_unknown'
  | 'wellness_scale'
  | 'nutrition_out_of_scope'
  | 'ungrounded_viz'
  | 'numeric_ungrounded'
  | 'literal_number'

export type GroundingViolation = {
  code: GroundingViolationCode
  message: string
  evidence?: string
}

export type GroundingAuditResult = {
  ok: boolean
  violations: GroundingViolation[]
}

export type GroundingWellnessScale = {
  field: string
  label: string
  min: number
  max: number
  isReversed: boolean
}

export type GroundingAuditFact = {
  id: string
  value: number
  unit?: string
  precision?: number
  thresholds?: number[]
}

export type GroundingAuditInput = {
  roster: Array<{ name: string; id?: string }>
  datasets: PremiumDataset[]
  document?: PremiumReportDocument
  allowNutritionScope: boolean
  harvestHasRows: boolean
  wellnessScales?: GroundingWellnessScale[]
  clubName?: string
  skipLiteralFactGate?: boolean
  enforceLiteralFactGate?: boolean
  facts?: GroundingAuditFact[]
  groundingLanguage?: 'fr' | 'en'
  displayRange?: { from: string; to: string }
  properNames?: string[]
  jerseyNumbers?: number[]
}
