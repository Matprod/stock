import { test } from '@japa/runner'
import { bindStaffFactTokens } from '#services/report_v4/staff_render/facts_bind'
import {
  buildHambourgReferenceDocument,
  buildHambourgStaffFacts,
} from '#services/report_v4/staff_render/hambourg_reference_document'
import { loadHambourgFixture } from '#services/report_v4/staff_render/hambourg_fixture'
import { parseStaffReportDocument } from '#services/report_v4/staff_render/schema'
import { renderStaffReportHtml } from '#services/report_v4/staff_render/render_report'
import { buildStaffBarlowFontFaceCss } from '#services/report_v4/staff_render/staff_fonts'
import {
  auditStaffReportVisual,
  formatStaffVisualAuditReport,
} from '#services/report_v4/staff_render/visual_audit'
import { formatStaffNumber } from '#services/report_v4/staff_render/format'
import { isReportV4StaffComponentsEnabled } from '#services/report_v4/report_v4_constants'
import { createDesignerTools } from '#services/report_v4/agents/stage_tools'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'

test.group('staff_render schema + facts', () => {
  test('vine accepts a valid document and refuses unknown component', async ({ assert }) => {
    const ok = await parseStaffReportDocument({
      language: 'fr',
      pages: [{ blocks: [{ component: 'Masthead', data: { title: 'Hello' } }] }],
    })
    assert.isTrue(ok.ok)

    const bad = await parseStaffReportDocument({
      pages: [{ blocks: [{ component: 'NotAThing', data: {} }] }],
    })
    assert.isFalse(bad.ok)
    if (!bad.ok) assert.equal(bad.code, 'vine_error')
  })

  test('fact tokens are replaced and literals warn', ({ assert }) => {
    const facts = new Map([
      ['poulsen.risque_moyen', { id: 'poulsen.risque_moyen', value: 63.57, digits: 1 }],
    ])
    const bound = bindStaffFactTokens('Risque {{fait:poulsen.risque_moyen}}', facts)
    assert.equal(bound.text, `Risque ${formatStaffNumber(63.57, { maximumFractionDigits: 1 })}`)
    assert.equal(bound.replaced, 1)
  })
})

test.group('staff_render hambourg reference', () => {
  test('renders fixture document with exact KPI figures and visual audit report', ({ assert }) => {
    const fixture = loadHambourgFixture()
    const document = buildHambourgReferenceDocument(fixture)
    const facts = buildHambourgStaffFacts(fixture)
    const rendered = renderStaffReportHtml({
      document,
      facts,
      fontFaceCss: buildStaffBarlowFontFaceCss(),
    })
    assert.isAbove(rendered.html.length, 2000)
    assert.include(rendered.html, 'Barlow')
    assert.include(rendered.html, '1 / 4')
    assert.include(rendered.html, formatStaffNumber(49.7, { maximumFractionDigits: 1 }))
    assert.include(rendered.html, formatStaffNumber(7.58, { maximumFractionDigits: 2 }))
    assert.include(rendered.html, formatStaffNumber(3187, { maximumFractionDigits: 0 }))
    assert.include(rendered.html, 'Yussuf Poulsen')
    assert.include(rendered.html, 'Bakery Jatta')
    assert.include(rendered.html, 'data-component="LineChart"')
    assert.include(rendered.html, 'data-component="Heatmap"')
    assert.include(rendered.html, 'data-component="NotProducedBlock"')
    assert.equal(rendered.missingFacts.length, 0)

    const visual = auditStaffReportVisual({
      html: rendered.html,
      announcedChartCount: rendered.chartCount,
    })
    const report = formatStaffVisualAuditReport(visual)
    assert.isString(report)
    assert.isFalse(visual.some((row) => row.code === 'empty_page'))
  })
})

test.group('staff_render designer flag', () => {
  test('REPORT_V4_STAFF_COMPONENTS switches designer tools', ({ assert }) => {
    const run = {
      facts: new Map(),
      htmlArtifact: null,
      agentState: { mustUseTools: true, document: { title: 't', blocks: [] }, heatScales: {} },
    } as unknown as ReportV4RunState
    const prev = process.env.REPORT_V4_STAFF_COMPONENTS
    process.env.REPORT_V4_STAFF_COMPONENTS = '1'
    assert.isTrue(isReportV4StaffComponentsEnabled())
    const tools = createDesignerTools({
      run,
      clubName: 'Hambourg',
      language: 'fr',
      designPack: resolveReportDesignPack('mauna'),
      populatedDomains: ['scores'],
    })
    assert.deepEqual(
      tools.map((t) => t.schema.name),
      ['get_design_context', 'set_staff_report']
    )
    if (prev === undefined) delete process.env.REPORT_V4_STAFF_COMPONENTS
    else process.env.REPORT_V4_STAFF_COMPONENTS = prev
  })
})
