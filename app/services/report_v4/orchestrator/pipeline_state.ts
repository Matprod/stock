import { PREMIUM_REPORT_HISTORY_MAX } from '#constants/premium_report.constants'
import type { PremiumAgentIterationEvent } from '#services/premium_report/premium_report_agent'
import {
  REPORT_V4_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT,
  REPORT_V4_ANALYST_MAX_ITERATIONS,
  REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT,
  REPORT_V4_ANALYST_MIN_ITERATIONS,
  REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP,
  REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT,
  REPORT_V4_LEAN_WINDOW_DAYS,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT,
  REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS,
  REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS,
} from '#services/report_v4/report_v4_constants'
import {
  formatClubSubjectiveScalesBrief,
  projectSubjectiveScalesForProfiler,
} from '#services/report_v4/agents/stage_tools'
import { SubjectiveScaleService } from '#services/subjective_scale_service'
import {
  analystIterationBudget,
  resolvePathCostClass,
} from '#services/report_v4/artifact_runtime/index'
import {
  logReportV4Iteration,
  type PremiumReportTokenUsage,
} from '#services/premium_report/premium_report_log'
import type {
  ReportRunAgentCost,
  ReportRunJournalEntry,
} from '#services/report_v4/run_journal'
import { Exception } from '@adonisjs/core/exceptions'
import { randomUUID } from 'node:crypto'
import type { MainPipelineContext } from '#services/report_v4/orchestrator/types'
import type { DomainPlan } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'
import type { SoftEditPath, SoftRefusal } from '#services/report_v4/soft_refusal'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import { evaluateCoverageGate } from '#services/report_v4/artifact_runtime/index'
import {
  compactDataProfileForLlm,
  type HarvestDataProfile,
} from '#services/report_v4/data_profiler'
import { collectArtifactCharts } from '#services/report_v4/artifact_html'
import type { ClubInsightScience } from '#services/report_v4/club_insight_science'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { createDbTool } from '#services/agent_db_tool'
import type { clubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import type { probeRpeSources } from '#services/premium_report/rpe_source_probe'
import { buildPipelineAgentState } from '#services/report_v4/orchestrator/steps/init_pipeline_agent'
import { loadPipelineCatalog } from '#services/report_v4/orchestrator/steps/init_pipeline_catalog'
import { projectHeatScalesFromCatalogue } from '#services/report_v4/agents/stage_tools'
import { resolveRequestedMeasure } from '#services/report_v4/request/requested_measure'
import logger from '@adonisjs/core/services/logger'

export type PipelineState = {
  ctx: MainPipelineContext & { plan: DomainPlan }
  priorHtml: string | null
  needsFreshArtifact: boolean
  softRebindRepair: boolean
  softEditorialAppliedEarly: boolean
  softApplied: string[]
  softBlocked: string[]
  softCoachMessage: string | undefined
  softEditPath: SoftEditPath | undefined
  softRefusals: SoftRefusal[]
  coverageGateResult: ReturnType<typeof evaluateCoverageGate>
  acwrHarvestStatus: 'ok' | 'pending' | 'empty_declared' | null
  harvestDataProfile: HarvestDataProfile | null
  imputedMarkSummary: import('#services/report_v4/imputed_cells').ImputedMarkSummary | null
  dataProfileHint: string | undefined
  dataProfilePacket: ReturnType<typeof compactDataProfileForLlm> | null
  softProseOnly: boolean
  recommendationStrip: boolean | undefined
  skipAnalystForSoftEditorial: boolean
  skipAnalystForSoftOps: boolean
  skipAnalystForSoftPath: boolean
  pathCostClass: ReturnType<typeof resolvePathCostClass>
  chartCount: number
  charts: ReturnType<typeof collectArtifactCharts>
  run: ReportV4RunState
  agentState: PremiumReportState
  heatScales: PremiumReportState['heatScales']
  wellnessCatalogue: Awaited<
    ReturnType<InstanceType<typeof SubjectiveScaleService>['getClubCatalogue']>
  >
  subjectiveScalesLine: string
  subjectiveScalesForProfiler: ReturnType<typeof projectSubjectiveScalesForProfiler>
  roster: ReportV4RunState['roster']
  athletes: { id: string; name: string }[]
  analystMinIterations: number
  analystMaxIterations: number
  analystForceAnswerAt: number
  makeDbTool: (envelope: string) => Promise<Awaited<ReturnType<typeof createDbTool>>>
  catalog: Awaited<ReturnType<typeof clubMetricCatalog>>
  periodKpis: Awaited<ReturnType<typeof clubMetricCatalog>>['periodKpis']
  rpeProbe: Awaited<ReturnType<typeof probeRpeSources>>
  clubInsightScience: ClubInsightScience[]
  clubInsightScienceHint: string
  metricWhitelist: string[]
  formulaIds: string[]
  schemaTitles: string[]
  history: import('#contracts/premium_report').PremiumReportHistoryTurn[]
  onIteration: (stage: string) => (event: PremiumAgentIterationEvent) => void
  sumSecs: (stage: string) => number
  runId: string
  agentCosts: ReportRunAgentCost[]
  journal: ReportRunJournalEntry[]
  recordAgentCost: (entry: {
    agent: string
    iterations: number
    durationSec: number
    usage: PremiumReportTokenUsage
    detail?: string
  }) => void
}

export const initPipelineState = async (ctx: MainPipelineContext): Promise<PipelineState> => {
  if (!ctx.plan) {
    throw new Exception('runMainPipeline requires DomainPlan', { status: 500 })
  }
  const planRaw = ctx.plan
  const { args, framed } = ctx
  const { preserveCanvas, needsFetch } = framed
  const { daySpan, policy, route, useShortDepth, artifactEnvelope } = planRaw

  const agentCosts: ReportRunAgentCost[] = []
  const journal: ReportRunJournalEntry[] = []
  const recordAgentCost = (entry: {
    agent: string
    iterations: number
    durationSec: number
    usage: PremiumReportTokenUsage
    detail?: string
  }) => {
    agentCosts.push(entry)
    journal.push({
      at: new Date().toISOString(),
      level: 'info',
      message: `agent_total:${entry.agent}`,
      data: {
        iterations: entry.iterations,
        durationSec: entry.durationSec,
        estimatedCostUsd: entry.usage.estimatedCostUsd,
        detail: entry.detail ?? null,
      },
    })
  }

  const state = {
    ctx: { ...ctx, plan: planRaw },
    priorHtml: framed.priorHtml,
    needsFreshArtifact: framed.needsFreshArtifact,
    softRebindRepair: framed.softRebindRepair,
    softEditorialAppliedEarly: framed.softEditorialAppliedEarly,
    softApplied: [] as string[],
    softBlocked: [] as string[],
    softCoachMessage: undefined as string | undefined,
    softEditPath: undefined as SoftEditPath | undefined,
    softRefusals: [] as SoftRefusal[],
    coverageGateResult: null as ReturnType<typeof evaluateCoverageGate>,
    acwrHarvestStatus: (artifactEnvelope.harvest.requireLoadDomain ? 'pending' : null) as
      'ok' | 'pending' | 'empty_declared' | null,
    harvestDataProfile: null as HarvestDataProfile | null,
    imputedMarkSummary: null as
      import('#services/report_v4/imputed_cells').ImputedMarkSummary | null,
    dataProfileHint: undefined as string | undefined,
    dataProfilePacket: null as ReturnType<typeof compactDataProfileForLlm> | null,
    softProseOnly: false,
    recommendationStrip: undefined as boolean | undefined,
    skipAnalystForSoftEditorial: false,
    skipAnalystForSoftOps: false,
    skipAnalystForSoftPath: false,
    pathCostClass: 'full' as ReturnType<typeof resolvePathCostClass>,
    chartCount: 0,
    charts: [] as ReturnType<typeof collectArtifactCharts>,
    runId: randomUUID(),
    agentCosts,
    journal,
    recordAgentCost,
  } as PipelineState

  let analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS
  if (preserveCanvas) {
    analystMinIterations = needsFetch ? 2 : REPORT_V4_SOFT_ANALYST_MIN_ITERATIONS
  } else if (
    route.analysisDepth === 'deep' ||
    daySpan > REPORT_V4_LEAN_WINDOW_DAYS ||
    policy.monitoringPlaybook
  ) {
    analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS_DEEP
  } else if (useShortDepth) {
    analystMinIterations = REPORT_V4_ANALYST_MIN_ITERATIONS_SHORT
  }
  let analystMaxIterations = preserveCanvas
    ? needsFetch
      ? REPORT_V4_SOFT_ANALYST_ADDITIVE_MAX_ITERATIONS
      : REPORT_V4_SOFT_ANALYST_MAX_ITERATIONS
    : useShortDepth
      ? REPORT_V4_ANALYST_MAX_ITERATIONS_SHORT
      : REPORT_V4_ANALYST_MAX_ITERATIONS
  let analystForceAnswerAt = preserveCanvas
    ? needsFetch
      ? REPORT_V4_SOFT_ANALYST_ADDITIVE_FORCE_ANSWER_AT
      : REPORT_V4_SOFT_ANALYST_FORCE_ANSWER_AT
    : useShortDepth
      ? REPORT_V4_ANALYST_FORCE_ANSWER_AT_SHORT
      : REPORT_V4_ANALYST_FORCE_ANSWER_AT
  {
    const budget = analystIterationBudget({
      envelope: artifactEnvelope,
      base: {
        min: analystMinIterations,
        max: analystMaxIterations,
        forceAnswerAt: analystForceAnswerAt,
      },
    })
    analystMinIterations = budget.min
    analystMaxIterations = budget.max
    analystForceAnswerAt = budget.forceAnswerAt
  }

  const subjectiveScales = new SubjectiveScaleService()
  const wellnessCatalogue = await subjectiveScales.getClubCatalogue(args.clubId, args.language)
  const heatScales = projectHeatScalesFromCatalogue(wellnessCatalogue)
  const subjectiveScalesLine = formatClubSubjectiveScalesBrief(wellnessCatalogue)
  const subjectiveScalesForProfiler = projectSubjectiveScalesForProfiler(wellnessCatalogue)

  const { agentState, run, roster, athletes } = buildPipelineAgentState(
    { ...ctx, plan: planRaw },
    wellnessCatalogue,
    state.priorHtml
  )

  const catalogData = await loadPipelineCatalog({ ...ctx, plan: planRaw }, run, {
    runId: state.runId,
  })
  planRaw.requestedMeasure = resolveRequestedMeasure({
    prompt: args.prompt,
    catalog: catalogData.catalog,
  })
  if (planRaw.requestedMeasure) {
    logger.info(
      {
        metric: planRaw.requestedMeasure.metric,
        unit: planRaw.requestedMeasure.unit,
        alias: planRaw.requestedMeasure.alias,
        phrase: planRaw.requestedMeasure.phrase,
      },
      'report_v4.requested_measure'
    )
  }

  const history = (args.history ?? []).slice(-PREMIUM_REPORT_HISTORY_MAX)
  const stageSecs: Record<string, number[]> = {}
  const onIteration = (stage: string) => (event: PremiumAgentIterationEvent) => {
    run.iterationSecs.push(event.durationSec)
    run.iterationCosts.push(event.usage.estimatedCostUsd)
    ;(stageSecs[stage] ??= []).push(event.durationSec)
    logReportV4Iteration({
      iteration: event.iteration,
      stopReason: event.stopReason,
      durationSec: event.durationSec,
      usage: event.usage,
      cumulative: event.cumulative,
      tools: event.tools,
      textPreview: `${stage}: ${event.textPreview ?? ''}`,
    })
  }
  const sumSecs = (stage: string): number =>
    Number((stageSecs[stage] ?? []).reduce((a, b) => a + b, 0).toFixed(3))

  Object.assign(state, {
    run,
    agentState,
    heatScales,
    wellnessCatalogue,
    subjectiveScalesLine,
    subjectiveScalesForProfiler,
    roster,
    athletes,
    analystMinIterations,
    analystMaxIterations,
    analystForceAnswerAt,
    ...catalogData,
    metricWhitelist: catalogData.periodKpis.map((k) => k.name),
    history,
    onIteration,
    sumSecs,
  })
  return state
}
