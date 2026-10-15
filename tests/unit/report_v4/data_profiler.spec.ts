import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import {
  buildDataProfileCanvasText,
  humanizeProfileReason,
  profileDataset,
  profileHarvestDatasets,
} from '#services/report_v4/data_profiler'
import { synthesizeReportBriefIfMissing } from '#services/report_v4/orchestrator_helpers'
import type { PremiumDataset } from '#contracts/premium_report'

const FIXTURE_PATH = join(
  fileURLToPath(new URL('../../..', import.meta.url)),
  'tmp/claude-artifact-fixture-2026-10-12.json'
)

const datasetsFromFixtureDomainPacks = (args: {
  domains: Record<string, { rows?: Array<Record<string, unknown>>; rowCount?: number }>
}): PremiumDataset[] =>
  Object.entries(args.domains).map(([id, pack]) => {
    const rows = Array.isArray(pack.rows) ? pack.rows : []
    const columns = rows[0] ? Object.keys(rows[0]) : []
    return { id, columns, rows }
  })

const loadFixtureDatasets = () => {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    meta: { dateRange: { from: string; to: string } }
    domains: Record<string, { rows?: Array<Record<string, unknown>> }>
  }
  return {
    window: raw.meta.dateRange,
    datasets: datasetsFromFixtureDomainPacks({ domains: raw.domains }),
  }
}

test.group('data_profiler fixture AC', () => {
  test('detects load_srpe constant zero as unusable', ({ assert }) => {
    const { datasets } = loadFixtureDatasets()
    const load = datasets.find((d) => d.id === 'load_srpe')
    assert.exists(load)
    const profile = profileDataset(load!)
    assert.equal(profile.verdict, 'unusable')
    const srpe = profile.columns.find((c) => c.column === 'srpe_daily')
    assert.exists(srpe)
    assert.isTrue(srpe!.constant)
    assert.equal(srpe!.constantValue, 0)
    assert.equal(srpe!.fillRate, 1)
  })

  test('detects gps_intensity_daily all-empty metrics as partial (not domain-ban)', ({ assert }) => {
    const { datasets } = loadFixtureDatasets()
    const gps = datasets.find((d) => d.id === 'gps_intensity_daily')
    assert.exists(gps)
    const profile = profileDataset(gps!)
    assert.equal(profile.verdict, 'partial')
    assert.include(profile.reasons, 'all_metric_columns_empty')
    const metricCols = profile.columns.filter((c) => c.column.startsWith('kpi_'))
    assert.isAtLeast(metricCols.length, 48)
    assert.isTrue(metricCols.every((c) => c.nonNullCount === 0))
  })

  test('short end-of-window gap is not truncation', ({ assert }) => {
    const dataset = {
      id: 'gps_daily',
      columns: ['joueur', 'date_of_day', 'total_distance'],
      rows: [
        { joueur: 'A', date_of_day: '2026-10-01', total_distance: 5000 },
        { joueur: 'A', date_of_day: '2026-10-11', total_distance: 6200 },
      ],
    }
    const profile = profileDataset(dataset, {
      window: { from: '2026-09-29', to: '2026-10-13' },
    })
    assert.isFalse(profile.truncated)
    assert.equal(profile.verdict, 'usable')
  })

  test('detects roster.weight_kg suspicious default 70', ({ assert }) => {
    const { datasets } = loadFixtureDatasets()
    const roster = datasets.find((d) => d.id === 'roster')
    assert.exists(roster)
    const profile = profileDataset(roster!)
    const weight = profile.columns.find((c) => c.column === 'weight_kg')
    assert.exists(weight)
    assert.isTrue(weight!.suspiciousDefault)
    assert.equal(weight!.suspiciousDefaultValue, 70)
    assert.isAtLeast(weight!.suspiciousDefaultShare ?? 0, 0.4)
    assert.isAbove(weight!.suspiciousDefaultShare ?? 0, 0.7)
  })

  test('detects scores.performance_score suspicious default ~51', ({ assert }) => {
    const { datasets } = loadFixtureDatasets()
    const scores = datasets.find((d) => d.id === 'scores')
    assert.exists(scores)
    const profile = profileDataset(scores!)
    const perf = profile.columns.find((c) => c.column === 'performance_score')
    assert.exists(perf)
    assert.isTrue(perf!.suspiciousDefault)
    assert.equal(perf!.suspiciousDefaultValue, 51)
    assert.isAtLeast(perf!.suspiciousDefaultShare ?? 0, 0.4)
    assert.equal(profile.verdict, 'partial')
  })

  test('detects biomarkers_raw CK measurement ceiling at 2000', ({ assert }) => {
    const { datasets } = loadFixtureDatasets()
    const biomarkers = datasets.find((d) => d.id === 'biomarkers_raw')
    assert.exists(biomarkers)
    const profile = profileDataset(biomarkers!)
    const ck = profile.columns.find(
      (c) => c.column === 'value' && String(c.groupValue).toLowerCase() === 'ck'
    )
    assert.exists(ck)
    assert.isTrue(ck!.measurementCeiling)
    assert.equal(ck!.ceilingValue, 2000)
    assert.equal(ck!.ceilingCount, 6)
  })

  test('detects gps_period_metrics truncation at 50000 rows / early end date', ({ assert }) => {
    const { datasets, window } = loadFixtureDatasets()
    const gps = datasets.find((d) => d.id === 'gps_period_metrics')
    assert.exists(gps)
    const profile = profileDataset(gps!, { window })
    assert.isTrue(profile.truncated)
    assert.equal(profile.rowCount, 50_000)
    assert.include(profile.truncationReasons.join('|'), 'row_cap:50000')
    assert.equal(profile.dateMax, '2026-07-30')
    assert.isTrue(profile.truncationReasons.some((r) => r.includes('date_ends_before_window')))
    assert.equal(profile.verdict, 'partial')
  })

  test('detects sleep_metrics and biomarkers_daily datasets as empty', ({ assert }) => {
    const { datasets, window } = loadFixtureDatasets()
    const profile = profileHarvestDatasets({ datasets, window })
    const sleepMetrics = profile.datasets.find((d) => d.datasetId === 'sleep_metrics')
    const biomarkersDaily = profile.datasets.find((d) => d.datasetId === 'biomarkers_daily')
    assert.equal(sleepMetrics?.verdict, 'empty')
    assert.equal(biomarkersDaily?.verdict, 'empty')
    const sleepDomain = profile.domains.find((d) => d.domain === 'sleep')
    const biomarkersDomain = profile.domains.find((d) => d.domain === 'biomarkers')
    assert.notEqual(sleepDomain?.verdict, 'empty')
    assert.equal(biomarkersDomain?.verdict, 'partial')
  })

  test('harvest rollup marks load unusable from fixture', ({ assert }) => {
    const { datasets, window } = loadFixtureDatasets()
    const profile = profileHarvestDatasets({ datasets, window })
    const load = profile.domains.find((d) => d.domain === 'load')
    assert.equal(load?.verdict, 'unusable')
    assert.include(profile.unusableDomains, 'load')
  })

  test('coach canvas copy has no raw dataset ids or reason codes', ({ assert }) => {
    const { datasets, window } = loadFixtureDatasets()
    const profile = profileHarvestDatasets({ datasets, window })
    const { body } = buildDataProfileCanvasText(profile, 'en')
    assert.notMatch(body, /\bds_\d+\b/)
    assert.notInclude(body, 'date_ends_before_window')
    assert.notInclude(body, 'empty_column:')
    assert.notInclude(body, 'suspicious_default:')
    assert.match(body, /Not interpretable:|Limit:|No data:/)
  })

  test('humanizeProfileReason maps technical flags to coach language', ({ assert }) => {
    assert.include(
      humanizeProfileReason('ds_3:suspicious_default:mood_rating=10@44%', 'en') ?? '',
      'mood rating'
    )
    assert.include(
      humanizeProfileReason('date_ends_before_window:2026-10-12<2026-10-13', 'fr') ?? '',
      '2026-10-12'
    )
  })

  test('does not flag good end of club subjective scale as suspicious default', ({ assert }) => {
    const dataset = {
      id: 'sleep_daily',
      columns: ['joueur', 'date_of_day', 'quality_rating'],
      rows: Array.from({ length: 20 }, (_, i) => ({
        joueur: `P${i}`,
        date_of_day: '2026-10-01',
        quality_rating: i < 12 ? 10 : 7 + (i % 3),
      })),
    }
    const without = profileDataset(dataset)
    const qualityWithout = without.columns.find((c) => c.column === 'quality_rating')
    assert.isTrue(qualityWithout?.suspiciousDefault)

    const withScale = profileDataset(dataset, {
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
    const qualityWith = withScale.columns.find((c) => c.column === 'quality_rating')
    assert.isFalse(qualityWith?.suspiciousDefault)
  })

  test('synthesizeReportBrief skips data_profile blocks', ({ assert }) => {
    const brief = synthesizeReportBriefIfMissing({
      insight: null,
      displayRange: { from: '2026-09-29', to: '2026-10-13' },
      document: {
        title: 'Staff',
        dateRange: { from: '2026-09-29', to: '2026-10-13' },
        blocks: [
          {
            id: 'data_profile_heading',
            type: PREMIUM_BLOCK_TYPE.HEADING,
            text: 'What the data allows',
            level: 2,
          },
          {
            id: 'data_profile_body',
            type: PREMIUM_BLOCK_TYPE.TEXT,
            text: 'Limit: ds_3:empty_column:energy_rating should never leak.',
          },
          {
            id: 'h1',
            type: PREMIUM_BLOCK_TYPE.HEADING,
            text: 'Injury risk',
            level: 2,
          },
          {
            id: 't1',
            type: PREMIUM_BLOCK_TYPE.TEXT,
            text: 'Bakery Jatta injury risk rose to the high 40s late in the window.',
          },
        ],
      },
    })
    assert.exists(brief)
    assert.equal(brief!.focus, 'Staff overview')
    assert.notInclude(brief!.narrative.join(' '), 'ds_3')
    assert.notInclude(brief!.narrative.join(' '), 'empty_column')
    assert.include(brief!.narrative.join(' '), 'Bakery Jatta')
    assert.isFalse(brief!.signals.some((s) => /ds_\d+|empty_column/.test(s.summary)))
  })
})
