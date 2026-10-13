import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { hasChartEmbeddedSource } from '#services/premium_report/premium_report_document'
import { captionUnknownAthletes } from '#services/premium_report/canvas_athletes'
import type {
  GroundingAuditInput,
  GroundingAuditResult,
  GroundingViolation,
} from '#services/report_v4/grounding_types'
import {
  athleteCaptionOptions,
  dedupeViolations,
  fail,
  findWellnessScaleClaims,
  htmlToPlain,
  NUTRITION_PROSE_RE,
  scaleClaimMatchesClub,
} from '#services/report_v4/grounding_shared'
import {
  auditNumericClaims,
  buildGroundedNumberIndex,
  extractNumericClaimsFromText,
} from '#services/report_v4/grounding_numeric'
import { collectGroundedAthleteNames } from '#services/report_v4/grounding_brief'
import {
  resolveGroundingAuditHtml,
  type GroundingScope,
} from '#services/report_v4/grounding_scope'
import {
  auditLiteralNumbersOutsideFacts,
  isReportV4DataFactsEnabled,
} from '#services/report_v4/report_facts'
import { REPORT_V4_DATA_FACTS_STRICT_HTML } from '#services/report_v4/report_v4_constants'
import {
  isReportV4GroundingTokenizerEnabled,
  scanNumbers,
  scanToLiteralViolations,
} from '#services/report_v4/grounding_tokenizer'

export const auditArtifactHtml = (
  html: string,
  input: GroundingAuditInput,
  scope?: GroundingScope | null
): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
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
    violations.push({
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

  const factsStrict =
    isReportV4DataFactsEnabled() &&
    REPORT_V4_DATA_FACTS_STRICT_HTML &&
    !input.skipLiteralFactGate &&
    Boolean(input.enforceLiteralFactGate)
  if (factsStrict) {
    const proseHtml = resolved.html
      .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    if (isReportV4GroundingTokenizerEnabled()) {
      const scan = scanNumbers(proseHtml, {
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
      violations.push(...scanToLiteralViolations(scan))
    } else {
      violations.push(...auditLiteralNumbersOutsideFacts(proseHtml))
    }
  } else {
    const numberIndex = buildGroundedNumberIndex(input.datasets, input.document)
    if (numberIndex.global.size > 0) {
      violations.push(
        ...auditNumericClaims(extractNumericClaimsFromText(plain, numberIndex), numberIndex)
      )
    }
  }

  return fail(dedupeViolations(violations))
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

type SectionDomain = 'nutrition' | 'wellness' | 'biomarkers' | 'other'

const isNutritionHeading = (text: string): boolean =>
  NUTRITION_PROSE_RE.test(text) || /\b(composition|ingredients?|label|product)\b/i.test(text)

const BIOMARKER_BODY_RE =
  /\bbiomarkers?\b|\bcmj(?:_score)?\b|\bvald\b|\bck\b|\bbody.?fat\b|\bdiagnostik\b|\brsi_score\b/i

const WELLNESS_BODY_RE =
  /\bwellness\b|\bbody.?soreness\b|\bmood(?:_rating)?\b|\bsleep.?quality\b|\bstress(?:_rating)?\b|\benergy(?:_rating)?\b|\bsubjective\b/i

const tagHeadingDomain = (text: string): SectionDomain => {
  if (isNutritionHeading(text)) return 'nutrition'
  if (/\bbiomarkers?\b/i.test(text)) return 'biomarkers'
  if (/\bwellness\b|\bsubjective\b/i.test(text)) return 'wellness'
  return 'other'
}

const tagBodyDomain = (blob: string): SectionDomain => {
  if (NUTRITION_PROSE_RE.test(blob)) return 'nutrition'
  const bioHits = blob.match(BIOMARKER_BODY_RE)?.length ?? 0
  const welHits = blob.match(WELLNESS_BODY_RE)?.length ?? 0
  if (bioHits > welHits && bioHits > 0) return 'biomarkers'
  if (welHits > bioHits && welHits > 0) return 'wellness'
  if (bioHits > 0) return 'biomarkers'
  if (welHits > 0) return 'wellness'
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
