import { test } from '@japa/runner'
import { sanitizeChartOptionForPrint } from '#services/premium_report/charts/echarts_options'

const rpeScale = {
  field: 'rpe_rating',
  label: 'RPE',
  isReversed: false,
  min: 1,
  max: 10,
}

test.group('subjective bar visualMap', () => {
  test('does not apply Likert visualMap to sRPE load totals', ({ assert }) => {
    const option = sanitizeChartOptionForPrint(
      {
        dataset: {
          source: [
            ['athlete_name', 'sRPE daily'],
            ['Hugo Robineau', 38000],
            ['Adrian Nelson', 31118.1],
            ['Nathan Soliman', 12000],
          ],
        },
        xAxis: { type: 'value' },
        yAxis: { type: 'category' },
        series: [
          {
            name: 'sRPE daily',
            type: 'bar',
            encode: { y: 'athlete_name', x: 'sRPE daily' },
          },
        ],
      },
      'sRPE total — Top 10',
      [rpeScale]
    )
    assert.isUndefined(option.visualMap)
  })

  test('strips stale Likert visualMap from preserved sRPE total bars', ({ assert }) => {
    const option = sanitizeChartOptionForPrint(
      {
        dataset: {
          source: [
            ['athlete_name', 'sRPE daily'],
            ['Nathan Soliman', 36019.2],
            ['Adrian Nelson', 31118.1],
          ],
        },
        xAxis: { type: 'value' },
        yAxis: { type: 'category' },
        series: [
          {
            name: 'sRPE daily',
            type: 'bar',
            encode: { y: 'athlete_name', x: 'sRPE daily' },
          },
        ],
        visualMap: {
          type: 'piecewise',
          min: 1,
          max: 10,
          pieces: [
            { min: 1, max: 4, color: '#22c55e', label: 'Better' },
            { min: 4, max: 7, color: '#eab308', label: 'Mid' },
            { min: 7, max: 10, color: '#ef4444', label: 'Worse' },
          ],
        },
      },
      'sRPE total — Top 10',
      [rpeScale]
    )
    assert.isUndefined(option.visualMap)
  })

  test('still applies visualMap to true RPE rating bars', ({ assert }) => {
    const option = sanitizeChartOptionForPrint(
      {
        dataset: {
          source: [
            ['athlete_name', 'rpe_rating'],
            ['Hugo Robineau', 8],
            ['Adrian Nelson', 6],
            ['Nathan Soliman', 3],
          ],
        },
        xAxis: { type: 'value' },
        yAxis: { type: 'category' },
        series: [
          {
            name: 'rpe_rating',
            type: 'bar',
            encode: { y: 'athlete_name', x: 'rpe_rating' },
          },
        ],
      },
      'RPE — Top 10',
      [rpeScale]
    )
    assert.isObject(option.visualMap)
  })
})
