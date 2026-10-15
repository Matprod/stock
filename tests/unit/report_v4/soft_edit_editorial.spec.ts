import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { indexArtifactSections, tocPresentInHtml } from '#services/report_v4/artifact_sections'
import { pruneOrphanChartHostsInHtml } from '#services/report_v4/artifact_html'
import {
  applyResolvedSoftEditorial,
  type SoftEditOpsPlan,
} from '#services/report_v4/soft_edit_ops'
import { resolveSoftEditTargets } from '#services/premium_report/soft_edit_targets'

const fixtureHtml = (): string => `<!DOCTYPE html>
<html>
<body>
<section class="page cover" id="cover"><div class="band"><h1>Cover</h1></div></section>
<main>
<article class="section-block" id="sec-monster">
  <div class="band"><h2>Monster Radar</h2></div>
  <div class="card"><div id="chart_monster01" class="chart-box"></div></div>
</article>
<article class="section-block" id="sec-scatter">
  <div class="band"><h2>Sleep Quality vs Mood – Scatter</h2></div>
  <div class="card"><div id="chart_scatter01" class="chart-box"></div></div>
</article>
<article class="section-block" id="sec-wellness">
  <div class="band"><h2>Wellness Energy Trend</h2></div>
  <div class="card"><div id="chart_wellness01" class="chart-box"></div></div>
</article>
</main>
<script id="mauna-artifact-boot">window.__MAUNA_BOOT=true</script>
</body>
</html>`

const fixtureDocument = (): PremiumReportDocument => ({
  title: 'Staff report',
  dateRange: { from: '2026-01-01', to: '2026-01-31' },
  blocks: [
    {
      id: 'monster-01',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Monster Radar',
      option: {
        series: [{ type: 'radar', data: [{ value: [1, 2, 3] }] }],
      },
    },
    {
      id: 'scatter-01',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Sleep Quality vs Mood – Scatter',
      option: { series: [{ type: 'scatter', data: [] }] },
    },
    {
      id: 'wellness-01',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Wellness Energy Trend',
      option: {
        series: [{ type: 'line', data: [4, 5, 6] }],
      },
    },
  ],
})

const editorialPlan = (args: {
  removeQueries?: string[]
  ensureToc?: boolean
  stripEmpty?: boolean
}): SoftEditOpsPlan => {
  const removeQueries = args.removeQueries ?? []
  const ops: SoftEditOpsPlan['ops'] = []
  for (const query of removeQueries) {
    ops.push({ type: 'remove_section', query })
  }
  if (args.ensureToc) ops.push({ type: 'ensure_toc' })
  if (args.stripEmpty) ops.push({ type: 'strip_empty_sections' })
  return {
    ops,
    editorialOnly: true,
    needsAnalyst: false,
    needsFetch: false,
    removeQueries,
    ensureToc: Boolean(args.ensureToc),
    hasDataOps: false,
    restoreSheets: false,
    addSectionProse: false,
    additiveSoft: false,
    layoutRepair: false,
    wantsTeamMean: false,
    enrichExistingCharts: false,
  }
}

test.group('soft_edit_editorial', () => {
  test('indexes sections by band title and chart hosts', ({ assert }) => {
    const sections = indexArtifactSections(fixtureHtml())
    assert.lengthOf(sections, 3)
  })

  test('delete scatter + TOC removes scatter and adds TOC', ({ assert }) => {
    const ops = editorialPlan({
      removeQueries: ['Sleep Quality vs Mood – Scatter'],
      ensureToc: true,
    })
    const result = applyResolvedSoftEditorial({
      html: fixtureHtml(),
      document: fixtureDocument(),
      ops,
      language: 'fr',
      clubName: 'Test FC',
      reportTitle: 'Staff report',
    })
    assert.isFalse(/Sleep Quality vs Mood/i.test(result.html))
    assert.isTrue(tocPresentInHtml(result.html))
    assert.isTrue(result.gates.ok)
  })

  test('remove allowlist does not over-match wellness for scatter delete', ({ assert }) => {
    const ids = resolveSoftEditTargets(
      'delete the Sleep Quality vs Mood – Scatter that is empty',
      fixtureDocument()
    )
    assert.include(ids, 'scatter-01')
    assert.notInclude(ids, 'wellness-01')
  })

  test('removes biomarker domain sections by domain keyword', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body>
<article class="section-block" id="sec-bio">
  <div class="band"><h2>Biomarker &amp; Physical Test</h2></div>
  <div class="card"><div id="chart_bio01" class="chart-box"></div></div>
</article>
<article class="section-block" id="sec-gps">
  <div class="band"><h2>GPS Distance</h2></div>
  <div class="card"><div id="chart_gps01" class="chart-box"></div></div>
</article>
</body></html>`
    const document: PremiumReportDocument = {
      title: 'Staff report',
      dateRange: { from: '2026-03-01', to: '2026-03-07' },
      blocks: [
        {
          id: 'bio-chart',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'Biomarker CK',
          option: { series: [{ type: 'bar', data: [1, 2] }] },
        },
        {
          id: 'gps-01',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'GPS Distance',
          option: { series: [{ type: 'line', data: [1, 2] }] },
        },
      ],
    }
    const ops = editorialPlan({ removeQueries: ['Biomarker CK'] })
    const result = applyResolvedSoftEditorial({
      html,
      document,
      ops,
      language: 'en',
      clubName: 'Sunderland',
    })
    assert.isTrue(result.removed.length >= 1)
    assert.isFalse(/Biomarker/i.test(result.html))
    assert.isTrue(/GPS Distance/i.test(result.html))
  })

  test('pruneOrphanChartHostsInHtml drops hosts without matching boot chart', ({ assert }) => {
    const pruned = pruneOrphanChartHostsInHtml(fixtureHtml(), [{ id: 'chart_monster01' }])
    assert.isTrue(/chart_monster01/.test(pruned.html))
    assert.isFalse(/chart_scatter01/.test(pruned.html))
    assert.isFalse(/chart_wellness01/.test(pruned.html))
  })
})
