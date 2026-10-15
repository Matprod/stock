import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { rebuildAthleteSheetsInArtifactHtml } from '#services/report_v4/artifact_html'

test.group('R7.6 §5 athlete sheets rebuild', () => {
  test('rebuild keeps all sheet headings from build_athlete_sheets canvas', ({ assert }) => {
    const names = Array.from({ length: 12 }, (_, i) => `Player ${String(i + 1).padStart(2, '0')}`)
    const blocks: PremiumReportDocument['blocks'] = []
    for (const name of names) {
      blocks.push({
        id: `h-${name}`,
        type: PREMIUM_BLOCK_TYPE.HEADING,
        text: name,
        level: 2,
      })
      blocks.push({
        id: `t-${name}`,
        type: PREMIUM_BLOCK_TYPE.TEXT,
        text: name === names[11] ? 'No data for the period' : `${name} summary`,
      })
      if (name !== names[11]) {
        blocks.push({
          id: `c-${name}`,
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'total_distance',
          chartType: 'line',
          option: { series: [{ name }] },
        })
      }
    }
    const document: PremiumReportDocument = {
      title: 'Sheets',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks,
    }
    const html = `<!DOCTYPE html><html><body><main></main></body></html>`
    const rebuilt = rebuildAthleteSheetsInArtifactHtml(html, document, { athleteNames: names })
    assert.equal(rebuilt.sections, 12)
    for (const name of names) {
      assert.include(rebuilt.html, name)
    }
  })
})
