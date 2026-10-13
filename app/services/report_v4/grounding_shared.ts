import { captionUnknownAthletes } from '#services/premium_report/canvas_athletes'
import type {
  GroundingAuditInput,
  GroundingAuditResult,
  GroundingViolation,
  GroundingWellnessScale,
} from '#services/report_v4/grounding_types'

export const IDENTITY_COL_RE =
  /^(joueur|player|athlete|athlete_id|name|full_?name|athlete_?name|date_of_day|date|poste|position|unit|n|count)$/i

export const WELLNESS_PROSE_RE = /\b(mood|stress|soreness|sleep|wellness|energy|quality|readiness)\b/i

export const WELLNESS_SCALE_SPAN_RE = /\b(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\b/gi

export const WELLNESS_SCALE_CUE_RE = /\b(?:scales?|rated\s+on|points?|pts?|out\s+of)\b/i

export const DATE_SPAN_RE =
  /\d{4}|\d{1,2}[./]\d{1,2}|→|—>|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:early|late|mid)\s+period\b|\bincreased\s+from\b|\bdecreased\s+from\b|\bfrom\s+\d{1,2}\s*[-–—]\s*\d{1,2}\b/i

export const NUTRITION_PROSE_RE =
  /\b(nutrition|nutri|calor|protein|carbs?|hydrat|caffeine|energy\s*drink|monster|red\s*bull|supplement|macros?|meals?|product[- ]?label)\b/i

export const fold = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const fail = (violations: GroundingViolation[]): GroundingAuditResult => ({
  ok: violations.length === 0,
  violations,
})

export const dedupeViolations = (violations: GroundingViolation[]): GroundingViolation[] => {
  const seen = new Set<string>()
  const out: GroundingViolation[] = []
  for (const v of violations) {
    const key = `${v.code}|${v.message}|${v.evidence ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

export const clubNameExcludeTokens = (clubName?: string): string[] => {
  if (!clubName?.trim()) return []
  return clubName
    .split(/[\s/|,._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
}

export const athleteCaptionOptions = (input: GroundingAuditInput) => ({
  excludeTokens: clubNameExcludeTokens(input.clubName),
})

export const collectDatasetColumns = (datasets: Iterable<{ columns: string[] }>): string[] => {
  const cols = new Set<string>()
  for (const dataset of datasets) {
    for (const col of dataset.columns) {
      if (col.trim()) cols.add(col.trim())
    }
  }
  return [...cols]
}

export const columnAllowed = (metric: string, columns: string[]): boolean => {
  const needle = fold(metric)
  if (!needle || IDENTITY_COL_RE.test(metric)) return true
  return columns.some((col) => {
    const hay = fold(col)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}

export const athleteAllowed = (
  name: string,
  allowed: string[],
  options?: { excludeTokens?: string[] }
): boolean => {
  const unknown = captionUnknownAthletes(name, allowed, options)
  return unknown.length === 0
}

export const htmlToPlain = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const findWellnessScaleClaims = (text: string): Array<{ min: number; max: number }> => {
  const out: Array<{ min: number; max: number }> = []
  const sentences = text.split(/[.!?\n]+/)
  for (const sentence of sentences) {
    if (!WELLNESS_PROSE_RE.test(sentence)) continue
    WELLNESS_SCALE_SPAN_RE.lastIndex = 0
    for (const match of sentence.matchAll(WELLNESS_SCALE_SPAN_RE)) {
      const min = Number(match[1])
      const max = Number(match[2])
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) continue
      if (max > 20 || min < 1) continue
      const start = match.index ?? 0
      const around = sentence.slice(Math.max(0, start - 36), start + match[0].length + 36)
      if (DATE_SPAN_RE.test(around) || DATE_SPAN_RE.test(sentence)) continue
      if (!WELLNESS_SCALE_CUE_RE.test(around)) continue
      out.push({ min, max })
    }
  }
  return out
}

export const scaleClaimMatchesClub = (
  claim: { min: number; max: number },
  scales: GroundingWellnessScale[]
): boolean => scales.some((scale) => scale.min === claim.min && scale.max === claim.max)
