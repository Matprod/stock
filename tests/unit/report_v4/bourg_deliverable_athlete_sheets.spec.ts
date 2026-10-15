import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { executeBuildAthleteSheets } from '#services/report_v4/athlete_sheets'
import { displayColumnLabel } from '#services/premium_report/column_labels'
import type { RosterAthlete } from '#services/report_v4/roster_macros'

const stubState = (): PremiumReportState => ({
  document: emptyPremiumDocument({ from: '2026-10-07', to: '2026-10-14' }, []),
  datasets: new Map(),
  defaultAfter: 'end',
  dateRange: { from: '2026-10-07', to: '2026-10-14' },
  clubId: 'club-bourg',
  athleteIds: [],
  language: 'fr',
  sqlFailures: new Map(),
  blockSql: false,
  toolHistory: [],
  harvestTried: [],
  jevValidations: 0,
  jevBlocked: 0,
  requestPrompt: 'fiches individuelles GPS wellness',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
  limits: {
    requireLiveDatasetId: true,
    skipTextCaptionJev: true,
    deterministicCaptionGate: true,
    groundedAthleteNames: [],
  },
})

const richGpsColumns = [
  'joueur',
  'date_of_day',
  'total_distance',
  'energy_consumption_carbs',
  'energy_consumption_fats',
  'zone1_time',
  'zone2_time',
  'zone3_time',
  'zone4_time',
  'zone5_time',
  'trimp',
  'movement_load',
  'rmssd',
] as const

const makeRoster = (n: number): RosterAthlete[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `a${i + 1}`,
    name: `Player ${i + 1}`,
    position: i % 2 === 0 ? 'CM' : 'ST',
    photoUrl: null,
    photoKey: null,
  }))

const storeRichGps = (state: PremiumReportState, namesWithData: string[]) => {
  storeDataset(state, {
    id: 'gps_bourg',
    columns: [...richGpsColumns],
    rows: namesWithData.flatMap((name) => [
      {
        joueur: name,
        date_of_day: '2026-10-08',
        total_distance: 5000,
        energy_consumption_carbs: 120,
        energy_consumption_fats: 40,
        zone1_time: 10,
        zone2_time: 12,
        zone3_time: 8,
        zone4_time: 5,
        zone5_time: 2,
        trimp: 90,
        movement_load: 300,
        rmssd: 55,
      },
      {
        joueur: name,
        date_of_day: '2026-10-10',
        total_distance: 5200,
        energy_consumption_carbs: 130,
        energy_consumption_fats: 42,
        zone1_time: 11,
        zone2_time: 13,
        zone3_time: 9,
        zone4_time: 6,
        zone5_time: 3,
        trimp: 95,
        movement_load: 310,
        rmssd: 52,
      },
    ]),
    dateRange: { from: '2026-10-07', to: '2026-10-14' },
  })
}

type SheetsResult = {
  ok?: boolean
  metrics?: string[]
  shortSheets?: string[]
  charts?: number
  athletes?: string[]
}

const NOISE_METRICS = /^(energy_consumption_carbs|energy_consumption_fats|zone[1-5]_time)$/

test.group('Bourg deliverable B — build_athlete_sheets 3–4 domain measures', () => {
  test('default GPS pick is 3–4 contract measures — not carbs/lipids/zones', async ({ assert }) => {
    const state = stubState()
    const roster = makeRoster(3)
    storeRichGps(
      state,
      roster.map((row) => row.name)
    )
    const parsed = JSON.parse(
      await executeBuildAthleteSheets({
        state,
        roster,
        requiredAthletes: roster.map((row) => row.name),
        domains: [PREMIUM_DOMAIN.GPS],
        metrics: [],
        input: {},
      })
    ) as SheetsResult
    assert.isTrue(parsed.ok, JSON.stringify(parsed))
    const metrics = parsed.metrics ?? []
    assert.isAtLeast(metrics.length, 3)
    assert.isAtMost(metrics.length, 4)
    assert.isFalse(
      metrics.some((m) => NOISE_METRICS.test(m)),
      `noise columns leaked into default sheet metrics: ${metrics.join(',')}`
    )
    assert.isTrue(
      metrics.some((m) => /distance|trimp|movement_load|rmssd/i.test(m)),
      `expected primary load/intensity/HRV pick, got ${metrics.join(',')}`
    )
  })

  test('second call without metrics stays at 3–4 primary picks (explains Bourg collapse)', async ({
    assert,
  }) => {
    const state = stubState()
    const roster = makeRoster(2)
    storeRichGps(
      state,
      roster.map((row) => row.name)
    )
    const first = JSON.parse(
      await executeBuildAthleteSheets({
        state,
        roster,
        requiredAthletes: roster.map((row) => row.name),
        domains: [PREMIUM_DOMAIN.GPS],
        metrics: [],
        input: {},
      })
    ) as SheetsResult
    assert.isTrue(first.ok)

    state.document = emptyPremiumDocument({ from: '2026-10-07', to: '2026-10-14' }, [])
    const second = JSON.parse(
      await executeBuildAthleteSheets({
        state,
        roster,
        requiredAthletes: roster.map((row) => row.name),
        domains: [PREMIUM_DOMAIN.GPS],
        metrics: [],
        input: {},
      })
    ) as SheetsResult
    assert.isTrue(second.ok, JSON.stringify(second))
    const metrics = second.metrics ?? []
    assert.isAtLeast(metrics.length, 3)
    assert.isAtMost(metrics.length, 4)
    assert.isFalse(metrics.some((m) => NOISE_METRICS.test(m)))
  })

  test('12 required athletes: all present; short sheets only for names without data', async ({
    assert,
  }) => {
    const state = stubState()
    const roster = makeRoster(12)
    const withData = roster.slice(0, 9).map((row) => row.name)
    storeRichGps(state, withData)
    const parsed = JSON.parse(
      await executeBuildAthleteSheets({
        state,
        roster,
        requiredAthletes: roster.map((row) => row.name),
        domains: [PREMIUM_DOMAIN.GPS],
        metrics: [],
        input: {},
      })
    ) as SheetsResult
    assert.isTrue(parsed.ok)
    assert.equal(parsed.athletes?.length, 12)
    const short = new Set(parsed.shortSheets ?? [])
    assert.equal(short.size, 3)
    for (const name of roster.slice(9).map((row) => row.name)) {
      assert.isTrue(short.has(name), `expected short sheet for ${name}`)
    }
    for (const name of withData) {
      assert.isFalse(short.has(name), `${name} has data — must not be short stub`)
    }
  })
})

test.group('Bourg deliverable J — sheet chart titles use human labels', () => {
  test('build_athlete_sheets chart titles are localized labels, not snake_case column ids', async ({
    assert,
  }) => {
    const state = stubState()
    const roster = makeRoster(1)
    storeRichGps(state, [roster[0]!.name])
    const raw = await executeBuildAthleteSheets({
      state,
      roster,
      requiredAthletes: [roster[0]!.name],
      domains: [PREMIUM_DOMAIN.GPS],
      metrics: ['total_distance', 'trimp', 'rmssd'],
      input: {},
    })
    assert.isTrue((JSON.parse(raw) as SheetsResult).ok, raw)
    const charts = state.document.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.CHART)
    assert.isAtLeast(charts.length, 1)
    for (const chart of charts) {
      if (chart.type !== PREMIUM_BLOCK_TYPE.CHART) continue
      assert.notMatch(chart.title, /_/, `snake_case title leaked: ${chart.title}`)
    }
    const distTitle = displayColumnLabel('total_distance', 'fr')
    assert.isTrue(
      charts.some(
        (c) => c.type === PREMIUM_BLOCK_TYPE.CHART && c.title.includes(distTitle.split(' ')[0]!)
      ),
      `expected localized distance title near ${distTitle}, got ${charts.map((c) => (c.type === PREMIUM_BLOCK_TYPE.CHART ? c.title : '')).join(' | ')}`
    )
  })
})
