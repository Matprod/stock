import { test } from '@japa/runner'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import {
  PREMIUM_TOOL_HISTORY_CAP,
  PREMIUM_TOOL_HISTORY_TRIM,
} from '#constants/premium_report.constants'
import {
  buildHarvestPlan,
  recordHarvestTried,
  verifyHarvestPlan,
} from '#services/report_v4/harvest_plan'
import { ensureMissingDomainNotices } from '#services/report_v4/missing_domain_notice'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import {
  auditCanvasDocument,
  type GroundingAuditInput,
} from '#services/report_v4/grounding_report'

const stubState = (): PremiumReportState => ({
  document: emptyPremiumDocument({ from: '2026-03-01', to: '2026-03-07' }, []),
  datasets: new Map(),
  defaultAfter: 'end',
  dateRange: { from: '2026-03-01', to: '2026-03-07' },
  clubId: 'club-test',
  athleteIds: [],
  language: 'en',
  sqlFailures: new Map(),
  blockSql: false,
  toolHistory: [],
  harvestTried: [],
  jevValidations: 0,
  jevBlocked: 0,
  requestPrompt: 'gps',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
})

test.group('R7.6 §5 harvest empty / match / nutrition', () => {
  test('empty_after_try uses rebased dataset dateRange overlap, not typed mismatch', ({
    assert,
  }) => {
    const state = stubState()
    const plan = buildHarvestPlan([PREMIUM_DOMAIN.GPS], {
      fetches: [{ domain: PREMIUM_DOMAIN.GPS, from: '2026-03-01', to: '2026-03-31' }],
    })
    recordHarvestTried(state, 'fetch_gps_intensity_daily', {
      from: '2026-03-01',
      to: '2026-03-31',
    })
    storeDataset(state, {
      id: 'gps',
      columns: ['joueur', 'total_distance'],
      rows: [{ joueur: 'Ada', total_distance: 5000 }],
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
    })
    const verification = verifyHarvestPlan(state, plan)
    const gps = verification.verdicts.find((row) => row.domain === PREMIUM_DOMAIN.GPS)
    assert.equal(gps?.status, 'rows')
  })

  test('harvestTried survives toolHistory truncation', ({ assert }) => {
    const state = stubState()
    recordHarvestTried(state, 'fetch_gps_intensity_daily', {
      from: '2026-03-01',
      to: '2026-03-07',
    })
    for (let i = 0; i < PREMIUM_TOOL_HISTORY_CAP + 5; i += 1) {
      state.toolHistory.push({
        name: `add_chart_${i}`,
        input: {},
        timestamp: Date.now(),
      })
    }
    state.toolHistory = state.toolHistory.slice(-PREMIUM_TOOL_HISTORY_TRIM)
    assert.isFalse(
      state.toolHistory.some((row) => row.name === 'fetch_gps_intensity_daily')
    )
    assert.isTrue(
      state.harvestTried.some((row) => row.name === 'fetch_gps_intensity_daily')
    )
    const plan = buildHarvestPlan([PREMIUM_DOMAIN.GPS], {
      fetches: [{ domain: PREMIUM_DOMAIN.GPS, from: '2026-03-01', to: '2026-03-07' }],
    })
    storeDataset(state, {
      id: 'gps',
      columns: ['joueur', 'total_distance'],
      rows: [{ joueur: 'Ada', total_distance: 5000 }],
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
    })
    const verification = verifyHarvestPlan(state, plan)
    assert.equal(
      verification.verdicts.find((row) => row.domain === PREMIUM_DOMAIN.GPS)?.status,
      'rows'
    )
  })

  test('match requested with empty data inserts one notice line', ({ assert }) => {
    const document = emptyPremiumDocument({ from: '2026-03-01', to: '2026-03-07' }, [])
    const result = ensureMissingDomainNotices({
      document,
      domains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.MATCH],
      emptyDomains: [PREMIUM_DOMAIN.MATCH],
    })
    assert.deepEqual(result.inserted, [PREMIUM_DOMAIN.MATCH])
    const texts = result.document.blocks.filter((b) => b.type === 'text')
    assert.lengthOf(texts, 1)
    assert.equal(
      texts[0] && texts[0].type === 'text' ? texts[0].text : '',
      'No match data for the selected period.'
    )
    const again = ensureMissingDomainNotices({
      document: result.document,
      domains: [PREMIUM_DOMAIN.MATCH],
      emptyDomains: [PREMIUM_DOMAIN.MATCH],
    })
    assert.deepEqual(again.inserted, [])
  })

  test('nutrition_out_of_scope warns once', ({ assert }) => {
    const input: GroundingAuditInput = {
      roster: [{ name: 'Ada Lovelace' }],
      datasets: [],
      allowNutritionScope: false,
      harvestHasRows: true,
    }
    const document = {
      ...emptyPremiumDocument({ from: '2026-03-01', to: '2026-03-07' }, []),
      blocks: [
        {
          id: 't1',
          type: PREMIUM_BLOCK_TYPE.TEXT,
          text: 'Ada Lovelace drank a Monster energy drink with high protein macros.',
        },
        {
          id: 't2',
          type: PREMIUM_BLOCK_TYPE.TEXT,
          text: 'Also discussed Red Bull caffeine and supplement macros.',
        },
      ],
    }
    const result = auditCanvasDocument(document, input)
    assert.isTrue(result.ok)
    const nutrition = (result.warnings ?? []).filter((v) => v.code === 'nutrition_out_of_scope')
    assert.lengthOf(nutrition, 1)
  })
})
