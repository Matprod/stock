import { test } from '@japa/runner'
import { auditArtifactHtml } from '#services/report_v4/grounding_html'
import {
  detectSoftDeltaGroundingScope,
  extractSoftDeltaHtmlFragments,
  resolveGroundingAuditHtml,
} from '#services/report_v4/grounding_scope'
import type { GroundingAuditInput } from '#services/report_v4/grounding_types'

const baseInput = (): GroundingAuditInput => ({
  roster: [{ name: 'Ada Lovelace' }],
  datasets: [],
  allowNutritionScope: false,
  harvestHasRows: true,
})

test.group('grounding_scope soft delta', () => {
  test('extracts soft-injected fragments only', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<article class="section-block"><p>Prior prose about Monster energy drink</p></article>
<article class="chart-card" data-mauna-soft-injected="1"><h3>Load B</h3><div id="chart_b"></div><p>Ada Lovelace load up</p></article>
</body></html>`
    const fragments = extractSoftDeltaHtmlFragments(html)
    assert.lengthOf(fragments, 1)
    assert.include(fragments[0]!, 'chart_b')
    assert.notInclude(fragments[0]!, 'Monster')
  })

  test('resolve falls back to full html when no delta markers', ({ assert }) => {
    const html = `<html><body><p>Whole report</p></body></html>`
    const resolved = resolveGroundingAuditHtml(html, { mode: 'soft_delta' })
    assert.isFalse(resolved.scoped)
    assert.equal(resolved.html, html)
  })

  test('soft delta audit ignores prior nutrition prose outside injected blocks', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<article class="section-block"><p>Prior note on Monster energy drink macros</p></article>
<article class="chart-card" data-mauna-soft-injected="1"><h3>Load</h3><p>Ada Lovelace steady</p></article>
</body></html>`
    const full = auditArtifactHtml(html, baseInput())
    assert.isFalse(full.ok)
    assert.isTrue(full.violations.some((v) => v.code === 'nutrition_out_of_scope'))

    const scoped = auditArtifactHtml(html, baseInput(), detectSoftDeltaGroundingScope(html))
    assert.isTrue(scoped.ok)
  })
})
