import {
  REPORT_V4_MAX_BLOCKS,
  REPORT_V4_MAX_CHARTS,
} from '#services/report_v4/report_v4_constants'
import { clonePremiumDocument } from '#services/premium_report/premium_report_document'
import { emptyUsage } from '#services/premium_report/premium_report_agent'
import { COACH_REPORT_SHAPE } from '#services/report_v4/coach_policy_heuristic'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { DomainPlan } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'
import type { MainPipelineContext } from '#services/report_v4/orchestrator/types'
import type { SubjectiveScaleService } from '#services/subjective_scale_service'
import { projectHeatScalesFromCatalogue } from '#services/report_v4/agents/stage_tools'

type WellnessCatalogue = Awaited<ReturnType<InstanceType<typeof SubjectiveScaleService>['getClubCatalogue']>>

export const buildPipelineAgentState = (
  ctx: MainPipelineContext & { plan: DomainPlan },
  wellnessCatalogue: WellnessCatalogue,
  priorHtml: string | null
): { agentState: PremiumReportState; run: ReportV4RunState; roster: ReportV4RunState['roster']; athletes: { id: string; name: string }[] } => {
  const { args, framed } = ctx
  const { edit, preserveCanvas, athleteIds, displayRange, fetchRange, coverRange, domainRanges, fetchWindows, rosterAll, club } = framed
  const { policy, route, artifactEnvelope, document, priorBlockIds, softAllowBlockIds } = ctx.plan

  const heatScales = projectHeatScalesFromCatalogue(wellnessCatalogue)
  const roster = rosterAll.map((row) => ({ ...row, photoUrl: null as null }))
  route.includePhotos = false
  const athletes = roster.map((row) => ({ id: row.id, name: row.name }))

  const agentState: PremiumReportState = {
    document: clonePremiumDocument(document),
    datasets: new Map(),
    defaultAfter: 'end',
    dateRange: { from: displayRange.from, to: displayRange.to },
    displayRange: { from: displayRange.from, to: displayRange.to },
    fetchRange: { from: fetchRange.from, to: fetchRange.to },
    coverRange: { from: coverRange.from, to: coverRange.to },
    domainRanges,
    fetchWindows,
    clubId: args.clubId,
    athleteIds,
    language: args.language,
    heatScales,
    sqlFailures: new Map(),
    blockSql: false,
    toolHistory: [],
    harvestTried: [],
    jevValidations: 0,
    jevBlocked: 0,
    requestPrompt: args.prompt,
    coachPrompt: args.prompt,
    loadFlag: policy.loadFlag,
    canvasAsk: edit.canvasAsk,
    intent: route.intent,
    mustUseTools: true,
    explanationAsk: false,
    softPreserveCanvas: preserveCanvas,
    softLockedBlockIds: preserveCanvas ? priorBlockIds : undefined,
    softAllowBlockIds,
    templateMetaCache: new Map(),
    limits: {
      maxCharts: REPORT_V4_MAX_CHARTS,
      maxBlocks: REPORT_V4_MAX_BLOCKS,
      skipTextCaptionJev: true,
      deterministicCaptionGate: true,
      requireLiveDatasetId: true,
      allowNutritionScope: policy.allowNutritionScope,
      groundedAthleteNames: roster.map((row) => row.name),
      individualLinesAsk:
        artifactEnvelope.coverage.individualSheets ||
        policy.reportShape === COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS,
      dropEmptyDaysDefault: artifactEnvelope.chartDefaults.dropEmptyDays,
      markLineValuesDefault: artifactEnvelope.chartDefaults.markLineValues,
    },
  }

  const run: ReportV4RunState = {
    route,
    roster,
    agentState,
    reportBrief: null,
    facts: new Map(),
    htmlArtifact: priorHtml,
    document: agentState.document,
    usage: emptyUsage(),
    iterationSecs: [],
    iterationCosts: [],
    iterations: 0,
    allowNutritionScope: policy.allowNutritionScope,
    clubName: club.name,
  }

  return { agentState, run, roster, athletes }
}
