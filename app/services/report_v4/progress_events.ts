import type { AppLanguage } from '#utils/localize'

export type ReportProgressStep =
  | 'understand_request'
  | 'collect_data'
  | 'analyze'
  | 'build_sheets'
  | 'design_pages'
  | 'review_pages'
  | 'render_pdf'
  | 'apply_edit'

export type ReportProgressEvent = {
  status: string
  step: ReportProgressStep
  label: string
  index: number
  total: number
}

const LABELS: Record<ReportProgressStep, { fr: string; en: string }> = {
  understand_request: { fr: 'Lecture de la demande', en: 'Reading the request' },
  collect_data: { fr: 'Collecte des données', en: 'Collecting data' },
  analyze: { fr: 'Analyse', en: 'Analysis' },
  build_sheets: { fr: 'Fiches joueurs', en: 'Player sheets' },
  design_pages: { fr: 'Mise en page', en: 'Page design' },
  review_pages: { fr: 'Contrôle des pages', en: 'Page review' },
  render_pdf: { fr: 'Préparation du PDF', en: 'Preparing the PDF' },
  apply_edit: { fr: 'Application de la modification', en: 'Applying the edit' },
}

export const FULL_GENERATION_STEPS: ReportProgressStep[] = [
  'understand_request',
  'collect_data',
  'analyze',
  'build_sheets',
  'design_pages',
  'render_pdf',
]

export const LOCAL_EDIT_STEPS: ReportProgressStep[] = [
  'understand_request',
  'apply_edit',
  'render_pdf',
]

export const buildProgressEvent = (args: {
  step: ReportProgressStep
  language: AppLanguage
  steps: ReportProgressStep[]
}): ReportProgressEvent => {
  const index = Math.max(1, args.steps.indexOf(args.step) + 1)
  const total = Math.max(1, args.steps.length)
  const label =
    args.language === 'fr' ? LABELS[args.step].fr : LABELS[args.step].en
  return {
    status: label,
    step: args.step,
    label,
    index,
    total,
  }
}
