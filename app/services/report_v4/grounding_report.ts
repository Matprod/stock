import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import {
  canvasAthleteNames,
  captionUnknownAthletes,
} from '#services/premium_report/canvas_athletes'
import { isTeamAggregateSeriesName } from '#services/premium_report/charts/chart_rules'
import { listDatasetAthletes } from '#services/premium_report/charts/dataset_transforms'
import { hasChartEmbeddedSource } from '#services/premium_report/premium_report_document'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { ReportBrief } from '#services/report_v4/report_brief'
import {
  auditLiteralNumbersOutsideFacts,
  auditNumericClaims,
  buildGroundedNumberIndex,
  extractNumericClaimsFromBrief,
  extractNumericClaimsFromText,
  fold,
  IDENTITY_COL_RE,
} from '#services/report_v4/grounding_facts'
import {
  isReportV4GroundingTokenizerEnabled,
  scanNumbers,
  scanToLiteralViolations,
} from '#services/report_v4/grounding_tokenize'
import { harvestHasUsableDatasets } from '#services/report_v4/harvest_plan'
import type { RosterAthlete } from '#services/report_v4/roster_macros'

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
  warnings?: GroundingViolation[]
  repairedHtml?: string
}

export type GroundingWellnessScale = {
  field: string
  label: string
  min: number
  max: number
  isReversed: boolean
}

type GroundingAuditFact = {
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

export type GroundingScopeMode = 'full' | 'soft_delta'

export type GroundingScope = {
  mode: GroundingScopeMode
  allowHostIds?: string[]
}

const WELLNESS_PROSE_RE = /\b(mood|stress|soreness|sleep|wellness|energy|quality|readiness)\b/i
const WELLNESS_SCALE_SPAN_RE = /\b(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\b/gi
const WELLNESS_SCALE_CUE_RE = /\b(?:scales?|rated\s+on|points?|pts?|out\s+of)\b/i
const DATE_SPAN_RE =
  /\d{4}|\d{1,2}[./]\d{1,2}|→|—>|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:early|late|mid)\s+period\b|\bincreased\s+from\b|\bdecreased\s+from\b|\bfrom\s+\d{1,2}\s*[-–—]\s*\d{1,2}\b/i

export const NUTRITION_PROSE_RE =
  /\b(nutrition|nutri|calor|protein|carbs?|hydrat|caffeine|energy\s*drink|monster|red\s*bull|supplement|macros?|meals?|product[- ]?label)\b/i

const SOFT_DELTA_FRAGMENT_RE =
  /<(article|section|div|aside)\b[^>]*(?:data-mauna-soft-injected|data-mauna-soft-delta)=["'][^"']*["'][^>]*>[\s\S]*?<\/\1>/gi

const fail = (
  violations: GroundingViolation[],
  warnings: GroundingViolation[] = []
): GroundingAuditResult => ({
  ok: violations.length === 0,
  violations,
  ...(warnings.length ? { warnings } : {}),
})

const dedupeViolations = (violations: GroundingViolation[]): GroundingViolation[] => {
  const seen = new Set<string>()
  const out: GroundingViolation[] = []
  for (const v of violations) {
    const key =
      v.code === 'nutrition_out_of_scope'
        ? v.code
        : `${v.code}|${v.message}|${v.evidence ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

const clubNameExcludeTokens = (clubName?: string): string[] => {
  if (!clubName?.trim()) return []
  return clubName
    .split(/[\s/|,._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
}

const athleteCaptionOptions = (input: GroundingAuditInput) => ({
  excludeTokens: clubNameExcludeTokens(input.clubName),
})

const collectDatasetColumns = (datasets: Iterable<{ columns: string[] }>): string[] => {
  const cols = new Set<string>()
  for (const dataset of datasets) {
    for (const col of dataset.columns) {
      if (col.trim()) cols.add(col.trim())
    }
  }
  return [...cols]
}

const columnAllowed = (metric: string, columns: string[]): boolean => {
  const needle = fold(metric)
  if (!needle || IDENTITY_COL_RE.test(metric)) return true
  return columns.some((col) => {
    const hay = fold(col)
    return hay === needle || hay.includes(needle) || needle.includes(hay)
  })
}

const athleteAllowed = (
  name: string,
  allowed: string[],
  options?: { excludeTokens?: string[] }
): boolean => {
  const unknown = captionUnknownAthletes(name, allowed, options)
  return unknown.length === 0
}

const htmlToPlain = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const splitProseSentences = (plain: string): string[] => {
  const parts = plain.split(/(?<=[.!?…])\s+|\n+/).map((part) => part.trim())
  return parts.filter((part) => part.length > 0)
}

export const repairLiteralNumberSentencesInHtml = (
  html: string
): { html: string; stripped: number } => {
  let stripped = 0
  const next = html.replace(
    /<(p|li|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/<(?:p|li|h[1-6]|div|section|article|table|ul|ol)\b/i.test(inner)) return full
      if (auditLiteralNumbersOutsideFacts(`<${tag}>${inner}</${tag}>`).length === 0) return full
      const sentences = splitProseSentences(htmlToPlain(inner))
      if (sentences.length <= 1) {
        stripped += 1
        return ''
      }
      const kept = sentences.filter(
        (sentence) => auditLiteralNumbersOutsideFacts(`<p>${sentence}</p>`).length === 0
      )
      const removed = sentences.length - kept.length
      if (removed === 0) return full
      stripped += removed
      if (kept.length === 0) return ''
      return `<${tag}${attrs}>${kept.join(' ')}</${tag}>`
    }
  )
  return { html: next.replace(/\n{3,}/g, '\n\n'), stripped }
}

const findWellnessScaleClaims = (text: string): Array<{ min: number; max: number }> => {
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

const scaleClaimMatchesClub = (
  claim: { min: number; max: number },
  scales: GroundingWellnessScale[]
): boolean => scales.some((scale) => scale.min === claim.min && scale.max === claim.max)

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const extractSoftDeltaHtmlFragments = (html: string): string[] => {
  const fragments: string[] = []
  const re = new RegExp(SOFT_DELTA_FRAGMENT_RE.source, 'gi')
  for (const match of html.matchAll(re)) {
    const chunk = match[0]?.trim()
    if (chunk) fragments.push(chunk)
  }
  return fragments
}

const extractHostScopedHtmlFragments = (html: string, allowHostIds: string[]): string[] => {
  const fragments: string[] = []
  for (const hostId of allowHostIds) {
    const id = escapeRegExp(hostId.trim())
    if (!id) continue
    const re = new RegExp(
      `<(article|section|div)\\b[^>]*>[\\s\\S]*?\\bid=["']${id}["'][\\s\\S]*?<\\/\\1>`,
      'gi'
    )
    for (const match of html.matchAll(re)) {
      const chunk = match[0]?.trim()
      if (chunk) fragments.push(chunk)
    }
  }
  return fragments
}

export const resolveGroundingAuditHtml = (
  html: string,
  scope?: GroundingScope | null
): { html: string; scoped: boolean } => {
  if (!scope || scope.mode === 'full') {
    return { html, scoped: false }
  }

  const fragments = [
    ...extractSoftDeltaHtmlFragments(html),
    ...(scope.allowHostIds?.length ? extractHostScopedHtmlFragments(html, scope.allowHostIds) : []),
  ]
  const unique = [...new Set(fragments.filter((row) => row.length > 0))]
  if (unique.length === 0) {
    return { html, scoped: false }
  }
  return { html: unique.join('\n'), scoped: true }
}

export const detectSoftDeltaGroundingScope = (html: string): GroundingScope | null => {
  if (!/(?:data-mauna-soft-injected|data-mauna-soft-delta)=/i.test(html)) return null
  return { mode: 'soft_delta' }
}

export const collectGroundedAthleteNames = (
  roster: Array<{ name: string }>,
  datasets: Iterable<PremiumDataset>
): string[] => {
  const names = new Set<string>()
  for (const row of roster) {
    const name = row.name?.trim()
    if (name) names.add(name)
  }
  for (const dataset of datasets) {
    for (const name of listDatasetAthletes(dataset)) {
      if (name.trim()) names.add(name.trim())
    }
  }
  return [...names]
}

export const auditReportBrief = (
  brief: ReportBrief | null | undefined,
  input: GroundingAuditInput
): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
  const warnings: GroundingViolation[] = []
  if (input.harvestHasRows && !brief) {
    violations.push({
      code: 'brief_missing',
      message:
        'commit_report_brief required when harvest has rows — do not end_turn on a synthesized brief',
    })
    return fail(violations)
  }
  if (!brief) return fail(violations)

  const allowedAthletes = collectGroundedAthleteNames(input.roster, input.datasets)
  const columns = collectDatasetColumns(input.datasets)
  const proseChunks: string[] = [
    brief.focus,
    ...brief.narrative,
    ...brief.signals.map((s) => s.summary),
    ...brief.sections.flatMap((s) => [s.title, ...s.bullets]),
  ]

  const captionOpts = athleteCaptionOptions(input)
  for (const signal of brief.signals) {
    if (signal.athlete?.trim() && !athleteAllowed(signal.athlete, allowedAthletes, captionOpts)) {
      violations.push({
        code: 'athlete_unknown',
        message: 'signal.athlete not in roster ∪ dataset athletes',
        evidence: signal.athlete.trim(),
      })
    }
    if (columns.length > 0) {
      for (const key of Object.keys(signal.metrics)) {
        if (!columnAllowed(key, columns)) {
          violations.push({
            code: 'metric_unknown',
            message: 'signal.metrics key not in dataset columns',
            evidence: key,
          })
        }
      }
    }
  }

  for (const section of brief.sections) {
    if (
      section.athleteName?.trim() &&
      !athleteAllowed(section.athleteName, allowedAthletes, captionOpts)
    ) {
      violations.push({
        code: 'athlete_unknown',
        message: 'section.athleteName not in roster ∪ dataset athletes',
        evidence: section.athleteName.trim(),
      })
    }
  }

  for (const chunk of proseChunks) {
    if (!chunk?.trim()) continue
    for (const name of captionUnknownAthletes(chunk, allowedAthletes, captionOpts)) {
      violations.push({
        code: 'athlete_unknown',
        message: 'cited athlete not in roster ∪ dataset athletes',
        evidence: name,
      })
    }
    if (!input.allowNutritionScope && NUTRITION_PROSE_RE.test(chunk)) {
      warnings.push({
        code: 'nutrition_out_of_scope',
        message: 'nutrition/product prose denied unless coach asked',
        evidence: chunk.slice(0, 80),
      })
    }
  }

  const numberIndex = buildGroundedNumberIndex(input.datasets, input.document)
  if (numberIndex.global.size > 0) {
    violations.push(
      ...auditNumericClaims(extractNumericClaimsFromBrief(brief, numberIndex), numberIndex)
    )
  }

  return fail(dedupeViolations(violations), dedupeViolations(warnings))
}

export const auditCanvasDocument = (
  document: PremiumReportDocument,
  input: GroundingAuditInput
): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
  const warnings: GroundingViolation[] = []
  const allowedAthletes = collectGroundedAthleteNames(input.roster, input.datasets)

  const captionOpts = athleteCaptionOptions(input)
  for (const name of canvasAthleteNames(document.blocks, allowedAthletes)) {
    if (isTeamAggregateSeriesName(name)) continue
    if (!athleteAllowed(name, allowedAthletes, captionOpts)) {
      violations.push({
        code: 'athlete_unknown',
        message: 'canvas athlete/series not in roster ∪ dataset athletes',
        evidence: name,
      })
    }
  }

  for (const block of document.blocks) {
    if (block.type === PREMIUM_BLOCK_TYPE.TEXT || block.type === PREMIUM_BLOCK_TYPE.HEADING) {
      for (const name of captionUnknownAthletes(block.text, allowedAthletes, captionOpts)) {
        violations.push({
          code: 'athlete_unknown',
          message: 'text cites athlete outside roster ∪ dataset athletes',
          evidence: name,
        })
      }
      if (!input.allowNutritionScope && NUTRITION_PROSE_RE.test(block.text)) {
        warnings.push({
          code: 'nutrition_out_of_scope',
          message: 'nutrition/product prose denied unless coach asked',
          evidence: block.text.slice(0, 80),
        })
      }
    }
    if (block.type === PREMIUM_BLOCK_TYPE.CHART && !hasChartEmbeddedSource(block.option)) {
      violations.push({
        code: 'ungrounded_viz',
        message: 'chart missing live dataset source',
        evidence: block.id,
      })
    }
  }

  return fail(dedupeViolations(violations), dedupeViolations(warnings))
}

export const auditArtifactHtml = (
  html: string,
  input: GroundingAuditInput,
  scope?: GroundingScope | null
): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
  const warnings: GroundingViolation[] = []
  const resolved = resolveGroundingAuditHtml(html, scope)
  const plain = htmlToPlain(
    resolved.html.replace(
      /<(aside|section|div)\b[^>]*(?:data-mauna-coach-brief=["']1["']|class=["'][^"']*coach-brief[^"']*["'])[^>]*>[\s\S]*?<\/\1>/gi,
      ' '
    )
  )
  if (!plain) return fail(violations)

  const allowedAthletes = collectGroundedAthleteNames(input.roster, input.datasets)
  for (const name of captionUnknownAthletes(plain, allowedAthletes, athleteCaptionOptions(input))) {
    violations.push({
      code: 'athlete_unknown',
      message: 'HTML cites athlete outside roster ∪ dataset athletes',
      evidence: name,
    })
  }

  if (!input.allowNutritionScope && NUTRITION_PROSE_RE.test(plain)) {
    warnings.push({
      code: 'nutrition_out_of_scope',
      message: 'HTML nutrition/product prose denied unless coach asked',
    })
  }

  if (input.wellnessScales?.length) {
    for (const claim of findWellnessScaleClaims(plain)) {
      if (!scaleClaimMatchesClub(claim, input.wellnessScales)) {
        violations.push({
          code: 'wellness_scale',
          message: 'wellness min/max claim outside club scales',
          evidence: `${claim.min}-${claim.max}`,
        })
      }
    }
  }

  const factsStrict = !input.skipLiteralFactGate && Boolean(input.enforceLiteralFactGate)
  if (factsStrict) {
    const proseHtml = resolved.html
      .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    const literalHits = isReportV4GroundingTokenizerEnabled()
      ? scanToLiteralViolations(
          scanNumbers(proseHtml, {
            facts: input.facts,
            language: input.groundingLanguage ?? 'en',
            displayRange: input.displayRange,
            wellnessScales: input.wellnessScales,
            factThresholds: input.facts?.flatMap((f) => f.thresholds ?? []),
            properNames: [
              ...(input.properNames ?? []),
              ...(input.clubName ? [input.clubName] : []),
            ],
            jerseyNumbers: input.jerseyNumbers,
          })
        )
      : auditLiteralNumbersOutsideFacts(proseHtml)
    violations.push(...literalHits)
  } else {
    const numberIndex = buildGroundedNumberIndex(input.datasets, input.document)
    if (numberIndex.global.size > 0) {
      for (const hit of auditNumericClaims(
        extractNumericClaimsFromText(plain, numberIndex),
        numberIndex
      )) {
        if (hit.code === 'numeric_ungrounded') warnings.push(hit)
        else violations.push(hit)
      }
    }
  }

  const dedupedViolations = dedupeViolations(violations)
  const dedupedWarnings = dedupeViolations(warnings)
  const result = fail(dedupedViolations, dedupedWarnings)
  if (factsStrict && dedupedViolations.some((row) => row.code === 'literal_number')) {
    const repaired = repairLiteralNumberSentencesInHtml(resolved.html)
    if (repaired.stripped > 0) result.repairedHtml = repaired.html
  }
  return result
}

export const stripUngroundedVizBlocks = (
  document: PremiumReportDocument
): { document: PremiumReportDocument; strippedIds: string[] } => {
  const strippedIds: string[] = []
  const blocks = document.blocks.filter((block) => {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART && !hasChartEmbeddedSource(block.option)) {
      strippedIds.push(block.id)
      return false
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE && block.rows.length === 0) {
      strippedIds.push(block.id)
      return false
    }
    return true
  })
  document.blocks = blocks
  return { document, strippedIds }
}

export const stripNutritionProseFromDocument = (
  document: PremiumReportDocument,
  allowNutritionScope: boolean
): number => {
  if (allowNutritionScope) return 0
  let stripped = 0
  document.blocks = document.blocks.filter((block) => {
    if (block.type !== PREMIUM_BLOCK_TYPE.TEXT && block.type !== PREMIUM_BLOCK_TYPE.HEADING) {
      return true
    }
    if (!NUTRITION_PROSE_RE.test(block.text)) return true
    stripped += 1
    return false
  })
  return stripped
}

type SectionDomain = 'nutrition' | 'wellness' | 'biomarkers' | 'gps' | 'other'

const isNutritionHeading = (text: string): boolean =>
  NUTRITION_PROSE_RE.test(text) || /\b(composition|ingredients?|label|product)\b/i.test(text)

const BIOMARKER_BODY_RE =
  /\bbiomarkers?\b|\bcmj(?:_score)?\b|\bvald\b|\bck\b|\bbody.?fat\b|\bdiagnostik\b|\brsi_score\b/i

const WELLNESS_BODY_RE =
  /\bwellness\b|\bbody.?soreness\b|\bmood(?:_rating)?\b|\bsleep.?quality\b|\bstress(?:_rating)?\b|\benergy(?:_rating)?\b|\bsubjective\b/i

const GPS_BODY_RE =
  /\btotal_distance|distance_m|hmld|hsr|sprint|player.?load|explosive.?distance|abs(?:olute)?.?distance|gps\b/i

const tagHeadingDomain = (text: string): SectionDomain => {
  if (isNutritionHeading(text)) return 'nutrition'
  if (/\bbiomarkers?\b/i.test(text)) return 'biomarkers'
  if (/\bwellness\b|\bsubjective\b/i.test(text)) return 'wellness'
  if (/\bgps\b|external.?load|distance|hmld|hsr/i.test(text)) return 'gps'
  return 'other'
}

const tagBodyDomain = (blob: string): SectionDomain => {
  if (NUTRITION_PROSE_RE.test(blob)) return 'nutrition'
  const bioHits = blob.match(BIOMARKER_BODY_RE)?.length ?? 0
  const welHits = blob.match(WELLNESS_BODY_RE)?.length ?? 0
  const gpsHits = blob.match(GPS_BODY_RE)?.length ?? 0
  const ranked = (
    [
      { domain: 'biomarkers' as const, hits: bioHits },
      { domain: 'wellness' as const, hits: welHits },
      { domain: 'gps' as const, hits: gpsHits },
    ] satisfies Array<{ domain: SectionDomain; hits: number }>
  ).sort((a, b) => b.hits - a.hits)
  const top = ranked[0]
  if (top && top.hits > 0) return top.domain
  return 'other'
}

type SectionSpan = { headingIdx: number; contentIdxs: number[] }

const sectionSpansFromBlocks = (blocks: PremiumReportDocument['blocks']): SectionSpan[] => {
  const spans: SectionSpan[] = []
  let current: SectionSpan | null = null
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (!block) continue
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING) {
      current = { headingIdx: i, contentIdxs: [] }
      spans.push(current)
      continue
    }
    if (current) current.contentIdxs.push(i)
  }
  return spans
}

const sectionContentBlob = (blocks: PremiumReportDocument['blocks'], idxs: number[]): string =>
  idxs
    .map((i) => {
      const block = blocks[i]
      if (!block) return ''
      if (block.type === PREMIUM_BLOCK_TYPE.TEXT) return block.text
      if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
        return `${block.title ?? ''} ${block.columns.join(' ')}`
      }
      if (block.type === PREMIUM_BLOCK_TYPE.CHART) return block.title ?? ''
      return ''
    })
    .join('\n')

const sectionsAreCrossed = (
  headingLeft: SectionDomain,
  bodyLeft: SectionDomain,
  headingRight: SectionDomain,
  bodyRight: SectionDomain
): boolean => {
  if (
    headingLeft !== 'nutrition' &&
    bodyLeft === 'nutrition' &&
    headingRight === 'nutrition' &&
    bodyRight !== 'nutrition'
  ) {
    return true
  }
  if (
    headingLeft === 'other' ||
    headingRight === 'other' ||
    bodyLeft === 'other' ||
    bodyRight === 'other'
  ) {
    return false
  }
  return headingLeft === bodyRight && headingRight === bodyLeft && headingLeft !== headingRight
}

const swapAdjacentSectionContents = (
  blocks: PremiumReportDocument['blocks'],
  left: SectionSpan,
  right: SectionSpan
): PremiumReportDocument['blocks'] => {
  const prefix = blocks.slice(0, left.headingIdx + 1)
  const leftHeading = blocks[left.headingIdx]
  const rightHeading = blocks[right.headingIdx]
  if (!leftHeading || !rightHeading) return blocks
  const leftContent = left.contentIdxs.map((i) => blocks[i]!).filter(Boolean)
  const rightContent = right.contentIdxs.map((i) => blocks[i]!).filter(Boolean)
  const suffixStart =
    right.contentIdxs.length > 0
      ? (right.contentIdxs[right.contentIdxs.length - 1] ?? right.headingIdx) + 1
      : right.headingIdx + 1
  const suffix = blocks.slice(suffixStart)
  return [...prefix, ...rightContent, rightHeading, ...leftContent, ...suffix]
}

export const realignCrossedSectionProse = (document: PremiumReportDocument): number => {
  let swaps = 0
  for (let guard = 0; guard < 8; guard += 1) {
    const spans = sectionSpansFromBlocks(document.blocks)
    let swapped = false
    for (let i = 0; i < spans.length - 1; i += 1) {
      const left = spans[i]
      const right = spans[i + 1]
      if (!left || !right) continue
      if (left.contentIdxs.length === 0 && right.contentIdxs.length === 0) continue
      const leftHeading = document.blocks[left.headingIdx]
      const rightHeading = document.blocks[right.headingIdx]
      if (
        leftHeading?.type !== PREMIUM_BLOCK_TYPE.HEADING ||
        rightHeading?.type !== PREMIUM_BLOCK_TYPE.HEADING
      ) {
        continue
      }
      const hL = tagHeadingDomain(leftHeading.text)
      const hR = tagHeadingDomain(rightHeading.text)
      const bL = tagBodyDomain(sectionContentBlob(document.blocks, left.contentIdxs))
      const bR = tagBodyDomain(sectionContentBlob(document.blocks, right.contentIdxs))
      if (!sectionsAreCrossed(hL, bL, hR, bR)) continue
      document.blocks = swapAdjacentSectionContents(document.blocks, left, right)
      swaps += 1
      swapped = true
      break
    }
    if (!swapped) break
  }
  return swaps
}

export const stripNutritionProseFromHtml = (
  html: string,
  allowNutritionScope: boolean
): { html: string; stripped: number } => {
  if (allowNutritionScope) return { html, stripped: 0 }
  let stripped = 0
  const next = html.replace(
    /<(p|li|h[1-6]|div|section|article)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (full) => {
      const plain = htmlToPlain(full)
      if (!NUTRITION_PROSE_RE.test(plain)) return full
      stripped += 1
      return ''
    }
  )
  return { html: next.replace(/\n{3,}/g, '\n\n'), stripped }
}

export const buildGroundingAuditInput = (args: {
  roster: RosterAthlete[]
  state: PremiumReportState
  allowNutritionScope: boolean
  wellnessScales?: GroundingWellnessScale[]
  clubName?: string
}): GroundingAuditInput => ({
  roster: args.roster,
  datasets: [...args.state.datasets.values()],
  document: args.state.document,
  allowNutritionScope: args.allowNutritionScope,
  harvestHasRows: harvestHasUsableDatasets(args.state),
  wellnessScales: args.wellnessScales,
  clubName: args.clubName,
})

export const formatGroundingNudge = (result: GroundingAuditResult): string => {
  const lines = result.violations
    .slice(0, 8)
    .map((v) =>
      v.evidence ? `${v.code}: ${v.message} (${v.evidence})` : `${v.code}: ${v.message}`
    )
  return [
    'GROUNDING REJECT — fix with tools, then retry. Cite only roster ∪ dataset athletes, live dataset columns, and KPI numbers from columnStats/table/chart series. No invented nutrition/product prose.',
    ...lines,
  ].join(' ')
}

export const gateDeterministicCaption = (
  text: string,
  allowedAthletes: string[],
  allowNutritionScope = false
): string | null => {
  const unknown = captionUnknownAthletes(text, allowedAthletes)
  if (unknown.length) {
    return JSON.stringify({
      error: 'Caption rejected: cites athletes outside roster ∪ dataset athletes',
      unknownAthletes: unknown.slice(0, 8),
      hint: 'Cite only names on the nearby chart/table or skip add_text.',
    })
  }
  if (!allowNutritionScope && NUTRITION_PROSE_RE.test(text)) {
    return JSON.stringify({
      error: 'Caption rejected: nutrition/product prose not allowed on monitoring canvas',
      hint: 'Keep captions on load/GPS/wellness/sleep metrics from live datasets.',
    })
  }
  return null
}

const auditAnalystGrounding = (args: {
  brief: ReportBrief | null
  document: PremiumReportDocument
  input: GroundingAuditInput
  requireBrief: boolean
}): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
  const warnings: GroundingViolation[] = []
  if (args.requireBrief && args.input.harvestHasRows && !args.brief) {
    violations.push({
      code: 'brief_missing',
      message: 'commit_report_brief required when harvest has rows',
    })
  }
  if (args.brief) {
    const briefResult = auditReportBrief(args.brief, {
      ...args.input,
      harvestHasRows: false,
    })
    violations.push(...briefResult.violations)
    warnings.push(...(briefResult.warnings ?? []))
  }
  const canvas = auditCanvasDocument(args.document, args.input)
  if (args.input.harvestHasRows) {
    violations.push(...canvas.violations)
    warnings.push(...(canvas.warnings ?? []))
  } else {
    violations.push(...canvas.violations.filter((v) => v.code === 'athlete_unknown'))
    warnings.push(
      ...(canvas.warnings ?? []).filter((v) => v.code === 'nutrition_out_of_scope')
    )
  }
  return fail(dedupeViolations(violations), dedupeViolations(warnings))
}

export const rejectAnalystUngroundedEndTurn =
  (args: {
    getBrief: () => ReportBrief | null
    roster: RosterAthlete[]
    allowNutritionScope: boolean
    requireBrief: boolean
    clubName?: string
  }) =>
  (state: PremiumReportState): string | null => {
    const input = buildGroundingAuditInput({
      roster: args.roster,
      state,
      allowNutritionScope: args.allowNutritionScope,
      clubName: args.clubName,
    })
    const result = auditAnalystGrounding({
      brief: args.getBrief(),
      document: state.document,
      input,
      requireBrief: args.requireBrief,
    })
    if (result.ok) return null
    return formatGroundingNudge(result)
  }
