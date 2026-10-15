import type { PremiumDomain } from '#constants/premium_report_domains'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import type { AppLanguage } from '#utils/localize'

export type LocalizedLabel = { fr: string; en: string }

const UNIT_SUFFIX_RE =
  /\s*[\(\[]?\s*(m\/min|km\/h|m\/s2|m\/s²|m|km|min|s|%|au|ua|count|0-100)\s*[\)\]]?\s*$/i

const KNOWN_ACRONYMS = new Set([
  'hsr',
  'hmld',
  'rmssd',
  'acwr',
  'trimp',
  'ck',
  'cmj',
  'dsl',
  'gps',
  'rpe',
  'epoc',
  'hf',
  'lf',
  'au',
  'ua',
])

const DOMAIN_LABELS: Record<PremiumDomain, LocalizedLabel> = {
  [PREMIUM_DOMAIN.LOAD]: { fr: 'Charge', en: 'Load' },
  [PREMIUM_DOMAIN.GPS]: { fr: 'GPS', en: 'GPS' },
  [PREMIUM_DOMAIN.MATCH]: { fr: 'Match', en: 'Match' },
  [PREMIUM_DOMAIN.WELLNESS]: { fr: 'Wellness', en: 'Wellness' },
  [PREMIUM_DOMAIN.SLEEP]: { fr: 'Sommeil', en: 'Sleep' },
  [PREMIUM_DOMAIN.VALD]: { fr: 'Tests de force', en: 'Force tests' },
  [PREMIUM_DOMAIN.BIOMARKERS]: { fr: 'Biomarqueurs', en: 'Biomarkers' },
  [PREMIUM_DOMAIN.BODY]: { fr: 'Composition corporelle', en: 'Body composition' },
  [PREMIUM_DOMAIN.SCORES]: { fr: 'Scores', en: 'Scores' },
  [PREMIUM_DOMAIN.INJURY]: { fr: 'Blessures', en: 'Injuries' },
}

const UNIT_LABELS: Record<string, string> = {
  m: 'm',
  'm/min': 'm/min',
  km: 'km',
  'km/h': 'km/h',
  min: 'min',
  s: 's',
  '%': '%',
  au: 'AU',
  ua: 'AU',
  count: 'n',
}

const foldKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const extractUnitFromName = (name: string): { base: string; unit?: string } => {
  const trimmed = name.trim()
  const paren = trimmed.match(/^(.*?)[\s_-]*[\(\[]?\s*(m\/min|km\/h|m\/s2|m\/s²|m|km|min|s|%|au|ua)\s*[\)\]]?\s*$/i)
  if (paren?.[2] && paren[1]?.trim()) {
    return { base: paren[1].trim(), unit: paren[2] }
  }
  const underscored = trimmed.match(/^(.*?)_(m|km|min|s|pct|percent|count|ms2|m_s2)$/i)
  if (underscored?.[2] && underscored[1]?.trim()) {
    const u = underscored[2].toLowerCase()
    const unit = u === 'pct' || u === 'percent' ? '%' : u === 'ms2' || u === 'm_s2' ? 'm/s²' : underscored[2]
    return { base: underscored[1].trim(), unit }
  }
  return { base: trimmed }
}

export const humanizeTechnicalName = (name: string): string => {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  const { base, unit } = extractUnitFromName(trimmed)
  let work = base.replace(/^kpi[_-]+/i, '')
  work = work
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/^(max|min|mean|avg|total|sum|peak)(?=[a-z])/i, '$1 ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!work) return trimmed
  const words = work.split(' ').map((word, index) => {
    const lower = word.toLowerCase()
    if (lower === 'srpe') return 'sRPE'
    if (KNOWN_ACRONYMS.has(lower)) return lower.toUpperCase()
    if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    return lower
  })
  const label = words.join(' ')
  if (!unit) return label
  const unitText = UNIT_LABELS[foldKey(unit)] ?? unit
  const labelFold = foldKey(label)
  const unitFold = foldKey(unitText)
  if (
    labelFold === unitFold ||
    labelFold.endsWith(`_${unitFold}`) ||
    labelFold.endsWith(` ${unitFold}`) ||
    new RegExp(`(?:^|_)${unitFold}$`).test(labelFold)
  ) {
    return label
  }
  return `${label} (${unitText})`
}

export const genericColumnLabel = (name: string): string => humanizeTechnicalName(name)

export const resolveColumnLabel = (
  column: string,
  _language: AppLanguage = 'fr'
): { label: string; source: 'table' | 'generic' } => {
  const trimmed = column.trim()
  if (!trimmed) return { label: trimmed, source: 'table' }
  return { label: humanizeTechnicalName(trimmed), source: 'generic' }
}

export const displayMetricColumnLabel = (
  column: string,
  language: AppLanguage = 'fr',
  unit?: string
): string => {
  const { label } = resolveColumnLabel(column, language)
  const unitLabel = unit?.trim()
  if (!unitLabel) return label
  if (UNIT_SUFFIX_RE.test(label)) return label
  if (foldKey(label).includes(foldKey(unitLabel))) return label
  return `${label} (${localizeUnit(unitLabel, language)})`
}

export const localizeUnit = (unit: string, _language: AppLanguage = 'fr'): string => {
  const key = foldKey(unit)
  return UNIT_LABELS[key] ?? UNIT_LABELS[unit.trim().toLowerCase()] ?? unit.trim()
}

export const displayPositionLabel = (position: string, _language: AppLanguage = 'fr'): string => {
  const trimmed = position.trim()
  if (!trimmed) return trimmed
  return humanizeTechnicalName(trimmed.replace(/_/g, ' '))
}

export const displayDomainLabel = (domain: PremiumDomain, language: AppLanguage = 'fr'): string => {
  const entry = DOMAIN_LABELS[domain]
  if (!entry) return domain
  return language === 'en' ? entry.en : entry.fr
}

export const formatValueWithUnit = (args: {
  valueText: string
  unit?: string | null
  language?: AppLanguage
}): string => {
  const value = args.valueText.replace(/^[\s\u00a0\u202f]+|[\s\u00a0\u202f]+$/g, '')
  const unit = args.unit?.trim()
  if (!unit) return value
  const localized = localizeUnit(unit, args.language ?? 'fr')
  const unitFold = foldKey(localized)
  const valueFold = foldKey(value)
  if (valueFold.endsWith(unitFold) || valueFold.includes(`_${unitFold}`)) return value
  if (new RegExp(`${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i').test(value)) {
    return value
  }
  return `${value}\u00a0${localized}`
}

export const dedupeAdjacentUnitSpans = (html: string): string => {
  return html.replace(
    /(<span\b[^>]*\bdata-fact=["'][^"']+["'][^>]*>)([\s\S]*?)(<\/span>)\s*<span\b([^>]*\bclass=["'][^"']*\bunit\b[^"']*["'][^>]*)>([\s\S]*?)<\/span>/gi,
    (full, open: string, body: string, close: string, _unitAttrs: string, unitBody: string) => {
      const valueText = String(body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const unitText = String(unitBody).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (!unitText) return full
      const valueFold = foldKey(valueText)
      const unitFold = foldKey(unitText)
      if (valueFold.endsWith(unitFold)) return `${open}${body}${close}`
      return full
    }
  )
}

export const seedColumnLabels = (): Record<string, LocalizedLabel> => ({})
