import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { artifactChartHostId } from '#services/report_v4/artifact_html'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { runSoftRebind } from '#services/report_v4/soft_rebind'

const twoChartDocument = (): PremiumReportDocument => ({
  title: 'Staff report',
  dateRange: { from: '2026-01-01', to: '2026-01-07' },
  blocks: [
    {
      id: 'a',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Load A',
      option: { series: [{ type: 'line', data: [1, 2] }] },
    },
    {
      id: 'b',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Load B',
      option: { series: [{ type: 'line', data: [3, 4] }] },
    },
  ],
})

const priorHtmlMissingExistingHost = (): string => {
  const hostA = artifactChartHostId('a')
  return `<!DOCTYPE html>
<html data-artifact="free">
<head><title>Staff</title></head>
<body>
<main>
<article class="section-block" id="sec-a">
  <div class="band"><h2>Load A</h2></div>
  <div class="card"><div id="${hostA}" class="chart-box"></div></div>
</article>
</main>
<script id="mauna-artifact-boot">window.__MAUNA_BOOT=true</script>
</body>
</html>`
}

test.group('soft_rebind host heal', () => {
  test('heals lost host on existing chart without designer escalate', ({ assert }) => {
    const document = twoChartDocument()
    const hostB = artifactChartHostId('b')
    const result = runSoftRebind({
      priorHtml: priorHtmlMissingExistingHost(),
      document,
      priorDocument: document,
      priorBlockIds: new Set(['a', 'b']),
      priorChartCount: 2,
      softOps: {
        ops: [{ type: 'ensure_toc' }],
        editorialOnly: true,
        needsAnalyst: false,
        needsFetch: false,
        removeQueries: [],
        ensureToc: true,
        hasDataOps: false,
        restoreSheets: false,
        addSectionProse: false,
        additiveSoft: false,
        layoutRepair: false,
        wantsTeamMean: false,
        enrichExistingCharts: false,
      },
      softProseOnly: false,
      softEditorialOnly: true,
      softEditorialAppliedEarly: false,
      recommendationStrip: false,
      canvasAskKind: PREMIUM_CANVAS_ASK.MICRO_EDIT,
      heatScales: [],
      designPack: resolveReportDesignPack('mauna'),
      language: 'en',
      clubName: 'Test FC',
      progress: () => undefined,
    })

    assert.isFalse(result.softRebindRepair, `blocked=${result.softBlocked.join(',')}`)
    assert.isFalse(result.needsFreshArtifact)
    assert.isString(result.htmlArtifact)
    assert.include(result.htmlArtifact ?? '', hostB)
    assert.include(result.htmlArtifact ?? '', 'data-mauna-soft-injected')
  })
})
