import type { PremiumReportDocument } from '#contracts/premium_report'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { captionUnknownAthletes } from '#services/premium_report/canvas_athletes'
import type { ReportBrief } from '#services/report_v4/report_brief'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import { harvestHasUsableDatasets } from '#services/report_v4/harvest_plan'
import type {
  GroundingAuditInput,
  GroundingAuditResult,
  GroundingViolation,
  GroundingWellnessScale,
} from '#services/report_v4/grounding_types'
import { dedupeViolations, fail, NUTRITION_PROSE_RE } from '#services/report_v4/grounding_shared'
import { auditCanvasDocument, auditReportBrief } from '#services/report_v4/grounding_brief'

export type {
  GroundingViolationCode,
  GroundingViolation,
  GroundingAuditResult,
  GroundingWellnessScale,
  GroundingAuditInput,
} from '#services/report_v4/grounding_types'

export { collectGroundedAthleteNames, auditReportBrief } from '#services/report_v4/grounding_brief'
export {
  auditArtifactHtml,
  stripUngroundedVizBlocks,
  stripNutritionProseFromDocument,
  stripNutritionProseFromHtml,
  realignCrossedSectionProse,
} from '#services/report_v4/grounding_html'

export {
  detectSoftDeltaGroundingScope,
  extractSoftDeltaHtmlFragments,
  resolveGroundingAuditHtml,
  type GroundingScope,
  type GroundingScopeMode,
} from '#services/report_v4/grounding_scope'

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
  }
  const canvas = auditCanvasDocument(args.document, args.input)
  if (args.input.harvestHasRows) {
    violations.push(...canvas.violations)
  } else {
    violations.push(
      ...canvas.violations.filter(
        (v) => v.code === 'nutrition_out_of_scope' || v.code === 'athlete_unknown'
      )
    )
  }
  return fail(dedupeViolations(violations))
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
