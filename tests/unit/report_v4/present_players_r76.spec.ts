import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { executeBuildAthleteSheets } from '#services/report_v4/athlete_sheets'
import {
  athletePresentInAnyDataset,
  collectPresentPlayerNames,
  mapPresentPlayersByDataset,
} from '#services/report_v4/present_players'
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
  requestPrompt: 'individual sheets',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
  limits: {
    requireLiveDatasetId: true,
    skipTextCaptionJev: true,
    deterministicCaptionGate: true,
    groundedAthleteNames: ['Ada', 'Bea', 'Nathan Soliman'],
  },
})

const roster: RosterAthlete[] = [
  { id: 'a1', name: 'Ada', position: 'CM', photoUrl: null, photoKey: null },
  { id: 'a2', name: 'Bea', position: 'CM', photoUrl: null, photoKey: null },
  { id: 'a3', name: 'Nathan Soliman', position: 'ST', photoUrl: null, photoKey: null },
]

test.group('R7.6 §3 present players', () => {
  test('maps players present per dataset', ({ assert }) => {
    const state = stubState()
    storeDataset(state, {
      id: 'gps',
      columns: ['joueur', 'total_distance'],
      rows: [
        { joueur: 'Ada', total_distance: 5000 },
        { joueur: 'Bea', total_distance: 4800 },
      ],
    })
    storeDataset(state, {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [{ joueur: 'Ada', performance_score: 70 }],
    })
    const map = mapPresentPlayersByDataset(state.datasets.values())
    const lists = Object.values(map)
    assert.lengthOf(lists, 2)
    assert.isTrue(lists.some((names) => names.join(',') === 'Ada,Bea'))
    assert.isTrue(lists.some((names) => names.join(',') === 'Ada'))
    const present = collectPresentPlayerNames(map)
    assert.isTrue(athletePresentInAnyDataset('Ada', present))
    assert.isFalse(athletePresentInAnyDataset('Nathan Soliman', present))
  })

  test('absent athlete gets short sheet without name search charts', async ({ assert }) => {
    const state = stubState()
    storeDataset(state, {
      id: 'gps',
      columns: ['joueur', 'date_of_day', 'total_distance'],
      rows: [
        { joueur: 'Ada', date_of_day: '2026-03-01', total_distance: 5000 },
        { joueur: 'Bea', date_of_day: '2026-03-01', total_distance: 4800 },
      ],
    })
    const result = await executeBuildAthleteSheets({
      state,
      roster,
      requiredAthletes: ['Ada', 'Bea', 'Nathan Soliman'],
      domains: [PREMIUM_DOMAIN.GPS],
      metrics: ['total_distance'],
      input: {},
    })
    const parsed = JSON.parse(result) as {
      ok?: boolean
      shortSheets?: string[]
      headings?: number
      charts?: number
      presentPlayers?: Record<string, string[]>
    }
    assert.isTrue(parsed.ok, result)
    assert.deepEqual(parsed.shortSheets, ['Nathan Soliman'])
    assert.equal(parsed.headings, 3)
    assert.isAtLeast(parsed.charts ?? 0, 2)
    assert.isTrue(
      Object.values(parsed.presentPlayers ?? {}).some((names) => names.join(',') === 'Ada,Bea')
    )

    const texts = state.document.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.TEXT)
    assert.isTrue(
      texts.some(
        (b) => b.type === PREMIUM_BLOCK_TYPE.TEXT && b.text === 'No data for the period'
      )
    )
    const nathanCharts = state.document.blocks.filter(
      (b) =>
        b.type === PREMIUM_BLOCK_TYPE.CHART &&
        ((b.title ?? '').includes('Nathan') ||
          JSON.stringify(b.option ?? {}).toLowerCase().includes('nathan'))
    )
    assert.equal(nathanCharts.length, 0)
  })
})
