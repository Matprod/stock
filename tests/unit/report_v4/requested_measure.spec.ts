import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { ClubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import {
  detectDisplayedMeasureUnit,
  enforceRequestedMeasure,
  resolveRequestedMeasure,
} from '#services/report_v4/request/requested_measure'
import { characterizeReportHtml } from './characterization_coach_asks.spec.js'

const catalogStub = (): ClubMetricCatalog => ({
  periodKpis: [
    {
      name: 'kpi_distanceTotal',
      alias: 'distance_total',
      agg: 'SUM',
      digits: 0,
    },
    {
      name: 'kpi_distancePerMin',
      alias: 'distance_per_min',
      agg: 'AVG',
      digits: 1,
    },
    {
      name: 'kpi_accelerationTimeZ1Rel',
      alias: 'accel_z1_rel',
      agg: 'SUM',
      digits: 1,
    },
  ],
  periodNames: ['kpi_distanceTotal', 'kpi_distancePerMin', 'kpi_accelerationTimeZ1Rel'],
  matchKpis: [],
  matchNames: [],
  namesByUnit: () => [],
  rpeNames: [],
})

const wrongDoc = (): PremiumReportDocument => ({
  title: 'Top 10 distance',
  dateRange: { from: '2026-03-01', to: '2026-03-07' },
  blocks: [
    {
      id: 't1',
      type: PREMIUM_BLOCK_TYPE.TABLE,
      title: 'Top 10',
      columns: ['Joueur', 'Distance per minute (m/min)', 'Acceleration time zone 1 (relative)'],
      rows: [
        ['Remberg', 368, 12],
        ['Elfadli', 361, 11],
      ],
    },
  ],
})

const gpsDataset = (): PremiumDataset => ({
  id: 'gps_period',
  columns: ['joueur', 'kpi_distanceTotal', 'kpi_distancePerMin'],
  rows: [
    { joueur: 'Remberg', kpi_distanceTotal: 18420, kpi_distancePerMin: 368 },
    { joueur: 'Elfadli', kpi_distanceTotal: 17900, kpi_distancePerMin: 361 },
    { joueur: 'Other', kpi_distanceTotal: 12000, kpi_distancePerMin: 300 },
  ],
  units: { kpi_distanceTotal: 'm', kpi_distancePerMin: 'm/min' },
})

test.group('requested_measure R7.5 §2', () => {
  test('resolves short ask distance totale to total distance not m/min', ({ assert }) => {
    const measure = resolveRequestedMeasure({
      prompt: 'Un seul tableau: top 10 distance GPS totale sur 2026-03-01 → 2026-03-07.',
      catalog: catalogStub(),
      units: { kpi_distanceTotal: 'm', kpi_distancePerMin: 'm/min' },
    })
    assert.isNotNull(measure)
    assert.equal(measure?.metric, 'kpi_distanceTotal')
    assert.equal(measure?.unit, 'm')
    assert.notEqual(measure?.metric, 'kpi_distancePerMin')
  })

  test('detects m/min as displayed unit on short baseline shape', ({ assert }) => {
    assert.equal(detectDisplayedMeasureUnit('Distance per minute (m/min)'), 'm/min')
  })

  test('substitutes total distance from data and never silently', ({ assert }) => {
    const measure = resolveRequestedMeasure({
      prompt: 'top 10 total distance GPS',
      catalog: catalogStub(),
      units: { kpi_distanceTotal: 'm' },
    })
    assert.isNotNull(measure)
    const result = enforceRequestedMeasure({
      measure,
      document: wrongDoc(),
      datasets: [gpsDataset()],
      language: 'fr',
    })
    assert.equal(result.status, 'substituted')
    assert.isNotNull(result.note)
    assert.match(result.note ?? '', /substitu/i)
    const table = result.document.blocks.find((block) => block.type === PREMIUM_BLOCK_TYPE.TABLE)
    assert.isTrue(table?.type === PREMIUM_BLOCK_TYPE.TABLE)
    if (table?.type === PREMIUM_BLOCK_TYPE.TABLE) {
      const hay = table.columns.join(' ').toLowerCase()
      assert.notInclude(hay, 'm/min')
      assert.isFalse(/per\s*minute/i.test(hay))
    }
    const noteBlock = result.document.blocks.find(
      (block) => block.type === PREMIUM_BLOCK_TYPE.TEXT && block.id === 'requested_measure_note'
    )
    assert.isTrue(noteBlock?.type === PREMIUM_BLOCK_TYPE.TEXT)
  })

  test('writes clear missing message when requested measure absent', ({ assert }) => {
    const measure = resolveRequestedMeasure({
      prompt: 'top 10 total distance GPS',
      catalog: catalogStub(),
      units: { kpi_distanceTotal: 'm' },
    })
    const emptyGps: PremiumDataset = {
      id: 'gps_only_rate',
      columns: ['joueur', 'kpi_distancePerMin'],
      rows: [{ joueur: 'A', kpi_distancePerMin: 300 }],
      units: { kpi_distancePerMin: 'm/min' },
    }
    const result = enforceRequestedMeasure({
      measure,
      document: wrongDoc(),
      datasets: [emptyGps],
      language: 'fr',
    })
    assert.equal(result.status, 'missing')
    assert.match(result.note ?? '', /non disponible/i)
    assert.match(result.note ?? '', /m\/min/i)
  })

  test('keeps total distance when already displayed (does not swap to m/min)', ({ assert }) => {
    const measure = resolveRequestedMeasure({
      prompt: 'top 10 distance GPS totale',
      catalog: catalogStub(),
      units: { kpi_distanceTotal: 'm', kpi_distancePerMin: 'm/min' },
    })
    assert.equal(measure?.metric, 'kpi_distanceTotal')
    assert.equal(measure?.unit, 'm')
    const doc: PremiumReportDocument = {
      title: 'Top 10 distance',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [
        {
          id: 't1',
          type: PREMIUM_BLOCK_TYPE.TABLE,
          title: 'Top 10 Distance total (m)',
          columns: ['Joueur', 'Distance total (m)'],
          rows: [
            ['Remberg', 18420],
            ['Elfadli', 17900],
          ],
        },
      ],
    }
    const result = enforceRequestedMeasure({
      measure,
      document: doc,
      datasets: [gpsDataset()],
      language: 'fr',
    })
    assert.equal(result.status, 'ok')
    assert.isNull(result.note)
    const table = result.document.blocks.find((block) => block.type === PREMIUM_BLOCK_TYPE.TABLE)
    assert.isTrue(table?.type === PREMIUM_BLOCK_TYPE.TABLE)
    if (table?.type === PREMIUM_BLOCK_TYPE.TABLE) {
      assert.include(table.columns.join(' ').toLowerCase(), 'distance')
      assert.notInclude(table.columns.join(' ').toLowerCase(), 'm/min')
      assert.equal(table.rows[0]?.[1], 18420)
    }
  })

  test('characterization: substituted table keeps a table block and note', ({ assert }) => {
    const measure = resolveRequestedMeasure({
      prompt: 'total distance ranking',
      catalog: catalogStub(),
      units: { kpi_distanceTotal: 'm' },
    })
    const result = enforceRequestedMeasure({
      measure,
      document: wrongDoc(),
      datasets: [gpsDataset()],
      language: 'en',
    })
    const html = `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Top 10</h1>
      <table data-block="t1.table"><tr>${(result.document.blocks.find((b) => b.type === 'table') as { columns: string[] } | undefined)?.columns.map((c) => `<th>${c}</th>`).join('')}</tr></table>
      <p data-block="note">${result.note}</p>
    </body></html>`
    const char = characterizeReportHtml(html)
    assert.isFalse(char.hasError)
    assert.include(char.blockOrder, 't1.table')
    assert.match(result.note ?? '', /substituted|unavailable/i)
  })
})
