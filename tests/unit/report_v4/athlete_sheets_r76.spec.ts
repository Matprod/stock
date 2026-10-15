import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import {
  createAthleteSheetsTools,
  executeBuildAthleteSheets,
  sortAthletesByPosteThenName,
} from '#services/report_v4/athlete_sheets'
import type { RosterAthlete } from '#services/report_v4/roster_macros'

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
  requestPrompt: 'individual sheets for each athlete',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
  limits: {
    requireLiveDatasetId: true,
    skipTextCaptionJev: true,
    deterministicCaptionGate: true,
    groundedAthleteNames: ['Ada', 'Bea', 'Cara'],
  },
})

const roster: RosterAthlete[] = [
  { id: 'a3', name: 'Cara', position: 'ST', photoUrl: null, photoKey: null },
  { id: 'a1', name: 'Ada', position: 'CM', photoUrl: null, photoKey: null },
  { id: 'a2', name: 'Bea', position: 'CM', photoUrl: null, photoKey: null },
]

test.group('R7.6 §1 build_athlete_sheets', () => {
  test('sorts by position then name', ({ assert }) => {
    const ordered = sortAthletesByPosteThenName([
      { name: 'Cara', position: 'ST' },
      { name: 'Bea', position: 'CM' },
      { name: 'Ada', position: 'CM' },
    ])
    assert.deepEqual(
      ordered.map((row) => row.name),
      ['Ada', 'Bea', 'Cara']
    )
  })

  test('3 athletes → headings/charts/tables in one execute; order by poste then name', async ({
    assert,
  }) => {
    const state = stubState()
    storeDataset(state, {
      id: 'gps',
      columns: ['joueur', 'date_of_day', 'total_distance'],
      rows: [
        { joueur: 'Ada', date_of_day: '2026-03-01', total_distance: 5000 },
        { joueur: 'Ada', date_of_day: '2026-03-02', total_distance: 5200 },
        { joueur: 'Bea', date_of_day: '2026-03-01', total_distance: 4800 },
        { joueur: 'Bea', date_of_day: '2026-03-02', total_distance: 5100 },
        { joueur: 'Cara', date_of_day: '2026-03-01', total_distance: 6100 },
        { joueur: 'Cara', date_of_day: '2026-03-02', total_distance: 6300 },
      ],
    })
    storeDataset(state, {
      id: 'scores',
      columns: ['joueur', 'date_of_day', 'performance_score'],
      rows: [
        { joueur: 'Ada', date_of_day: '2026-03-01', performance_score: 70 },
        { joueur: 'Bea', date_of_day: '2026-03-01', performance_score: 68 },
        { joueur: 'Cara', date_of_day: '2026-03-01', performance_score: 72 },
      ],
    })

    const result = await executeBuildAthleteSheets({
      state,
      roster,
      requiredAthletes: ['Ada', 'Bea', 'Cara'],
      domains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.SCORES],
      metrics: ['total_distance', 'performance_score'],
      input: {},
    })
    const parsed = JSON.parse(result) as {
      ok?: boolean
      error?: string
      athletes?: string[]
      headings?: number
      charts?: number
      tables?: number
      order?: Array<{ name: string; position: string }>
    }
    assert.isTrue(parsed.ok, result)
    assert.deepEqual(parsed.athletes, ['Ada', 'Bea', 'Cara'])
    assert.deepEqual(
      parsed.order?.map((row) => row.position),
      ['CM', 'CM', 'ST']
    )
    assert.equal(parsed.headings, 3)
    assert.isAtLeast(parsed.charts ?? 0, 3)
    assert.isAtLeast(parsed.tables ?? 0, 3)

    const headings = state.document.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.HEADING)
    assert.deepEqual(
      headings.map((b) => (b.type === PREMIUM_BLOCK_TYPE.HEADING ? b.text : '')),
      ['Ada', 'Bea', 'Cara']
    )
    const charts = state.document.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.CHART)
    const tables = state.document.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.TABLE)
    assert.isAtLeast(charts.length, 3)
    assert.isAtLeast(tables.length, 3)
  })

  test('createAthleteSheetsTools exposes build_athlete_sheets', ({ assert }) => {
    const tools = createAthleteSheetsTools({
      state: stubState(),
      roster,
      requiredAthletes: ['Ada'],
      domains: [PREMIUM_DOMAIN.GPS],
      metrics: ['total_distance'],
    })
    assert.deepEqual(
      tools.map((t) => t.schema.name),
      ['build_athlete_sheets', 'add_sheet_comments']
    )
  })
})
