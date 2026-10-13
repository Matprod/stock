import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import { hasChartEmbeddedSource } from '#services/premium_report/premium_report_document'
import {
  canvasAthleteNames,
  captionUnknownAthletes,
} from '#services/premium_report/canvas_athletes'
import { isTeamAggregateSeriesName } from '#services/premium_report/charts/chart_rules'
import { listDatasetAthletes } from '#services/premium_report/charts/dataset_transforms'
import type { ReportBrief } from '#services/report_v4/report_brief'
import type {
  GroundingAuditInput,
  GroundingAuditResult,
  GroundingViolation,
} from '#services/report_v4/grounding_types'
import {
  athleteAllowed,
  athleteCaptionOptions,
  columnAllowed,
  collectDatasetColumns,
  dedupeViolations,
  fail,
  NUTRITION_PROSE_RE,
} from '#services/report_v4/grounding_shared'
import {
  auditNumericClaims,
  buildGroundedNumberIndex,
  extractNumericClaimsFromBrief,
} from '#services/report_v4/grounding_numeric'

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
      violations.push({
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

  return fail(dedupeViolations(violations))
}

export const auditCanvasDocument = (
  document: PremiumReportDocument,
  input: GroundingAuditInput
): GroundingAuditResult => {
  const violations: GroundingViolation[] = []
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
        violations.push({
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

  return fail(dedupeViolations(violations))
}
