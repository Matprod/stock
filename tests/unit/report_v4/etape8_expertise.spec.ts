import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { checkChartOptionGuards, enforceChartOptionGuards } from '#services/report_v4/chart_option_guards'
import {
  buildDataReliabilityReport,
  ensureDataReliabilityBlocks,
} from '#services/report_v4/data_reliability'
import type { HarvestDataProfile } from '#services/report_v4/data_profiler'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'

const contrastRatio = (a: string, b: string): number => {
  const rel = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  }
  const [hi, lo] = [rel(a), rel(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

test.group('étape 8 expertise + charts', () => {
  test('mauna series palette reaches 3:1 on paper', ({ assert }) => {
    const pack = resolveReportDesignPack('mauna')
    for (const color of pack.palette) {
      assert.isAtLeast(
        contrastRatio(color, pack.tokens.paper),
        3,
        `${color} vs paper ${pack.tokens.paper}`
      )
    }
  })

  test('chart guards reject dual value axes and force bars from zero', ({ assert }) => {
    const pack = resolveReportDesignPack('mauna')
    const issues = checkChartOptionGuards({
      pack,
      chartType: 'donut',
      option: {
        yAxis: [{ type: 'value' }, { type: 'value' }],
        series: [{ type: 'bar', data: [1, 2] }],
      },
    })
    assert.isTrue(issues.some((row) => row.code === 'forbidden_form'))
    assert.isTrue(issues.some((row) => row.code === 'dual_value_axis'))

    const enforced = enforceChartOptionGuards(
      {
        yAxis: { type: 'value', min: 12 },
        series: [{ type: 'bar', data: [3] }],
      },
      pack
    )
    assert.equal((enforced.option.yAxis as { min: number }).min, 0)

    const lines = enforceChartOptionGuards(
      {
        series: [
          { type: 'line', name: 'A', data: [1, 2] },
          { type: 'line', name: 'B', data: [2, 3], lineStyle: { type: 'dotted' } },
          { type: 'line', name: 'C', data: [3, 4] },
          { type: 'line', name: 'min', stack: 'squad-range', data: [0, 1] },
          { type: 'line', name: 'max', stack: 'squad-range', data: [4, 5], lineStyle: { type: 'dashed' } },
        ],
      },
      pack
    )
    const series = lines.option.series as Array<{ name?: string; lineStyle?: { type?: unknown } }>
    assert.equal(series[0]?.lineStyle?.type, 'solid')
    assert.equal(series[1]?.lineStyle?.type, 'solid')
    assert.equal(series[2]?.lineStyle?.type, 'solid')
    assert.equal(series[3]?.lineStyle?.type, 'dashed')
    assert.equal(series[4]?.lineStyle?.type, 'dashed')
  })

  test('data reliability block inserts once', ({ assert }) => {
    const profile: HarvestDataProfile = {
      window: { from: '2026-03-01', to: '2026-03-07' },
      datasets: [
        {
          datasetId: 'load_daily',
          domain: PREMIUM_DOMAIN.LOAD,
          rowCount: 40,
          columns: [],
          truncated: false,
          truncationReasons: [],
          dateMin: '2026-03-03',
          dateMax: '2026-03-07',
          verdict: 'partial',
          reasons: ['date_start_after_window:2026-03-03:2026-03-01'],
        },
      ],
      domains: [
        {
          domain: PREMIUM_DOMAIN.LOAD,
          verdict: 'partial',
          reasons: [],
          datasetIds: ['load_daily'],
        },
      ],
      unusableDomains: [],
      emptyDomains: [],
    }
    const report = buildDataReliabilityReport(profile, 'fr')
    assert.include(report.title.toLowerCase(), 'fiabilit')
    assert.isAbove(report.sampleRows, 0)

    const empty: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [],
    }
    const first = ensureDataReliabilityBlocks(empty, profile, 'fr')
    assert.isTrue(first.inserted)
    assert.equal(first.document.blocks[0]?.type, PREMIUM_BLOCK_TYPE.HEADING)
    const second = ensureDataReliabilityBlocks(first.document, profile, 'fr')
    assert.isFalse(second.inserted)
  })

})
