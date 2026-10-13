import { test } from '@japa/runner'
import {
  healMissingChartHosts,
  shouldAttemptHostHeal,
} from '#services/report_v4/artifact_delta_repair'
import type { ArtifactChartSpec } from '#services/report_v4/artifact_html'

const chart = (id: string, title: string): ArtifactChartSpec =>
  ({
    id,
    title,
    option: { series: [{ type: 'line', data: [1, 2] }] },
  }) as ArtifactChartSpec

test.group('artifact_delta_repair host heal', () => {
  test('shouldAttemptHostHeal only when missing hosts alone', ({ assert }) => {
    assert.isTrue(
      shouldAttemptHostHeal({
        missingHosts: ['chart_a'],
        proseMiss: false,
        editorialGatesOk: true,
      })
    )
    assert.isFalse(
      shouldAttemptHostHeal({
        missingHosts: ['chart_a'],
        proseMiss: true,
        editorialGatesOk: true,
      })
    )
    assert.isFalse(
      shouldAttemptHostHeal({
        missingHosts: [],
        proseMiss: false,
        editorialGatesOk: true,
      })
    )
  })

  test('heals a single missing host without full redesign', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<article class="chart-card"><div id="chart_a" class="chart-box"></div></article>
</body></html>`
    const charts = [chart('chart_a', 'A'), chart('chart_b', 'B')]
    const result = healMissingChartHosts({ html, charts })
    assert.isTrue(result.healed)
    assert.equal(result.injected, 1)
    assert.deepEqual(result.missingBefore, ['chart_b'])
    assert.deepEqual(result.missingAfter, [])
    assert.include(result.html, 'id="chart_b"')
    assert.include(result.html, 'data-mauna-soft-injected="1"')
  })

  test('no-op when all hosts present', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<div id="chart_a" class="chart-box"></div>
<div id="chart_b" class="chart-box"></div>
</body></html>`
    const charts = [chart('chart_a', 'A'), chart('chart_b', 'B')]
    const result = healMissingChartHosts({ html, charts })
    assert.isFalse(result.healed)
    assert.equal(result.injected, 0)
    assert.equal(result.html, html)
  })

  test('refuses heal when artifact would be too thin', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<div id="chart_a" class="chart-box"></div>
</body></html>`
    const charts = [
      chart('chart_a', 'A'),
      chart('chart_b', 'B'),
      chart('chart_c', 'C'),
      chart('chart_d', 'D'),
    ]
    const result = healMissingChartHosts({ html, charts })
    assert.isFalse(result.healed)
    assert.isTrue(result.tooThin)
    assert.equal(result.injected, 0)
    assert.lengthOf(result.missingBefore, 3)
  })
})
