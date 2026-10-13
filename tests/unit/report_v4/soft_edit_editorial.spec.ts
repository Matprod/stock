import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { indexArtifactSections, tocPresentInHtml } from '#services/report_v4/artifact_sections'
import { pruneOrphanChartHostsInHtml } from '#services/report_v4/artifact_html'
import type { SoftEditIntentFlags } from '#services/report_v4/classify_soft_edit_intent'
import { softEditFlagsFromHaikuJson } from '#services/report_v4/classify_soft_edit_intent'
import { buildSoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import { resolveSoftEditOps, applyResolvedSoftEditorial } from '#services/report_v4/soft_edit_ops'
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

const NONE: SoftEditIntentFlags = {
  wantsToc: false,
  wantsRemove: false,
  stripEmpty: false,
  wantsTeamMean: false,
  enrichExistingCharts: false,
  restoreSheets: false,
  addSectionProse: false,
  layoutRepair: false,
  residualNeedsAnalyst: false,
}

const softFlags = (partial: Partial<SoftEditIntentFlags>): SoftEditIntentFlags => ({
  ...NONE,
  ...partial,
})

test.group('soft_edit_ops router', () => {
  test('parses TOC + delete scatter as multi-op editorial plan', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ wantsRemove: true, wantsToc: true }),
      'delete the Sleep Quality vs Mood – Scatter that is empty and add a table of contents',
      null,
      ['Sleep Quality vs Mood – Scatter']
    )
    assert.isTrue(plan.editorialOnly)
    assert.isFalse(plan.needsAnalyst)
    assert.isTrue(plan.ensureToc)
    assert.include(plan.removeQueries, 'Sleep Quality vs Mood – Scatter')
  })

  test('haiku json maps soft edit flags', ({ assert }) => {
    const mapped = softEditFlagsFromHaikuJson({
      wants_toc: true,
      wants_remove: false,
      strip_empty: 'true',
      wants_team_mean: 0,
      enrich_existing_charts: false,
      restore_sheets: true,
      add_section_prose: false,
      layout_repair: false,
      residual_needs_analyst: false,
    })
    assert.isTrue(mapped.wantsToc)
    assert.isTrue(mapped.stripEmpty)
    assert.isTrue(mapped.restoreSheets)
    assert.isFalse(mapped.wantsTeamMean)
  })

  test('restore sheets + descriptive texts is additive soft', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ restoreSheets: true, addSectionProse: true }),
      'Restore the individual sheets and add descriptive texts under each block'
    )
    assert.isTrue(plan.restoreSheets)
    assert.isTrue(plan.addSectionProse)
    assert.isTrue(plan.additiveSoft)
    assert.isTrue(plan.needsFetch)
    assert.isFalse(plan.editorialOnly)
  })

  test('poorly orchestrated sheets is layout repair reshape', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ layoutRepair: true }),
      'Individual sheets are broken, athletes are not linked to their charts — reorganize pairing'
    )
    assert.isTrue(plan.layoutRepair)
    assert.isFalse(plan.additiveSoft)
    assert.isFalse(plan.needsFetch)
    assert.isTrue(plan.needsAnalyst)
    assert.isFalse(plan.editorialOnly)
  })

  test('descriptive texts + TOC is not editorial-only', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ wantsToc: true, addSectionProse: true }),
      'Add descriptive texts for each section and add a table of contents'
    )
    assert.isTrue(plan.ensureToc)
    assert.isFalse(plan.editorialOnly)
    assert.isTrue(plan.needsAnalyst)
    assert.isTrue(plan.addSectionProse)
  })

  test('missing individual sheets restores with fetch', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ restoreSheets: true }),
      'Some players are missing individual sheets'
    )
    assert.isTrue(plan.restoreSheets)
    assert.isTrue(plan.needsFetch)
    assert.isFalse(plan.editorialOnly)
  })

  test('duplicate empty executive summary remove does not strip_empty alone', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ wantsRemove: true, restoreSheets: true }),
      'I have empty executive summary duplicates — remove it. Also restore individual performance and injury player charts.',
      null,
      ['executive summary']
    )
    assert.include(plan.removeQueries.map((q) => q.toLowerCase()), 'executive summary')
    assert.isFalse(plan.ops.some((op) => op.type === 'strip_empty_sections'))
    assert.isTrue(plan.restoreSheets)
    assert.isTrue(plan.needsFetch)
  })

  test('team mean ask sets wantsTeamMean without dead overlay op', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ wantsTeamMean: true }),
      'Add team mean overlay on the performance chart'
    )
    assert.isTrue(plan.wantsTeamMean)
    assert.isTrue(plan.hasDataOps)
    assert.isFalse(plan.ops.some((op) => (op as { type: string }).type === 'overlay_team_mean'))
  })

  test('enrich existing individual charts routes as enrichExistingCharts', ({ assert }) => {
    const plan = resolveSoftEditOps(
      softFlags({ enrichExistingCharts: true }),
      'On the individual focus graphs, add energy rating data with body soreness'
    )
    assert.isTrue(plan.enrichExistingCharts)
    assert.isTrue(plan.needsFetch)
    assert.isFalse(plan.additiveSoft)
    assert.isFalse(plan.editorialOnly)
  })

  test('inventory titles resolve remove queries without hardcodes', ({ assert }) => {
    const inventory = buildSoftCanvasInventory({
      document: fixtureDocument(),
      html: fixtureHtml(),
    })
    const plan = resolveSoftEditOps(
      softFlags({ wantsRemove: true }),
      'Please remove Monster Radar from the report',
      inventory,
      ['Monster Radar']
    )
    assert.include(
      plan.removeQueries.map((q) => q.toLowerCase()),
      'monster radar'
    )
  })
})

test.group('soft_edit_editorial', () => {
  test('indexes sections by band title and chart hosts', ({ assert }) => {
    const sections = indexArtifactSections(fixtureHtml())
    assert.lengthOf(sections, 3)
  })

  test('delete scatter + TOC removes scatter and adds TOC', ({ assert }) => {
    const ops = resolveSoftEditOps(
      softFlags({ wantsRemove: true, wantsToc: true }),
      'delete the Sleep Quality vs Mood – Scatter that is empty and add a table of contents',
      null,
      ['Sleep Quality vs Mood – Scatter']
    )
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
    const inventory = buildSoftCanvasInventory({ document, html })
    const ops = resolveSoftEditOps(
      softFlags({ wantsRemove: true }),
      'Remove the biomarkers sections',
      inventory,
      ['Biomarker CK']
    )
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
