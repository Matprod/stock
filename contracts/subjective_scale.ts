import type {
  SubjectiveDisplayContext,
  SubjectiveVariableDomain,
} from '#contracts/subjective_variable'

export interface SubjectiveScaleTranslationRow {
  translatableId: string
  key: string
  value: string
}

export interface SubjectiveVariableLevelDescription {
  level: number
  description: string
}

export interface SubjectiveScaleFieldContent {
  id: string
  fieldName: string
  domain: SubjectiveVariableDomain
  context: SubjectiveDisplayContext
  min: number
  max: number
  isReversed: boolean
  gap: number | null
  label: string
  intro: string
  descriptions: SubjectiveVariableLevelDescription[]
}

export interface SubjectiveScaleConfigScale {
  minScale: number
  maxScale: number
}

export interface SubjectiveScaleHelpContent {
  intro: string
  descriptions: SubjectiveVariableLevelDescription[]
}

export interface SubjectiveScaleFieldResponse {
  id: string
  fieldName: string
  domain: SubjectiveVariableDomain
  context: SubjectiveDisplayContext
  min: number
  max: number
  isReversed: boolean
  gap: number | null
  label: string
  help: SubjectiveScaleHelpContent
}

export interface SubjectiveScaleFilter {
  context?: SubjectiveDisplayContext
  domains?: SubjectiveVariableDomain[]
}
