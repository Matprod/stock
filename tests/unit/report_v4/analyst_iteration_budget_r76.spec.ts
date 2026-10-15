import { test } from '@japa/runner'
import { analystIterationBudget } from '#services/report_v4/artifact_runtime/soft_path'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'

const minimalIndividualSheetsEnvelope = (): ArtifactEnvelope => ({
  mode: 'free',
  contracts: {
    athleteCoverage: 'named',
    requiredAthletes: [],
    vizOps: [],
    designOps: [],
    requiredMetrics: [],
    softAllowed: false,
    individualSheets: true,
  },
  chartDefaults: { dropEmptyDays: false, markLineValues: [] },
  coverage: { requiredNames: [], individualSheets: true },
  harvest: { requiredMetrics: [], requireLoadDomain: false },
})

test.group('R7.6 analystIterationBudget', () => {
  test('individualSheets returns base unchanged (no 28/26 bump)', ({ assert }) => {
    const base = { min: 4, max: 22, forceAnswerAt: 14 }
    const budget = analystIterationBudget({
      envelope: minimalIndividualSheetsEnvelope(),
      base,
    })
    assert.deepEqual(budget, base)
    assert.notEqual(budget.max, 28)
    assert.notEqual(budget.forceAnswerAt, 26)
  })
})
