import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  buildAskRequirements,
  evaluateAskContract,
  verifyAskContract,
} from '#services/report_v4/ask_contract'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import {
  COACH_LOAD_FLAG,
  COACH_REPORT_SHAPE,
  type CoachPromptPolicy,
} from '#services/report_v4/coach_policy_heuristic'

const policy = (partial: Partial<CoachPromptPolicy> = {}): CoachPromptPolicy => ({
  excludedDomains: [],
  preferredDomains: [PREMIUM_DOMAIN.WELLNESS, PREMIUM_DOMAIN.SLEEP],
  reportShape: COACH_REPORT_SHAPE.FREE,
  loadFlag: COACH_LOAD_FLAG.NONE,
  wantsVald: false,
  wantsMatch: false,
  wantsAvailability: false,
  allowWellnessInference: true,
  allowNutritionScope: false,
  flagsAreDescriptiveOnly: true,
  sectionOrder: ['Wellness', 'Sommeil'],
  monitoringPlaybook: false,
  acwrWatchlist: false,
  provider: 'haiku',
  monitoringPlaybookReason: 'test',
  ...partial,
})

const envelope = (partial: Partial<ArtifactEnvelope> = {}): ArtifactEnvelope => ({
  mode: 'free',
  contracts: {
    athleteCoverage: 'named',
    requiredAthletes: ['Ada', 'Bea'],
    vizOps: [{ kind: 'mark_lines', values: [0.6, 1.3], metricHint: 'acwr' }],
    designOps: [],
    requiredMetrics: ['acwr_ewma'],
    softAllowed: false,
    individualSheets: true,
  },
  chartDefaults: { dropEmptyDays: false, markLineValues: [0.6, 1.3] },
  coverage: { requiredNames: ['Ada', 'Bea'], individualSheets: true },
  harvest: { requiredMetrics: ['acwr_ewma'], requireLoadDomain: true },
  ...partial,
})

const deliveredDoc = (): PremiumReportDocument => ({
  title: 'Bilan wellness et sommeil',
  dateRange: { from: '2026-01-01', to: '2026-01-14' },
  blocks: [
    { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness équipe', level: 1 },
    {
      id: 'c1',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Ada — ACWR',
      option: {
        series: [{ name: 'Ada', type: 'line', data: [1, 1.1] }],
        yAxis: { markLine: { data: [{ yAxis: 0.6 }, { yAxis: 1.3 }] } },
      },
    },
    { id: 'h2', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Sommeil', level: 1 },
    {
      id: 'c2',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Bea — sleep quality',
      option: { series: [{ name: 'Bea', type: 'line', data: [3, 4] }] },
    },
  ],
})

test.group('ask_contract', () => {
  test('builds requirements from policy and envelope', ({ assert }) => {
    const reqs = buildAskRequirements({
      displayRange: { from: '2026-01-01', to: '2026-01-14' },
      policy: policy(),
      envelope: envelope(),
      domains: [PREMIUM_DOMAIN.WELLNESS],
      minCharts: 2,
    })
    assert.isTrue(reqs.some((row) => row.kind === 'period'))
    assert.isTrue(reqs.some((row) => row.id === 'domain_in:wellness'))
    assert.isTrue(reqs.some((row) => row.id === 'metric:acwr_ewma'))
    assert.isTrue(reqs.some((row) => row.kind === 'athletes'))
    assert.isTrue(reqs.some((row) => row.kind === 'section_order'))
    assert.isTrue(reqs.some((row) => row.kind === 'thresholds'))
    assert.isTrue(reqs.some((row) => row.kind === 'charts'))
  })

  test('marks full delivery in French', ({ assert }) => {
    const report = evaluateAskContract({
      document: deliveredDoc(),
      displayRange: { from: '2026-01-01', to: '2026-01-14' },
      policy: policy({ preferredDomains: [PREMIUM_DOMAIN.WELLNESS, PREMIUM_DOMAIN.SLEEP] }),
      envelope: envelope(),
      domains: [PREMIUM_DOMAIN.WELLNESS, PREMIUM_DOMAIN.SLEEP],
      language: 'fr',
      acwrStatus: 'ok',
      minCharts: 2,
    })
    assert.equal(report.status, 'delivered')
    assert.match(report.message, /livré/i)
  })

  test('signals athlete and ACWR gaps without failing shape', ({ assert }) => {
    const doc: PremiumReportDocument = {
      title: 'Rapport',
      dateRange: { from: '2026-01-01', to: '2026-01-14' },
      blocks: [
        { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness', level: 1 },
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'Mood',
          option: { series: [{ name: 'Ada', type: 'bar', data: [1] }] },
        },
      ],
    }
    const report = verifyAskContract({
      requirements: buildAskRequirements({
        displayRange: { from: '2026-01-01', to: '2026-01-14' },
        policy: policy({ sectionOrder: [] }),
        envelope: envelope(),
        domains: [PREMIUM_DOMAIN.WELLNESS],
        minCharts: 2,
      }),
      document: doc,
      envelope: envelope(),
      acwrStatus: 'empty_declared',
      language: 'fr',
    })
    assert.notEqual(report.status, 'delivered')
    const athletes = report.results.find((row) => row.kind === 'athletes')
    const acwr = report.results.find((row) => row.id === 'metric:acwr_ewma')
    assert.equal(athletes?.status, 'partial')
    assert.equal(acwr?.status, 'missing')
    assert.match(acwr?.reasonFr ?? '', /charge/i)
    assert.match(report.message, /partiel|incomplet/i)
  })

  test('excluded domain still present is missing', ({ assert }) => {
    const doc = deliveredDoc()
    const report = evaluateAskContract({
      document: doc,
      displayRange: { from: '2026-01-01', to: '2026-01-14' },
      policy: policy({
        preferredDomains: [PREMIUM_DOMAIN.WELLNESS],
        excludedDomains: [PREMIUM_DOMAIN.SLEEP],
        sectionOrder: [],
      }),
      envelope: envelope({
        contracts: {
          athleteCoverage: 'team',
          requiredAthletes: [],
          vizOps: [],
          designOps: [],
          requiredMetrics: [],
          softAllowed: true,
          individualSheets: false,
        },
        coverage: { requiredNames: [], individualSheets: false },
        harvest: { requiredMetrics: [], requireLoadDomain: false },
      }),
      domains: [PREMIUM_DOMAIN.WELLNESS],
      language: 'fr',
      minCharts: 0,
    })
    const excluded = report.results.find((row) => row.id === 'domain_out:sleep')
    assert.equal(excluded?.status, 'missing')
  })

  test('section order mismatch is partial', ({ assert }) => {
    const doc: PremiumReportDocument = {
      title: 'Rapport',
      dateRange: { from: '2026-01-01', to: '2026-01-07' },
      blocks: [
        { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Sommeil', level: 1 },
        { id: 'h2', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness', level: 1 },
      ],
    }
    const report = evaluateAskContract({
      document: doc,
      displayRange: { from: '2026-01-01', to: '2026-01-07' },
      policy: policy({
        preferredDomains: [],
        sectionOrder: ['Wellness', 'Sommeil'],
      }),
      envelope: envelope({
        contracts: {
          athleteCoverage: 'team',
          requiredAthletes: [],
          vizOps: [],
          designOps: [],
          requiredMetrics: [],
          softAllowed: true,
          individualSheets: false,
        },
        coverage: { requiredNames: [], individualSheets: false },
        harvest: { requiredMetrics: [], requireLoadDomain: false },
      }),
      domains: [],
      language: 'fr',
      minCharts: 0,
    })
    const order = report.results.find((row) => row.kind === 'section_order')
    assert.equal(order?.status, 'partial')
  })

  test('section order from HTML bands when canvas empty', ({ assert }) => {
    const doc: PremiumReportDocument = {
      title: 'Rapport',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [],
    }
    const html = `<!DOCTYPE html><html><body>
      <div class="band"><h2>Load</h2></div>
      <div class="band"><h2>Wellness</h2></div>
      <div class="band"><h2>Athlete sheets</h2></div>
    </body></html>`
    const report = evaluateAskContract({
      document: doc,
      displayRange: { from: '2026-03-01', to: '2026-03-07' },
      policy: policy({
        preferredDomains: [],
        sectionOrder: ['Load', 'Wellness', 'Athlete sheets'],
      }),
      envelope: envelope({
        contracts: {
          athleteCoverage: 'team',
          requiredAthletes: [],
          vizOps: [],
          designOps: [],
          requiredMetrics: [],
          softAllowed: true,
          individualSheets: false,
        },
        coverage: { requiredNames: [], individualSheets: false },
        harvest: { requiredMetrics: [], requireLoadDomain: false },
      }),
      domains: [],
      language: 'en',
      minCharts: 0,
      htmlArtifact: html,
    })
    const order = report.results.find((row) => row.kind === 'section_order')
    assert.equal(order?.status, 'delivered')
  })

  test('bare ck does not mark biomarkers domain present', ({ assert }) => {
    const doc: PremiumReportDocument = {
      title: 'Rapport',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [
        { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness', level: 1 },
        {
          id: 't1',
          type: PREMIUM_BLOCK_TYPE.TEXT,
          text: 'Check mood and soreness for the squad.',
        },
      ],
    }
    const report = evaluateAskContract({
      document: doc,
      displayRange: { from: '2026-03-01', to: '2026-03-07' },
      policy: policy({
        preferredDomains: [PREMIUM_DOMAIN.WELLNESS],
        excludedDomains: [PREMIUM_DOMAIN.BIOMARKERS],
        sectionOrder: [],
      }),
      envelope: envelope({
        contracts: {
          athleteCoverage: 'team',
          requiredAthletes: [],
          vizOps: [],
          designOps: [],
          requiredMetrics: [],
          softAllowed: true,
          individualSheets: false,
        },
        coverage: { requiredNames: [], individualSheets: false },
        harvest: { requiredMetrics: [], requireLoadDomain: false },
      }),
      domains: [PREMIUM_DOMAIN.WELLNESS],
      language: 'en',
      minCharts: 0,
    })
    const excluded = report.results.find((row) => row.id === 'domain_out:biomarkers')
    assert.equal(excluded?.status, 'delivered')
  })
})
