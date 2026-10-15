import { test } from '@japa/runner'
import { assembleFreeDesignerHtml } from '#services/report_v4/free_designer/assemble_document'

test.group('free_designer assemble_document', () => {
  test('embeds theme, fonts as data URLs, and preserves page class', ({ assert }) => {
    const html = assembleFreeDesignerHtml({
      pagesHtml: '<div class="page"><h1 class="headline">Test</h1></div>',
      layoutStyle: '.page.test { gap: 8px; }',
      language: 'en',
    })
    assert.include(html, 'id="mauna-theme"')
    assert.include(html, '--ink:')
    assert.include(html, "data:font/woff2;base64,")
    assert.include(html, 'class="page"')
    assert.include(html, 'data-block-id="page_1"')
    assert.include(html, 'id="mauna-layout"')
    assert.include(html, 'data-artifact="free-designer"')
    assert.notInclude(html, "url('fonts/")
    assert.notInclude(html, '<script')
  })

  test('stamps figure and chart roots when missing ids', ({ assert }) => {
    const html = assembleFreeDesignerHtml({
      pagesHtml: [
        '<div class="page">',
        '<figure class="chart"><svg data-chart="ds:sparkline"></svg></figure>',
        '<div class="chart"></div>',
        '</div>',
      ].join(''),
      language: 'fr',
    })
    assert.include(html, 'lang="fr"')
    assert.match(html, /data-block-id="fig_\d+"/)
    assert.include(html, 'data-chart="ds:sparkline"')
  })
})
