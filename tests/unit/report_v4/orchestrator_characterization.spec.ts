import { test } from '@japa/runner'
import logger from '@adonisjs/core/services/logger'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import type { PremiumReportDocumentDraft } from '#contracts/premium_report'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import {
  COACH_LOAD_FLAG,
  COACH_REPORT_SHAPE,
  finalizePolicy,
} from '#services/report_v4/coach_policy_heuristic'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import type { ReportV4OrchestratorResult } from '#services/report_v4/orchestrator/types'
import { emptyUsage } from '#services/premium_report/premium_report_agent'
import { runReportV4Orchestrator } from '#services/report_v4/report_v4_orchestrator'
import { skippedReportV4Route } from '#services/report_v4/report_v4_router'
import type { PromptWindows } from '#services/report_v4/prompt_scope'
import type { SoftEditOpsPlan } from '#services/report_v4/soft_edit_ops'
import type { IntentProvider } from '#services/report_v4/jev_guard'

const RANGE = { from: '2026-03-01', to: '2026-03-07' }

const windows = (explicit: boolean): PromptWindows => ({
  display: RANGE,
  byDomain: { [PREMIUM_DOMAIN.LOAD]: RANGE },
  fetches: [{ domain: PREMIUM_DOMAIN.LOAD, from: RANGE.from, to: RANGE.to }],
  extraRanges: [],
  cover: RANGE,
  explicit,
})

const club = { id: 'club-char', name: 'Characterization FC' } as Awaited<
  ReturnType<ReportV4OrchestratorDeps['findClub']>
>

const emptySoftOps = (): SoftEditOpsPlan => ({
  ops: [],
  editorialOnly: true,
  needsAnalyst: false,
  needsFetch: false,
  removeQueries: ['recommendations'],
  ensureToc: false,
  hasDataOps: false,
  restoreSheets: false,
  addSectionProse: false,
  additiveSoft: false,
  layoutRepair: false,
  wantsTeamMean: false,
  enrichExistingCharts: false,
})

const wipePlan = {
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' as const },
  preserveCanvas: false,
  needsFetch: true,
  isMicro: false,
  keepPriorDisplayRange: false,
  provider: 'skip' as const,
  softOps: null,
  routeFlags: {
    wipe: true,
    additive: false,
    scopedPeriod: false,
    design: false,
    aesthetic: false,
    partialProse: false,
    recommendationStrip: false,
  },
}

const softPlan = {
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.MICRO_EDIT, provider: 'skip' as const },
  preserveCanvas: true,
  needsFetch: false,
  isMicro: true,
  keepPriorDisplayRange: true,
  provider: 'skip' as const,
  softOps: emptySoftOps(),
  routeFlags: {
    wipe: false,
    additive: false,
    scopedPeriod: false,
    design: false,
    aesthetic: true,
    partialProse: true,
    recommendationStrip: true,
  },
}

const policy = finalizePolicy({
  excludedDomains: [],
  preferredDomains: [PREMIUM_DOMAIN.LOAD],
  reportShape: COACH_REPORT_SHAPE.FREE,
  loadFlag: COACH_LOAD_FLAG.NONE,
  wantsVald: false,
  wantsMatch: false,
  wantsAvailability: false,
  allowWellnessInference: false,
  allowNutritionScope: false,
  flagsAreDescriptiveOnly: false,
  provider: 'haiku',
  monitoringPlaybookReason: 'char',
})

const softEnvelope = (): ArtifactEnvelope & { intentProvider: IntentProvider } => ({
  mode: 'soft_ops',
  contracts: {
    athleteCoverage: 'team',
    requiredAthletes: [],
    vizOps: [],
    designOps: [],
    requiredMetrics: [],
    softAllowed: true,
    individualSheets: false,
  },
  chartDefaults: { dropEmptyDays: false, markLineValues: [] },
  coverage: { requiredNames: [], individualSheets: false },
  harvest: { requiredMetrics: [], requireLoadDomain: false },
  intentProvider: 'haiku',
})

const freeEnvelope = (): ArtifactEnvelope & { intentProvider: IntentProvider } => ({
  ...softEnvelope(),
  mode: 'free',
  contracts: { ...softEnvelope().contracts, softAllowed: false },
})

const priorHtml = `<!DOCTYPE html><html><head><title>prior</title></head><body data-mauna-artifact-boot="1">
<section class="page"><h1>Prior report</h1><div class="chart-box" id="chart_1"></div>
<script>window.chartsReady=true</script>
${'<!-- pad -->'.repeat(40)}
</body></html>`

const priorDocument = (): PremiumReportDocumentDraft => ({
  title: 'Prior report',
  dateRange: RANGE,
  blocks: [
    { id: 'b1', type: 'heading', level: 1, text: 'Prior report' },
    { id: 'b2', type: 'text', text: 'Recommendations: rest more.' },
  ],
})

const captureReportV4LogTags = () => {
  const tags: string[] = []
  const reasons: string[] = []
  const info = logger.info.bind(logger)
  const warn = logger.warn.bind(logger)
  const record = (payload: unknown, msg?: unknown) => {
    const tag = typeof msg === 'string' ? msg : typeof payload === 'string' ? payload : null
    if (tag?.startsWith('report_v4.')) tags.push(tag)
    if (payload && typeof payload === 'object' && 'reason' in payload) {
      const reason = (payload as { reason?: unknown }).reason
      if (typeof reason === 'string') reasons.push(reason)
    }
  }
  logger.info = ((payload: unknown, msg?: unknown) => {
    record(payload, msg)
    return info(payload as never, msg as never)
  }) as typeof logger.info
  logger.warn = ((payload: unknown, msg?: unknown) => {
    record(payload, msg)
    return warn(payload as never, msg as never)
  }) as typeof logger.warn
  return {
    tags,
    reasons,
    restore: () => {
      logger.info = info
      logger.warn = warn
    },
  }
}

const populatedCoverage = () => ({
  displayRange: RANGE,
  fetchRange: RANGE,
  domainRanges: { [PREMIUM_DOMAIN.LOAD]: RANGE },
  fetches: [{ domain: PREMIUM_DOMAIN.LOAD, from: RANGE.from, to: RANGE.to }],
  domains: [
    {
      domain: PREMIUM_DOMAIN.LOAD,
      daysWithData: 5,
      athletesWithData: 10,
      populated: true,
    },
  ],
  populatedDomains: [PREMIUM_DOMAIN.LOAD],
  emptyDomains: [] as typeof PREMIUM_DOMAIN.LOAD[],
})

const baseDeps = (): Partial<ReportV4OrchestratorDeps> => ({
  findClub: async () => club,
  loadClubSeasons: async () => [],
  loadClubRoster: async () => [],
  analyzeRequest: async () => ({
    windows: windows(true),
    askDomains: [PREMIUM_DOMAIN.LOAD],
    periodFollowUp: false,
    multiSection: false,
    provider: 'heuristic',
  }),
  resolveReportEditPlan: async () => wipePlan,
  resolveCoachPromptPolicy: async () => policy,
  routeReportV4: async () => ({
    ...skippedReportV4Route('mauna'),
    domains: [PREMIUM_DOMAIN.LOAD],
  }),
  resolveArtifactEnvelopeAsync: async () => freeEnvelope(),
  resolveSoftClarify: () => ({
    needsClarify: false,
    confidence: 1,
    reason: 'ok',
    questions: [],
    markdown: '',
  }),
  resolveFreshClarify: () => ({
    needsClarify: false,
    confidence: 1,
    reason: 'ok',
    questions: [],
    markdown: '',
    skipped: true,
    skipReason: 'explicit',
  }),
  runPremiumReportAgent: async () => {
    throw new Error('runPremiumReportAgent must not run in early-exit characterization')
  },
  runSoftRebind: () => {
    throw new Error('runSoftRebind must not run in early-exit characterization')
  },
})

test.group('report_v4 orchestrator characterization', () => {
  test('C1: empty coverage short-circuits to minimal artifact', async ({ assert }) => {
    const log = captureReportV4LogTags()
    let agentCalls = 0
    let softCalls = 0
    try {
      const result = await runReportV4Orchestrator(
        {
          clubId: club!.id,
          prompt: 'Load report for 2026-03-01 to 2026-03-07',
          language: 'en',
        },
        {
          ...baseDeps(),
          resolveFullCoverage: async () => ({
            displayRange: RANGE,
            fetchRange: RANGE,
            domainRanges: {},
            fetches: [],
            domains: [],
            populatedDomains: [],
            emptyDomains: [PREMIUM_DOMAIN.LOAD, PREMIUM_DOMAIN.SCORES],
          }),
          runPremiumReportAgent: async () => {
            agentCalls += 1
            throw new Error('agent')
          },
          runSoftRebind: () => {
            softCalls += 1
            throw new Error('soft')
          },
        }
      )
      assert.equal(agentCalls, 0)
      assert.equal(softCalls, 0)
      assert.isUndefined(result.clarify ?? undefined)
      assert.isTrue(result.html.length > 400)
      assert.include(result.html.toLowerCase(), 'html')
      assert.equal(result.iterations, 0)
      assert.deepEqual(result.coverage.populatedDomains, [])
      assert.include(result.message, 'no populated domain')
      assert.include(log.reasons, 'empty_coverage_short_circuit')
      assert.include(log.tags, 'report_v4.designer_fallback_template')
    } finally {
      log.restore()
    }
  })

  test('C2: fresh clarify ask-gate returns without agent', async ({ assert }) => {
    const log = captureReportV4LogTags()
    let agentCalls = 0
    try {
      const clarifyMarkdown =
        'Before generating, a few points are unclear:\n• The period / dates are not specified.\nClarify in writing what you want — one sentence is enough.'
      const result = await runReportV4Orchestrator(
        {
          clubId: club!.id,
          prompt: 'Give me a staff report',
          language: 'en',
        },
        {
          ...baseDeps(),
          analyzeRequest: async () => ({
            windows: windows(false),
            askDomains: [],
            periodFollowUp: false,
            multiSection: false,
            provider: 'heuristic',
          }),
          resolveFullCoverage: async () => populatedCoverage(),
          resolveFreshClarify: () => ({
            needsClarify: true,
            confidence: 0.4,
            reason: 'missing_period',
            questions: [{ id: 'period', question: 'The period / dates are not specified.' }],
            markdown: clarifyMarkdown,
            skipped: false,
            skipReason: '',
          }),
          runPremiumReportAgent: async () => {
            agentCalls += 1
            throw new Error('agent')
          },
        }
      )
      assert.equal(agentCalls, 0)
      assert.isTrue(result.clarify?.needsClarify)
      assert.equal(result.message, clarifyMarkdown)
      assert.equal(result.iterations, 0)
      assert.equal(result.html, '')
      assert.include(log.tags, 'report_v4.ask_gate')
    } finally {
      log.restore()
    }
  })

  test('C2b: soft clarify ask-gate on preserve canvas', async ({ assert }) => {
    const log = captureReportV4LogTags()
    let agentCalls = 0
    let softCalls = 0
    try {
      const clarifyMarkdown =
        'Before editing the report, I need a quick clarification:\n• I am not sure which chart or section to edit.\nReply in one sentence in the field below.'
      const result = await runReportV4Orchestrator(
        {
          clubId: club!.id,
          prompt: 'Change the chart a bit',
          language: 'en',
          document: priorDocument(),
          html: priorHtml,
        },
        {
          ...baseDeps(),
          resolveReportEditPlan: async () => softPlan,
          resolveArtifactEnvelopeAsync: async () => softEnvelope(),
          resolveSoftClarify: () => ({
            needsClarify: true,
            confidence: 0.3,
            reason: 'soft_targets_unresolved',
            questions: [{ id: 'target', question: 'Which chart?' }],
            markdown: clarifyMarkdown,
          }),
          runPremiumReportAgent: async () => {
            agentCalls += 1
            throw new Error('agent')
          },
          runSoftRebind: () => {
            softCalls += 1
            throw new Error('soft')
          },
        }
      )
      assert.equal(agentCalls, 0)
      assert.equal(softCalls, 0)
      assert.isTrue(result.clarify?.needsClarify)
      assert.equal(result.message, clarifyMarkdown)
      assert.equal(result.pathCostClass, 'editorial')
      assert.include(result.summary?.markdown ?? '', 'clarification')
      assert.include(log.tags, 'report_v4.ask_gate')
    } finally {
      log.restore()
    }
  })

  test('A: full generation with mocked main pipeline', async ({ assert }) => {
    const log = captureReportV4LogTags()
    let pipelineCalls = 0
    let agentCalls = 0
    try {
      const fakeHtml = `${priorHtml.replace('Prior report', 'Staff load report')}`
      const result = await runReportV4Orchestrator(
        {
          clubId: club!.id,
          prompt: 'Load report for 2026-03-01 to 2026-03-07',
          language: 'en',
        },
        {
          ...baseDeps(),
          resolveFullCoverage: async () => populatedCoverage(),
          runPremiumReportAgent: async () => {
            agentCalls += 1
            throw new Error('agent')
          },
        },
        {
          runMainPipeline: async (): Promise<ReportV4OrchestratorResult> => {
            pipelineCalls += 1
            return {
              document: {
                title: 'Staff load report',
                dateRange: RANGE,
                blocks: [
                  { id: 'h1', type: 'heading', level: 1, text: 'Staff load report' },
                  {
                    id: 'c1',
                    type: 'chart',
                    title: 'Load',
                    option: { series: [{ type: 'line', data: [1, 2] }] },
                  },
                ],
              },
              message: 'Report ready.',
              iterations: 3,
              usage: {
                ...emptyUsage(),
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
                estimatedCostUsd: 0.01,
              },
              iterationSecs: [0.1, 0.2, 0.3],
              iterationCosts: [0.001, 0.002, 0.003],
              html: fakeHtml,
              designPack: resolveReportDesignPack('mauna'),
              route: {
                ...skippedReportV4Route('mauna'),
                domains: [PREMIUM_DOMAIN.LOAD],
              },
              sessionFocus: null,
              coverage: {
                displayRange: RANGE,
                fetchRange: RANGE,
                domainRanges: { [PREMIUM_DOMAIN.LOAD]: RANGE },
                domains: populatedCoverage().domains,
                populatedDomains: [PREMIUM_DOMAIN.LOAD],
                emptyDomains: [],
              },
              clarify: null,
              summary: null,
              pathCostClass: 'rebuild',
            }
          },
        }
      )
      assert.equal(pipelineCalls, 1)
      assert.equal(agentCalls, 0)
      assert.isUndefined(result.clarify ?? undefined)
      assert.isTrue(result.html.length > 0)
      assert.isAbove(result.document.blocks.length, 0)
      assert.notInclude(log.reasons, 'soft_truth_escalate')
      assert.include(log.tags, 'report_v4.prompt_windows_resolved')
      assert.include(log.tags, 'report_v4.roster_active_window')
    } finally {
      log.restore()
    }
  })

  test('B: local soft edit with mocked soft pipeline', async ({ assert }) => {
    const log = captureReportV4LogTags()
    let softCalls = 0
    let pipelineCalls = 0
    try {
      const result = await runReportV4Orchestrator(
        {
          clubId: club!.id,
          prompt: 'Remove the recommendations',
          language: 'en',
          document: priorDocument(),
          html: priorHtml,
        },
        {
          ...baseDeps(),
          resolveReportEditPlan: async () => softPlan,
          resolveArtifactEnvelopeAsync: async () => softEnvelope(),
          runSoftRebind: () => {
            softCalls += 1
            throw new Error('soft should be reached only inside pipeline')
          },
        },
        {
          runMainPipeline: async (): Promise<ReportV4OrchestratorResult> => {
            pipelineCalls += 1
            softCalls += 1
            return {
              document: {
                title: 'Prior report',
                dateRange: RANGE,
                blocks: [{ id: 'b1', type: 'heading', level: 1, text: 'Prior report' }],
              },
              message: 'Recommendations removed.',
              iterations: 0,
              usage: emptyUsage(),
              iterationSecs: [],
              iterationCosts: [],
              html: priorHtml.replace('Recommendations: rest more.', ''),
              designPack: resolveReportDesignPack('mauna'),
              route: skippedReportV4Route('mauna'),
              sessionFocus: null,
              coverage: {
                displayRange: RANGE,
                fetchRange: RANGE,
                domainRanges: {},
                domains: [],
                populatedDomains: [],
                emptyDomains: [],
              },
              clarify: null,
              summary: {
                markdown: 'Path: local edit.',
                followUps: [],
                editPath: 'local',
                refusals: [],
              },
              pathCostClass: 'editorial',
            }
          },
        }
      )
      assert.equal(pipelineCalls, 1)
      assert.equal(softCalls, 1)
      assert.equal(result.summary?.editPath, 'local')
      assert.include(result.message, 'Recommendations')
      assert.equal(result.pathCostClass, 'editorial')
      assert.isUndefined(result.clarify ?? undefined)
      void log
    } finally {
      log.restore()
    }
  })
})
