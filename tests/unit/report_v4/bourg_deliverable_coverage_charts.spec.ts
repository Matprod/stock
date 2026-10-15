import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  annotateBriefCoverageShortfall,
  coverageGateMessage,
  evaluateCoverageGate,
} from '#services/report_v4/artifact_runtime/index'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import { finalizeArtifactHtml } from '#services/report_v4/artifact_html'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportBrief } from '#services/report_v4/report_brief'

const sheetsEnvelope = (requiredNames: string[]): ArtifactEnvelope => ({
  mode: 'free',
  contracts: {
    athleteCoverage: 'named',
    requiredAthletes: requiredNames,
    vizOps: [],
    designOps: [],
    requiredMetrics: [],
    softAllowed: false,
    individualSheets: true,
  },
  chartDefaults: { dropEmptyDays: false, markLineValues: [] },
  coverage: { requiredNames, individualSheets: true },
  harvest: { requiredMetrics: [], requireLoadDomain: false },
})

test.group('Bourg deliverable C — coverage shortfall names players', () => {
  test('coverage gate / brief annotation list each missing player with a reason', ({ assert }) => {
    const required = ['Ada', 'Bea', 'Cara', 'Dana', 'Eve']
    const document: PremiumReportDocument = {
      title: 'Sheets',
      dateRange: { from: '2026-10-07', to: '2026-10-14' },
      blocks: [
        { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Ada', level: 2 },
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'Ada — trimp',
          option: { series: [{ type: 'line', data: [1, 2] }] },
        },
        { id: 'h2', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Bea', level: 2 },
      ],
    }
    const coverage = evaluateCoverageGate(document, sheetsEnvelope(required))
    assert.isNotNull(coverage)
    if (!coverage) return
    assert.isFalse(coverage.ok)
    assert.deepEqual(coverage.missing.sort(), ['Cara', 'Dana', 'Eve'].sort())

    const message = coverageGateMessage(coverage)
    assert.include(message, 'Cara')
    assert.include(message, 'Dana')
    assert.include(message, 'Eve')
    assert.match(message, /no data|absent|missing|indisponible|sans données/i)

    const brief: ReportBrief = {
      title: 'Bourg',
      period: { from: '2026-10-07', to: '2026-10-14' },
      focus: 'Individual sheets',
      narrative: ['Squad overview'],
      signals: [],
      sections: [],
    }
    const annotated = annotateBriefCoverageShortfall(brief, coverage, 'fr')
    assert.isNotNull(annotated)
    const blob = `${annotated?.focus ?? ''}\n${(annotated?.narrative ?? []).join('\n')}`
    assert.include(blob, 'Cara')
    assert.include(blob, 'Dana')
    assert.include(blob, 'Eve')
  })
})

test.group('Bourg deliverable D — never ship empty chart slots', () => {
  test('finalizeArtifactHtml rejects or strips empty chart-box hosts with no renderable series', ({
    assert,
  }) => {
    const pack = resolveReportDesignPack('mauna')
    const pad = 'x'.repeat(420)
    const html = `<!DOCTYPE html><html lang="en" data-artifact="free"><head></head><body>
<section class="chart-card"><h3>TRIMP</h3>
<div class="chart-box" id="chart_empty" style="width:100%;height:280px"></div>
</section>
<section class="chart-card"><h3>Distance</h3>
<div class="chart-box" id="chart_ok" style="width:100%;height:280px"></div>
</section>
<!-- ${pad} -->
</body></html>`
    const finalized = finalizeArtifactHtml({
      html,
      charts: [
        {
          id: 'chart_empty',
          title: 'TRIMP',
          option: { series: [{ type: 'line', data: [] }] },
        },
        {
          id: 'chart_ok',
          title: 'Distance',
          option: {
            xAxis: { type: 'category', data: ['a', 'b'] },
            series: [{ type: 'line', data: [1, 2] }],
          },
        },
      ],
      pack,
      language: 'fr',
      injectMissingHosts: false,
      linkDisplayedNumbers: false,
    })
    assert.isTrue(finalized.ok, finalized.ok ? '' : finalized.error)
    if (!finalized.ok) return
    assert.notInclude(
      finalized.html,
      'id="chart_empty"',
      'empty chart host must not ship to PDF (Bourg pages 5–9)'
    )
    assert.include(finalized.html, 'id="chart_ok"')
  })
})
