import { test } from '@japa/runner'
import { freeArtifactTooThinForCharts } from '#services/report_v4/artifact_html'
import { assertSoftEditorialGates } from '#services/report_v4/artifact_sections'

test.group('artifact fallback gates', () => {
  test('freeArtifactTooThinForCharts gates 75% missing hosts', ({ assert }) => {
    assert.isFalse(
      freeArtifactTooThinForCharts({ chartCount: 2, injectedCharts: 2, presentHosts: 0 })
    )
    assert.isFalse(
      freeArtifactTooThinForCharts({ chartCount: 4, injectedCharts: 2, presentHosts: 2 })
    )
    assert.isTrue(
      freeArtifactTooThinForCharts({ chartCount: 4, injectedCharts: 3, presentHosts: 1 })
    )
    assert.isTrue(
      freeArtifactTooThinForCharts({ chartCount: 8, injectedCharts: 0, presentHosts: 1 })
    )
  })

  test('assertSoftEditorialGates ignores soft-delta attributes', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body data-mauna-soft-delta="1">
<section class="page toc" id="toc"><h2>Contents</h2></section>
</body></html>`
    const gates = assertSoftEditorialGates({
      html,
      removeQueries: [],
      ensureToc: true,
    })
    assert.isTrue(gates.ok)
    assert.notInclude(gates.errors.join(','), 'soft_delta')
  })
})
