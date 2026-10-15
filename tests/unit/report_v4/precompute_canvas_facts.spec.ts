import { test } from '@japa/runner'
import type { PremiumDataset, PremiumReportDocument } from '#contracts/premium_report'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import {
  computeFactValue,
  injectDataFactsInHtml,
  type ReportFact,
} from '#services/report_v4/report_facts'
import { precomputeCanvasFacts } from '#services/report_v4/precompute_canvas_facts'
import { markImputedCells } from '#services/report_v4/imputed_cells'
import { characterizeReportHtml } from './characterization_coach_asks.spec.js'

const gpsDataset = (): PremiumDataset => ({
  id: 'gps_daily',
  columns: ['joueur', 'total_distance_m', 'hmld_m'],
  rows: [
    { joueur: 'Ada', total_distance_m: 1000, hmld_m: 100 },
    { joueur: 'Bea', total_distance_m: 2000, hmld_m: 200 },
    { joueur: 'Cid', total_distance_m: 3000, hmld_m: 300 },
  ],
  units: { total_distance_m: 'm', hmld_m: 'm' },
})

test.group('precompute_canvas_facts R7.5 §4', () => {
  test('mean and total produce fact ids', ({ assert }) => {
    const registry = new Map<string, ReportFact>()
    const result = precomputeCanvasFacts({
      datasets: [gpsDataset()],
      registry,
      document: null,
    })
    assert.isAtLeast(result.added, 4)
    assert.isTrue(registry.has('gps_daily.total_distance_m.mean'))
    assert.isTrue(registry.has('gps_daily.total_distance_m.sum'))
    assert.isTrue(registry.has('gps_daily.total_distance_m.delta'))
    const mean = registry.get('gps_daily.total_distance_m.mean')
    assert.equal(mean?.value, 2000)
    const sum = registry.get('gps_daily.total_distance_m.sum')
    assert.equal(sum?.value, 6000)
    const delta = registry.get('gps_daily.total_distance_m.delta')
    assert.equal(delta?.value, 2000)
  })

  test('injectDataFacts fills empty data-fact spans from precomputed facts', ({ assert }) => {
    const registry = new Map<string, ReportFact>()
    precomputeCanvasFacts({ datasets: [gpsDataset()], registry, document: null })
    assert.isTrue(registry.has('gps_daily.total_distance_m.sum'))
    const html = `<p>Squad total distance <span data-fact="gps_daily.total_distance_m.sum"></span>.</p>`
    const injected = injectDataFactsInHtml({
      html,
      facts: registry,
      language: 'en',
    })
    assert.equal(injected.filled, 1)
    assert.include(injected.html, '6,000')
  })

  test('does not invent facts from imputed-only columns', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [
        { joueur: 'A', performance_score: 50 },
        { joueur: 'B', performance_score: 50 },
        { joueur: 'C', performance_score: 50 },
      ],
    }
    markImputedCells({ datasets: [dataset] })
    const mean = computeFactValue({ dataset, op: 'mean', column: 'performance_score' })
    assert.isFalse(mean.ok)
    const registry = new Map<string, ReportFact>()
    precomputeCanvasFacts({ datasets: [dataset], registry, document: null })
    assert.isFalse(registry.has('scores.performance_score.mean'))
  })

  test('characterization: fact ids appear for canvas table columns', ({ assert }) => {
    const document: PremiumReportDocument = {
      title: 'GPS',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [
        {
          id: 't1',
          type: PREMIUM_BLOCK_TYPE.TABLE,
          title: 'Distance',
          columns: ['joueur', 'total_distance_m'],
          rows: [
            ['Ada', 1000],
            ['Bea', 2000],
          ],
        },
      ],
    }
    const registry = new Map<string, ReportFact>()
    const result = precomputeCanvasFacts({
      datasets: [gpsDataset()],
      registry,
      document,
    })
    assert.isTrue(result.ids.some((id) => id.endsWith('.mean')))
    const html = `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">GPS</h1>
      <p data-block="f1">${result.ids[0]}</p>
    </body></html>`
    const char = characterizeReportHtml(html)
    assert.isFalse(char.hasError)
    assert.include(char.blockOrder, 'f1')
  })
})
