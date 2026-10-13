import { test } from '@japa/runner'
import {
  pickValueColumns,
  preferLineMetric,
} from '#services/premium_report/charts/chart_rules'
import { aggregateDataset } from '#services/premium_report/dataset_ops'
import type { PremiumDataset } from '#contracts/premium_report'

const aggregated: PremiumDataset = {
  id: 'ds',
  title: 'agg',
  columns: ['athlete_name', 'n', 'srpe_daily'],
  rows: [
    { athlete_name: 'Nathan Soliman', n: 15, srpe_daily: 36019.2 },
    { athlete_name: 'Adrian Nelson', n: 14, srpe_daily: 31118.1 },
  ],
}

test.group('sRPE total metric pick', () => {
  test('pickValueColumns ignores aggregate count n', ({ assert }) => {
    assert.deepEqual(pickValueColumns(aggregated, 'athlete_name'), ['srpe_daily'])
  })

  test('preferLineMetric prefers srpe over n for total titles', ({ assert }) => {
    assert.deepEqual(preferLineMetric(['n', 'srpe_daily'], { title: 'sRPE total — Top 10' }), [
      'srpe_daily',
    ])
  })

  test('pickValueColumns remaps requested n-only to load metric', ({ assert }) => {
    assert.deepEqual(pickValueColumns(aggregated, 'athlete_name', ['n']), ['srpe_daily'])
  })

  test('athlete-grouped load aggregate sums srpe by default path', ({ assert }) => {
    const daily: PremiumDataset = {
      id: 'daily',
      title: 'daily',
      columns: ['athlete_name', 'date_of_day', 'srpe_daily'],
      rows: [
        { athlete_name: 'Ada', date_of_day: '2026-09-01', srpe_daily: 1000 },
        { athlete_name: 'Ada', date_of_day: '2026-09-02', srpe_daily: 2000 },
        { athlete_name: 'Bob', date_of_day: '2026-09-01', srpe_daily: 500 },
      ],
    }
    const summed = aggregateDataset({
      dataset: daily,
      groupBy: 'athlete_name',
      columns: ['srpe_daily'],
      ops: ['sum'],
    })
    const ada = summed.rows.find((row) => row.athlete_name === 'Ada')
    assert.equal(ada?.srpe_daily, 3000)
    assert.equal(ada?.n, 2)
  })
})
