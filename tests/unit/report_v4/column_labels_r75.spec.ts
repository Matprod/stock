import { test } from '@japa/runner'
import { displayColumnLabel } from '#services/premium_report/column_labels'
import {
  dedupeAdjacentUnitSpans,
  displayPositionLabel,
  formatValueWithUnit,
  genericColumnLabel,
  resolveColumnLabel,
} from '#services/report_v4/metrics/column_labels'
import { characterizeReportHtml } from './characterization_coach_asks.spec.js'

test.group('column_labels R7.5 §3', () => {
  test('WINGER stays English humanized in any report language', ({ assert }) => {
    assert.equal(displayPositionLabel('WINGER', 'fr'), 'Winger')
    assert.equal(displayPositionLabel('WINGER', 'en'), 'Winger')
  })

  test('generic label from snake_case strips unit token', ({ assert }) => {
    assert.equal(genericColumnLabel('acceleration_time_zone_1_rel'), 'Acceleration time zone 1 rel')
    assert.equal(genericColumnLabel('total_distance_m'), 'Total distance (m)')
    const resolved = resolveColumnLabel('unknown_camelCaseMetric_m', 'en')
    assert.equal(resolved.source, 'generic')
    assert.equal(resolved.label, 'Unknown camel case metric (m)')
  })

  test('known catalog columns resolve without double unit', ({ assert }) => {
    const label = displayColumnLabel('kpi_distanceTotal', 'fr', { units: { kpi_distanceTotal: 'm' } })
    assert.match(label, /Distance total/i)
    assert.equal((label.match(/\bm\b/g) ?? []).length, 1)
  })

  test('formatValueWithUnit never doubles unit', ({ assert }) => {
    assert.equal(formatValueWithUnit({ valueText: '368', unit: 'm/min', language: 'fr' }), '368\u00a0m/min')
    assert.equal(
      formatValueWithUnit({ valueText: '368 m/min', unit: 'm/min', language: 'fr' }),
      '368 m/min'
    )
  })

  test('dedupeAdjacentUnitSpans removes duplicate unit span', ({ assert }) => {
    const html =
      '<div class="value"><span data-fact="gps.top_distance">368&nbsp;m/min</span> <span class="unit">m/min</span></div>'
    const out = dedupeAdjacentUnitSpans(html)
    assert.include(out, 'data-fact="gps.top_distance"')
    assert.notInclude(out, 'class="unit"')
    assert.equal((out.match(/m\/min/g) ?? []).length, 1)
  })

  test('characterization: labeled short table has no raw accel header', ({ assert }) => {
    const label = displayColumnLabel('kpi_accelerationTimeZ1Rel', 'en')
    const html = `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Top 10</h1>
      <table data-block="t1.table"><tr><th>${label}</th></tr></table>
    </body></html>`
    const char = characterizeReportHtml(html)
    assert.isFalse(char.hasError)
    assert.include(char.blockOrder, 't1.table')
    assert.notInclude(html.toLowerCase(), 'kpi_acceleration')
  })
})
