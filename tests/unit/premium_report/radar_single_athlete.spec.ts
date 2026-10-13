import { test } from '@japa/runner'
import { PREMIUM_CHART_PRESET } from '#constants/premium_report.constants'
import { feasibleChartTypes, inferChartType } from '#services/premium_report/charts/chart_rules'
import { buildPresetFromDataset } from '#services/premium_report/chart_presets'
import type { PremiumDataset } from '#contracts/premium_report'

const wellnessCols = [
  'athlete_name',
  'mood_rating',
  'energy_rating',
  'stress_rating',
  'wellbeing_rating',
]

const squad: PremiumDataset = {
  id: 'squad',
  title: 'wellness',
  columns: wellnessCols,
  rows: [
    {
      athlete_name: 'Adrian Nelson',
      mood_rating: 4,
      energy_rating: 3,
      stress_rating: 2,
      wellbeing_rating: 4,
    },
    {
      athlete_name: 'Hugo Robineau',
      mood_rating: 3,
      energy_rating: 4,
      stress_rating: 3,
      wellbeing_rating: 3,
    },
    {
      athlete_name: 'Tyson Walker',
      mood_rating: 4,
      energy_rating: 4,
      stress_rating: 2,
      wellbeing_rating: 4,
    },
  ],
}

const solo: PremiumDataset = {
  id: 'solo',
  title: 'wellness',
  columns: wellnessCols,
  rows: [squad.rows[0]!],
}

test.group('radar single-athlete only', () => {
  test('inferChartType uses bar for multi-athlete wellness', ({ assert }) => {
    assert.equal(inferChartType(squad), PREMIUM_CHART_PRESET.BAR)
    assert.notInclude(feasibleChartTypes(squad), PREMIUM_CHART_PRESET.RADAR)
  })

  test('inferChartType allows radar for one athlete', ({ assert }) => {
    assert.equal(inferChartType(solo), PREMIUM_CHART_PRESET.RADAR)
    assert.include(feasibleChartTypes(solo), PREMIUM_CHART_PRESET.RADAR)
  })

  test('multi-metric bar keeps all wellness axes', ({ assert }) => {
    const option = buildPresetFromDataset(
      PREMIUM_CHART_PRESET.BAR,
      squad,
      'athlete_name',
      ['mood_rating', 'energy_rating', 'stress_rating', 'wellbeing_rating'],
      'none',
      'en',
      'Wellness profile — squad averages'
    )
    assert.isObject(option)
    if (typeof option === 'string') return
    const series = Array.isArray(option.series) ? option.series : []
    assert.equal(series.length, 4)
    assert.isUndefined(option.radar)
  })
})
