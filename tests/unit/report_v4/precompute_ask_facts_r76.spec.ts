import { test } from '@japa/runner'
import type { PremiumDataset } from '#contracts/premium_report'
import type { ReportFact } from '#services/report_v4/report_facts'
import {
  ASK_FACT_ATHLETE_OPS,
  athleteFactId,
  expectedAskFactCount,
  precomputeAskFacts,
  teamFactId,
} from '#services/report_v4/precompute_ask_facts'

const buildSquadDataset = (athleteCount: number, metrics: string[]): PremiumDataset => {
  const columns = ['joueur', 'date_of_day', ...metrics]
  const rows: Array<Record<string, unknown>> = []
  for (let i = 0; i < athleteCount; i += 1) {
    const name = `Player ${String(i + 1).padStart(2, '0')}`
    for (let day = 1; day <= 3; day += 1) {
      const row: Record<string, unknown> = {
        joueur: name,
        date_of_day: `2026-03-0${day}`,
      }
      for (const metric of metrics) {
        row[metric] = 1000 + i * 10 + day
      }
      rows.push(row)
    }
  }
  return { id: 'gps_daily', columns, rows }
}

test.group('R7.6 §4 precompute ask facts', () => {
  test('fact id naming athlete.<id>.<metric>.<op> and team.<metric>.mean', ({ assert }) => {
    assert.equal(athleteFactId('uuid-ada', 'total_distance', 'mean'), 'athlete.uuid_ada.total_distance.mean')
    assert.equal(athleteFactId('uuid-ada', 'total_distance', 'delta'), 'athlete.uuid_ada.total_distance.delta')
    assert.equal(teamFactId('total_distance'), 'team.total_distance.mean')
  })

  test('Bourg-like 12 athletes × 3 metrics × 4 ops + team means = 147', ({ assert }) => {
    const athleteCount = 12
    const metrics = ['total_distance', 'hmld', 'hsr']
    const expected = expectedAskFactCount({
      athleteCount,
      metricCount: metrics.length,
      athleteOps: ASK_FACT_ATHLETE_OPS.length,
    })
    assert.equal(expected, 12 * 3 * 4 + 3)
    assert.equal(expected, 147)

    const roster = Array.from({ length: athleteCount }, (_, i) => ({
      id: `id-${i + 1}`,
      name: `Player ${String(i + 1).padStart(2, '0')}`,
      position: 'CM',
      photoUrl: null,
      photoKey: null,
    }))
    const registry = new Map<string, ReportFact>()
    const result = precomputeAskFacts({
      datasets: [buildSquadDataset(athleteCount, metrics)],
      registry,
      athletes: roster.map((row) => ({ id: row.id, name: row.name })),
      metrics,
      roster,
    })
    console.log('R7.6 §4 ask fact count:', result.added, 'expected:', expected)
    assert.equal(result.added, expected)
    assert.equal(registry.size, expected)
    assert.isTrue(registry.has('athlete.id_1.total_distance.mean'))
    assert.isTrue(registry.has('athlete.id_1.total_distance.max'))
    assert.isTrue(registry.has('athlete.id_1.total_distance.last'))
    assert.isTrue(registry.has('athlete.id_1.total_distance.delta'))
    assert.isTrue(registry.has('team.total_distance.mean'))
    assert.isTrue(registry.has('team.hmld.mean'))
    assert.isTrue(registry.has('team.hsr.mean'))
  })
})
