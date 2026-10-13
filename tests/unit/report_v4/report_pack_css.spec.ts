import { test } from '@japa/runner'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { buildReportPackCss, buildReportPrintCss } from '#services/report_v4/design/report_pack_css'

test.group('report_pack_css', () => {
  test('mauna pack css embeds soft cover and IBM fonts', ({ assert }) => {
    const css = buildReportPackCss(resolveReportDesignPack('mauna'))
    assert.include(css, '--cover: #152033')
    assert.include(css, '--primary: #2a78d6')
    assert.include(css, 'IBM Plex Sans')
    assert.include(css, 'scroll-margin-top')
  })

  test('clinical pack css swaps teal tokens', ({ assert }) => {
    const css = buildReportPackCss(resolveReportDesignPack('clinical'))
    assert.include(css, '--cover: #134e4a')
    assert.include(css, '--primary: #0f8f62')
    assert.include(css, 'Source Sans 3')
    assert.notInclude(css, '--cover: #152033')
  })

  test('editorial pack css swaps black/red tokens', ({ assert }) => {
    const css = buildReportPackCss(resolveReportDesignPack('editorial'))
    assert.include(css, '--cover: #111827')
    assert.include(css, '--primary: #6250d6')
    assert.include(css, 'Libre Franklin')
  })

  test('print css uses pack CSS variables', ({ assert }) => {
    const css = buildReportPrintCss()
    assert.include(css, 'var(--primary')
    assert.include(css, 'var(--paper')
    assert.include(css, 'var(--navy')
  })
})
