import { test } from '@japa/runner'
import {
  compatibleSubjectiveLineMetrics,
  preferLineMetric,
  resolveSingleGrainLineMetrics,
} from '#services/premium_report/charts/chart_rules'

const likertRows = [
  {
    date_of_day: '2026-03-01',
    joueur: 'Ada',
    mood_rating: 4,
    stress_rating: 2,
    energy_rating: 3,
    body_soreness_rating: 1,
    rpe_rating: 7,
    performance_score: 72,
  },
  {
    date_of_day: '2026-03-02',
    joueur: 'Ada',
    mood_rating: 5,
    stress_rating: 3,
    energy_rating: 4,
    body_soreness_rating: 2,
    rpe_rating: 8,
    performance_score: 74,
  },
]

test.group('subjective multi-metric line (single athlete)', () => {
  test('compatibleSubjectiveLineMetrics keeps same-scale ratings together', ({ assert }) => {
    const cols = compatibleSubjectiveLineMetrics(
      [
        'mood_rating',
        'stress_rating',
        'energy_rating',
        'body_soreness_rating',
        'rpe_rating',
        'performance_score',
      ],
      likertRows
    )
    assert.deepEqual(cols.sort(), [
      'body_soreness_rating',
      'energy_rating',
      'mood_rating',
      'stress_rating',
    ])
  })

  test('resolveSingleGrainLineMetrics preserves multi wellness for one athlete', ({ assert }) => {
    const resolved = resolveSingleGrainLineMetrics(
      ['mood_rating', 'stress_rating', 'energy_rating', 'body_soreness_rating'],
      likertRows,
      { title: 'Wellness' }
    )
    assert.equal(resolved.length, 4)
    assert.includeMembers(resolved, [
      'mood_rating',
      'stress_rating',
      'energy_rating',
      'body_soreness_rating',
    ])
  })

  test('preferLineMetric still collapses multi-metric for team lines', ({ assert }) => {
    const collapsed = preferLineMetric(
      ['mood_rating', 'stress_rating', 'energy_rating'],
      { title: 'Mood' }
    )
    assert.equal(collapsed.length, 1)
  })

  test('resolveSingleGrainLineMetrics falls back when scales do not match', ({ assert }) => {
    const resolved = resolveSingleGrainLineMetrics(
      ['mood_rating', 'performance_score'],
      likertRows,
      { title: 'Mixed' }
    )
    assert.equal(resolved.length, 1)
  })
})
