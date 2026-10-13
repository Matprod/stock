import { test } from '@japa/runner'
import {
  ensureSectionAnchorsInHtml,
  ensureTocInHtml,
  indexArtifactSections,
} from '#services/report_v4/artifact_sections'

test.group('report_v4 artifact_sections toc', () => {
  test('stamps cover and band ids then builds live toc links', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<div class="cover-panel"><h1 class="cover-title">Staff</h1></div>
<div class="band"><div class="band-title">Load</div></div>
<p>load body</p>
<div class="band"><div class="band-title">Wellness</div></div>
<p>wellness body</p>
</body></html>`
    const anchored = ensureSectionAnchorsInHtml(html)
    assert.isTrue(/id=["']cover["']/i.test(anchored.html))
    assert.isTrue(/id=["']band-section-1["']/i.test(anchored.html))
    assert.isTrue(/id=["']band-section-2["']/i.test(anchored.html))

    const toc = ensureTocInHtml(anchored.html, { language: 'en', reportTitle: 'Staff' })
    assert.isTrue(toc.added)
    assert.isTrue(/href=["']#cover["']/i.test(toc.html))
    assert.isTrue(/href=["']#band-section-1["']/i.test(toc.html))
    assert.isTrue(/href=["']#band-section-2["']/i.test(toc.html))
    assert.isFalse(/href=["']#band-section-9["']/i.test(toc.html))

    const sections = indexArtifactSections(toc.html)
    assert.isAtLeast(sections.length, 2)
    for (const section of sections) {
      assert.isTrue(new RegExp(`id=["']${section.id}["']`, 'i').test(toc.html))
    }
  })
})
