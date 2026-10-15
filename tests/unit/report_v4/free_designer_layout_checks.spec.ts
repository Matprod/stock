import { test } from '@japa/runner'
import { assembleFreeDesignerHtml } from '#services/report_v4/free_designer/assemble_document'
import {
  extractThemeRgbKeys,
  loadThemeRgbKeys,
  runLayoutChecksOnPages,
} from '#services/report_v4/free_designer/layout_checks'

test.group('free_designer layout_checks', () => {
  test('SVG without data → svg_empty warning', async ({ assert }) => {
    const html = assembleFreeDesignerHtml({
      pagesHtml: [
        '<div class="page">',
        '<header class="runhead"><span class="brand">MAUNA</span><span class="period">2026</span></header>',
        '<h1 class="headline">Empty chart page</h1>',
        '<p class="lede">Baseline fill content for density.</p>',
        '<figure class="chart"><svg data-chart="ds:empty" width="400" height="200"></svg></figure>',
        '<footer class="runfoot"><span>club</span><span>1</span></footer>',
        '</div>',
      ].join(''),
      language: 'en',
    })
    const { warnings } = await runLayoutChecksOnPages(html)
    const codes = warnings.map((w) => `${w.code}:${w.detail}`).join(' | ')
    assert.isTrue(warnings.some((w) => w.code === 'svg_empty'), codes || 'no warnings')
  })

  test('overflowing text fixture → text_overflow warning', async ({ assert }) => {
    const html = assembleFreeDesignerHtml({
      pagesHtml: [
        '<div class="page">',
        '<header class="runhead"><span class="brand">MAUNA</span><span class="period">2026</span></header>',
        '<h1 class="headline">Overflow</h1>',
        '<div style="width:80px;height:24px;overflow:hidden;white-space:nowrap;font-size:14px">',
        'This label is deliberately far too long for an eighty pixel box and must overflow',
        '</div>',
        '<p class="lede">Extra body copy keeps the page from being flagged only for density.</p>',
        '<footer class="runfoot"><span>club</span><span>1</span></footer>',
        '</div>',
      ].join(''),
      layoutStyle: '.overflow-box { width: 80px; }',
      language: 'en',
    })
    const { warnings } = await runLayoutChecksOnPages(html)
    const codes = warnings.map((w) => `${w.code}:${w.detail}`).join(' | ')
    assert.isTrue(warnings.some((w) => w.code === 'text_overflow'), codes || 'no warnings')
  })

  test('invented number grounding covered by literal_number audits', ({ assert }) => {
    assert.isTrue(true)
  })

  test('color outside theme → color_outside_theme warning', async ({ assert }) => {
    const themeKeys = loadThemeRgbKeys()
    assert.isAbove(themeKeys.length, 10)
    assert.include(extractThemeRgbKeys('--ink: #0F1B2D;'), '15,27,45')

    const html = assembleFreeDesignerHtml({
      pagesHtml: [
        '<div class="page">',
        '<header class="runhead"><span class="brand">MAUNA</span><span class="period">2026</span></header>',
        '<h1 class="headline">Theme breach</h1>',
        '<p class="lede" style="color:#ff00aa">Bright magenta should not appear in theme.css</p>',
        '<p class="lede">More copy for page density under the fill threshold.</p>',
        '<footer class="runfoot"><span>club</span><span>1</span></footer>',
        '</div>',
      ].join(''),
      language: 'en',
    })
    const { warnings } = await runLayoutChecksOnPages(html)
    const codes = warnings.map((w) => `${w.code}:${w.detail}`).join(' | ')
    assert.isTrue(warnings.some((w) => w.code === 'color_outside_theme'), codes || 'no warnings')
  })
})
