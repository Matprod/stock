import { test } from '@japa/runner'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import {
  harvestHasUsableDatasets,
  hasLinkedData,
} from '#services/report_v4/harvest_plan'
import { storeDataset } from '#services/premium_report/dataset_ops'

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
  requestPrompt: '',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
})

test.group('R7.6 §1 roster harvest exclusion', () => {
  test('roster-only ds_N dataset is not usable harvest / linked data', ({ assert }) => {
    const state = stubState()
    state.datasets.set('ds_1', {
      id: 'ds_1',
      columns: ['athlete_id', 'joueur', 'poste'],
      rows: [
        { athlete_id: 'a1', joueur: 'Ada', poste: 'CM' },
        { athlete_id: 'a2', joueur: 'Bea', poste: 'ST' },
      ],
    })
    assert.isFalse(harvestHasUsableDatasets(state))
    assert.isFalse(hasLinkedData(state))
  })

  test('storeDataset keeps stable roster id and excludes from harvest', ({ assert }) => {
    const state = stubState()
    const stored = storeDataset(state, {
      id: 'roster',
      columns: ['athlete_id', 'joueur', 'poste'],
      rows: [{ athlete_id: 'a1', joueur: 'Ada', poste: 'CM' }],
    })
    assert.equal(stored.id, 'roster')
    assert.isFalse(harvestHasUsableDatasets(state))
    assert.isFalse(hasLinkedData(state))
  })

  test('metric dataset still counts as usable harvest', ({ assert }) => {
    const state = stubState()
    storeDataset(state, {
      id: 'ignored',
      columns: ['joueur', 'date_of_day', 'total_distance'],
      rows: [{ joueur: 'Ada', date_of_day: '2026-03-01', total_distance: 5000 }],
    })
    assert.isTrue(harvestHasUsableDatasets(state))
    assert.isTrue(hasLinkedData(state))
  })
})
