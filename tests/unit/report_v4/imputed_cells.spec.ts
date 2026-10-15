import { test } from '@japa/runner'
import type { PremiumDataset } from '#contracts/premium_report'
import {
  blankImputedCells,
  isImputedCell,
  markImputedCells,
} from '#services/report_v4/imputed_cells'
import { computeFactValue } from '#services/report_v4/report_facts'
import { tableFromDataset } from '#services/premium_report/premium_report_document'
import { REPORT_V4_IMPUTED_DISPLAY } from '#services/report_v4/report_v4_constants'

test.group('imputed_cells R7.5 §1', () => {
  test('excludes rest-day load/sRPE 0 from imputed marks', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'load_srpe',
      columns: ['joueur', 'date_of_day', 'srpe_daily'],
      rows: Array.from({ length: 12 }, (_, i) => ({
        joueur: `P${i % 4}`,
        date_of_day: `2026-03-0${(i % 7) + 1}`,
        srpe_daily: 0,
      })),
    }
    markImputedCells({ datasets: [dataset] })
    assert.isUndefined(dataset.imputed)
    assert.equal(dataset.imputedExcludedCount ?? 0, 0)
  })

  test('excludes minutes equal to match duration', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'match_minutes',
      columns: ['joueur', 'minutes', 'match_duration'],
      rows: Array.from({ length: 10 }, (_, i) => ({
        joueur: `P${i}`,
        minutes: 90,
        match_duration: 90,
      })),
    }
    markImputedCells({ datasets: [dataset] })
    assert.isUndefined(dataset.imputed)
    assert.equal(dataset.imputedExcludedCount ?? 0, 0)
  })

  test('excludes subjective scale good-end repeats', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'sleep_daily',
      columns: ['joueur', 'quality_rating'],
      rows: Array.from({ length: 20 }, (_, i) => ({
        joueur: `P${i}`,
        quality_rating: i < 14 ? 10 : 7 + (i % 3),
      })),
    }
    markImputedCells({
      datasets: [dataset],
      subjectiveScales: [
        {
          field: 'qualityRating',
          label: 'Sleep quality',
          min: 1,
          max: 10,
          higherIsBetter: true,
        },
      ],
    })
    assert.isUndefined(dataset.imputed)
  })

  test('marks performance 50 and injury risk 0 sentinels', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score', 'injury_risk_score'],
      rows: [
        { joueur: 'A', performance_score: 50, injury_risk_score: 0 },
        { joueur: 'B', performance_score: 72, injury_risk_score: 11 },
        { joueur: 'C', performance_score: 50, injury_risk_score: 0 },
      ],
    }
    const summary = markImputedCells({ datasets: [dataset] })
    assert.isTrue(isImputedCell(dataset, 0, 'performance_score'))
    assert.isTrue(isImputedCell(dataset, 0, 'injury_risk_score'))
    assert.isFalse(isImputedCell(dataset, 1, 'performance_score'))
    assert.isTrue(isImputedCell(dataset, 2, 'performance_score'))
    assert.include(dataset.imputed?.[0]?.performance_score ?? '', 'sentinel:performance_score=50')
    assert.include(dataset.imputed?.[0]?.injury_risk_score ?? '', 'sentinel:injury_risk_score=0')
    assert.isAtLeast(summary.excludedCellCount, 4)
  })

  test('marks 3630-like constant when share exceeds threshold', ({ assert }) => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      joueur: `P${i}`,
      srpe_daily: i < 7 ? 3630 : 1800 + i * 10,
    }))
    const dataset: PremiumDataset = {
      id: 'load_period',
      columns: ['joueur', 'srpe_daily'],
      rows,
    }
    markImputedCells({ datasets: [dataset], defaultShareThreshold: 0.4 })
    assert.isTrue(isImputedCell(dataset, 0, 'srpe_daily'))
    assert.isTrue(isImputedCell(dataset, 6, 'srpe_daily'))
    assert.isFalse(isImputedCell(dataset, 7, 'srpe_daily'))
    assert.include(dataset.imputed?.[0]?.srpe_daily ?? '', '3630')
  })

  test('compute_report_fact skips imputed cells', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [
        { joueur: 'A', performance_score: 50 },
        { joueur: 'B', performance_score: 80 },
        { joueur: 'C', performance_score: 60 },
      ],
    }
    markImputedCells({ datasets: [dataset] })
    const mean = computeFactValue({
      dataset,
      op: 'mean',
      column: 'performance_score',
    })
    assert.isTrue(mean.ok)
    if (mean.ok) assert.equal(mean.value, 70)
  })

  test('tables display em-dash for imputed cells', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [
        { joueur: 'A', performance_score: 50 },
        { joueur: 'B', performance_score: 80 },
      ],
    }
    markImputedCells({ datasets: [dataset] })
    const table = tableFromDataset(dataset, 'en')
    assert.strictEqual(table.rows[0]![1], null)
    assert.equal(table.rows[1]![1], 80)
    assert.equal(table.rows[0]![1] == null ? REPORT_V4_IMPUTED_DISPLAY : table.rows[0]![1], REPORT_V4_IMPUTED_DISPLAY)
  })

  test('blankImputedCells nulls marked values for charts', ({ assert }) => {
    const dataset: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [{ joueur: 'A', performance_score: 50 }],
    }
    markImputedCells({ datasets: [dataset] })
    const blanked = blankImputedCells(dataset)
    assert.isNull(blanked.rows[0]?.performance_score ?? null)
    assert.equal(dataset.rows[0]?.performance_score, 50)
  })

  test('imputed display sentinel has no digits for literal audits', ({ assert }) => {
    assert.notMatch(REPORT_V4_IMPUTED_DISPLAY, /\d/)
  })
})
