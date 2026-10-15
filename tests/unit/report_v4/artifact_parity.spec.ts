import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  evaluateArtifactParity,
  type BlockOrigin,
} from '#services/report_v4/artifact_parity'
import { stampDataBlockIdsInHtml } from '#services/report_v4/artifact_html'
import { stripExternalPdfAssetHosts } from '#services/report_v4/playwright_pdf'
import { buildPackFontFaceCss, echartsLocalScriptTag } from '#services/report_v4/report_v4_assets'
import { REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES } from '#services/report_v4/report_v4_constants'

const doc = (blocks: PremiumReportDocument['blocks']): PremiumReportDocument => ({
  title: 'Staff',
  dateRange: { from: '2026-03-01', to: '2026-03-07' },
  blocks,
})

test.group('artifact parity + local assets', () => {
  test('parity ok when blocks, order, texts, hosts and origins match', ({ assert }) => {
    const document = doc([
      { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Load', level: 1 },
      { id: 't1', type: PREMIUM_BLOCK_TYPE.TEXT, text: 'Squad ACWR stable.' },
      {
        id: 'c1',
        type: PREMIUM_BLOCK_TYPE.CHART,
        title: 'ACWR',
        option: { series: [{ type: 'line', data: [1, 2] }] },
      },
    ])
    const raw = `<!DOCTYPE html><html><body>
      <h2>Load</h2>
      <p>Squad ACWR stable.</p>
      <div class="chart-card"><div class="chart-box" id="chart_c1"></div></div>
    </body></html>`
    const html = stampDataBlockIdsInHtml(raw, document, 'generate' satisfies BlockOrigin)
    const parity = evaluateArtifactParity(document, html)
    assert.isTrue(parity.ok)
    assert.equal(parity.documentBlockCount, 3)
    assert.include(html, 'data-block-origin="generate"')
  })

  test('parity flags text mismatch and missing chart host', ({ assert }) => {
    const document = doc([
      { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Load', level: 1 },
      {
        id: 'c1',
        type: PREMIUM_BLOCK_TYPE.CHART,
        title: 'ACWR',
        option: { series: [{ type: 'line', data: [1] }] },
      },
    ])
    const html = `<!DOCTYPE html><html><body>
      <h2 data-block-id="h1" data-block-origin="generate">Wellness</h2>
      <div data-block-id="c1" data-block-origin="generate"></div>
    </body></html>`
    const parity = evaluateArtifactParity(document, html)
    assert.isFalse(parity.ok)
    assert.isTrue(parity.issues.some((row) => row.kind === 'text_mismatch'))
    assert.isTrue(parity.issues.some((row) => row.kind === 'missing_chart_host'))
  })

  test('local font css and echarts have no external hosts', ({ assert }) => {
    const css = buildPackFontFaceCss('mauna')
    assert.include(css, '@font-face')
    assert.include(css, 'data:font/woff2;base64,')
    assert.notInclude(css, 'fonts.googleapis.com')
    assert.notInclude(css, 'fonts.gstatic.com')
    const tag = echartsLocalScriptTag()
    assert.include(tag, 'id="mauna-echarts"')
    assert.include(tag, '/reports/report-v4/assets/echarts.min.js')
    assert.notInclude(tag, 'cdn.jsdelivr.net')
    assert.notMatch(tag, /<script[^>]*>[^<]{200,}/)
    assert.deepEqual([...REPORT_V4_PDF_ALLOWED_HOST_SUFFIXES], ['amazonaws.com'])
    const dirty = `<link href="https://fonts.googleapis.com/css2?family=Inter">
<link href="https://fonts.gstatic.com/s/inter.woff2" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Roboto');</style>
<script src="https://cdn.jsdelivr.net/npm/echarts"></script><p>ok</p>`
    const clean = stripExternalPdfAssetHosts(dirty)
    assert.notInclude(clean, 'fonts.googleapis.com')
    assert.notInclude(clean, 'fonts.gstatic.com')
    assert.notInclude(clean, 'cdn.jsdelivr.net')
    assert.include(clean, '<p>ok</p>')
  })
})
