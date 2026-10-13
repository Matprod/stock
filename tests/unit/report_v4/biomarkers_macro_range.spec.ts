import { test } from '@japa/runner'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { resolveMacroDateRange } from '#services/premium_report/dataset_ops'

test.group('resolveMacroDateRange · biomarkers', () => {
  test('rejects linker Dec when fetch window is March display and Cover is display-only', ({
    assert,
  }) => {
    const range = resolveMacroDateRange(
      {
        dateRange: { from: '2026-03-01', to: '2026-03-07' },
        displayRange: { from: '2026-03-01', to: '2026-03-07' },
        coverRange: { from: '2026-03-01', to: '2026-03-07' },
        fetchWindows: [
          {
            domain: PREMIUM_DOMAIN.BIOMARKERS,
            from: '2026-03-01',
            to: '2026-03-07',
          },
        ],
        domainRanges: {
          [PREMIUM_DOMAIN.BIOMARKERS]: { from: '2026-03-01', to: '2026-03-07' },
        },
      },
      PREMIUM_DOMAIN.BIOMARKERS,
      { from: '2025-12-01', to: '2025-12-31' }
    )
    assert.deepEqual(range, { from: '2026-03-01', to: '2026-03-07' })
  })

  test('honours Dec ask when Cover includes December archive', ({ assert }) => {
    const range = resolveMacroDateRange(
      {
        dateRange: { from: '2026-03-01', to: '2026-03-07' },
        displayRange: { from: '2026-03-01', to: '2026-03-07' },
        coverRange: { from: '2025-12-01', to: '2026-03-07' },
        fetchWindows: [
          {
            domain: PREMIUM_DOMAIN.BIOMARKERS,
            from: '2026-03-01',
            to: '2026-03-07',
          },
        ],
        domainRanges: {
          [PREMIUM_DOMAIN.BIOMARKERS]: { from: '2026-03-01', to: '2026-03-07' },
        },
      },
      PREMIUM_DOMAIN.BIOMARKERS,
      { from: '2025-12-01', to: '2025-12-31' }
    )
    assert.deepEqual(range, { from: '2025-12-01', to: '2025-12-31' })
  })

  test('keeps display when domain archive does not overlap display', ({ assert }) => {
    const range = resolveMacroDateRange(
      {
        dateRange: { from: '2026-03-01', to: '2026-03-07' },
        displayRange: { from: '2026-03-01', to: '2026-03-07' },
        fetchWindows: [
          {
            domain: PREMIUM_DOMAIN.BIOMARKERS,
            from: '2025-12-01',
            to: '2025-12-31',
          },
        ],
        domainRanges: {
          [PREMIUM_DOMAIN.BIOMARKERS]: { from: '2025-12-01', to: '2025-12-31' },
        },
      },
      PREMIUM_DOMAIN.BIOMARKERS,
      { from: '2026-03-01', to: '2026-03-07' }
    )
    assert.deepEqual(range, { from: '2026-03-01', to: '2026-03-07' })
  })
})
