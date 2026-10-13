import type { PremiumDataset } from '#contracts/premium_report'
import type { AppLanguage } from '#utils/localize'

const STRUCTURAL_FR: Record<string, string> = {
  date_of_day: 'Date',
  date: 'Date',
  joueur: 'Joueur',
  player: 'Joueur',
  athlete: 'Athlète',
  poste: 'Poste',
  position: 'Poste',
  activite: 'Activité',
  type_activite: 'Activité',
  activity: 'Activité',
  activity_type: 'Activité',
  nb_joueurs: 'Nb joueurs',
  n: 'N',
  unit: 'Unité',
  biomarqueur: 'Biomarqueur',
  valeur: 'Valeur',
  nb_mesures: 'Nb mesures',
  test_type: 'Type de test',
  x_column: 'X',
  y_column: 'Y',
  correlation: 'Corrélation',
  r: 'r',
  method: 'Méthode',
  srpe_daily: 'sRPE daily',
  srpe: 'sRPE',
  acwr_ewma: 'ACWR EWMA (sRPE)',
  ewma_7: 'EWMA-7',
  ewma_28: 'EWMA-28',
  monotony: 'Monotony',
  strain: 'Strain',
  total_distance_m: 'Distance totale',
  hmld_m: 'HMLD',
  performance_score: 'Performance score',
  injury_risk_score: 'Injury risk score',
  body_soreness_rating: 'Courbatures',
  mood_rating: 'Humeur',
  stress_rating: 'Stress',
  energy_rating: 'Énergie',
  quality_rating: 'Qualité de sommeil',
  date_of_injury: 'Date de blessure',
  recovery_date: 'Date de reprise',
  status: 'Statut',
  injury: 'Blessure',
  location: 'Localisation',
  context: 'Contexte',
  contact_type: 'Contact',
  tissue: 'Tissu',
  mechanism: 'Mécanisme',
}

const STRUCTURAL_EN: Record<string, string> = {
  date_of_day: 'Date',
  date: 'Date',
  joueur: 'Player',
  player: 'Player',
  athlete: 'Athlete',
  poste: 'Position',
  position: 'Position',
  activite: 'Activity',
  type_activite: 'Activity',
  activity: 'Activity',
  activity_type: 'Activity',
  nb_joueurs: 'Players (n)',
  n: 'N',
  unit: 'Unit',
  biomarqueur: 'Biomarker',
  valeur: 'Value',
  nb_mesures: 'Samples (n)',
  test_type: 'Test type',
  x_column: 'X',
  y_column: 'Y',
  correlation: 'Correlation',
  r: 'r',
  method: 'Method',
  srpe_daily: 'sRPE daily',
  srpe: 'sRPE',
  acwr_ewma: 'ACWR EWMA (sRPE)',
  ewma_7: 'EWMA-7',
  ewma_28: 'EWMA-28',
  monotony: 'Monotony',
  strain: 'Strain',
  total_distance_m: 'Total distance',
  hmld_m: 'HMLD',
  performance_score: 'Performance score',
  injury_risk_score: 'Injury risk score',
  body_soreness_rating: 'Body soreness',
  mood_rating: 'Mood',
  stress_rating: 'Stress',
  energy_rating: 'Energy',
  quality_rating: 'Sleep quality',
  date_of_injury: 'Date of injury',
  recovery_date: 'Recovery date',
  status: 'Status',
  injury: 'Injury',
  location: 'Location',
  context: 'Context',
  contact_type: 'Contact type',
  tissue: 'Tissue',
  mechanism: 'Mechanism',
}

const looksTechnical = (name: string): boolean =>
  /_/.test(name) || /^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(name)

const titleCaseWords = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const withUnit = (label: string, unit?: string): string => {
  if (!unit) return label
  const trimmed = unit.trim()
  if (!trimmed) return label
  if (/\(.*\)\s*$/.test(label)) return label
  return `${label} (${trimmed})`
}

const uniqueDisplayLabel = (base: string, used: Set<string>): string => {
  let label = base
  if (used.has(label)) {
    let i = 2
    while (used.has(`${base} (${i})`)) i += 1
    label = `${base} (${i})`
  }
  used.add(label)
  return label
}

export type ColumnLabelContext = {
  units?: Record<string, string>
  labels?: Record<string, string>
}

const isLabelContext = (value: object): value is ColumnLabelContext =>
  Object.keys(value).every((key) => key === 'units' || key === 'labels')

export const displayColumnLabel = (
  name: string,
  language: AppLanguage = 'fr',
  unitsOrCtx?: ColumnLabelContext | Record<string, string>
): string => {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const key = trimmed.toLowerCase()
  const ctx =
    unitsOrCtx && isLabelContext(unitsOrCtx)
      ? unitsOrCtx
      : { units: unitsOrCtx as Record<string, string> | undefined }
  const fromDb = ctx.labels?.[trimmed] ?? ctx.labels?.[key]
  const structural = (language === 'en' ? STRUCTURAL_EN : STRUCTURAL_FR)[key]
  const base = fromDb ?? structural ?? (looksTechnical(trimmed) ? titleCaseWords(trimmed) : trimmed)
  const unit = ctx.units?.[trimmed] ?? ctx.units?.[key]
  return withUnit(base, unit)
}

const labelCtx = (dataset: PremiumDataset): ColumnLabelContext => ({
  units: dataset.units,
  labels: dataset.labels,
})

export const relabelDatasetColumns = (
  dataset: PremiumDataset,
  language: AppLanguage = 'fr'
): PremiumDataset => {
  const used = new Set<string>()
  const rename = new Map<string, string>()
  const ctx = labelCtx(dataset)
  for (const column of dataset.columns) {
    const label = uniqueDisplayLabel(displayColumnLabel(column, language, ctx), used)
    rename.set(column, label)
  }
  const nextUnits: Record<string, string> = {}
  if (dataset.units) {
    for (const [column, unit] of Object.entries(dataset.units)) {
      const label = rename.get(column)
      if (label) nextUnits[label] = unit
    }
  }
  const nextLabels: Record<string, string> = {}
  if (dataset.labels) {
    for (const [column, label] of Object.entries(dataset.labels)) {
      const renamed = rename.get(column)
      if (renamed) nextLabels[renamed] = label
    }
  }
  return {
    ...dataset,
    columns: dataset.columns.map((column) => rename.get(column) ?? column),
    rows: dataset.rows.map((row) => {
      const next: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(row)) {
        next[rename.get(key) ?? displayColumnLabel(key, language, ctx)] = value
      }
      return next
    }),
    ...(Object.keys(nextUnits).length ? { units: nextUnits } : {}),
    ...(Object.keys(nextLabels).length ? { labels: nextLabels } : {}),
  }
}

export const relabelTableColumns = (
  columns: string[],
  language: AppLanguage = 'fr',
  unitsOrCtx?: ColumnLabelContext | Record<string, string>
): string[] => {
  const used = new Set<string>()
  return columns.map((column) =>
    uniqueDisplayLabel(displayColumnLabel(column, language, unitsOrCtx), used)
  )
}
