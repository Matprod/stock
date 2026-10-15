import { test } from '@japa/runner'
import { hbars, renderChartSvg, CHART_SVG_TYPE } from '#services/report_v4/chart_svg/index'
import { projectFactsForDesign, type ReportFact } from '#services/report_v4/report_facts'
import {
  buildProgressEvent,
  FULL_GENERATION_STEPS,
  LOCAL_EDIT_STEPS,
} from '#services/report_v4/progress_events'
import { formatReportDate, formatReportNumber } from '#services/report_v4/format_locale'
import { humanizeTechnicalName } from '#services/report_v4/metrics/column_labels'
import { syncDocumentFromFreeDesignerHtml } from '#services/report_v4/free_designer/sync_document_from_html'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'

test.group('chart_svg hbars bars and legends', () => {
  test('each bar has width > 0 and chart colors', ({ assert }) => {
    const svg = hbars({
      items: [
        { label: 'Ada', value: 278 },
        { label: 'Bea', value: 183 },
        { label: 'Cid', value: 71 },
      ],
      ref: { value: 177, label: 'Team mean (AU)' },
      missingNote: '3 players without GPS data',
      w: 360,
    })
    const widths = [...svg.matchAll(/width="([0-9.]+)"/g)].map((m) => Number(m[1]))
    assert.isAtLeast(widths.filter((w) => w >= 2).length, 3)
    assert.include(svg, 'var(--perf)')
    assert.include(svg, 'var(--perf-4)')
    assert.include(svg, '3 players without GPS data')
    assert.include(svg, 'Team mean (AU)')
  })

  test('sorted_bars via renderChartSvg keeps positive bar widths', ({ assert }) => {
    const result = renderChartSvg({
      type: CHART_SVG_TYPE.SORTED_BARS,
      datasetId: 'load_by_player',
      dataset: {
        items: [
          { label: 'A', value: 10 },
          { label: 'B', value: 20 },
        ],
      },
    })
    assert.isUndefined(result.error)
    assert.match(result.svg, /width="[1-9]/)
  })
})

test.group('fact nature projection', () => {
  test('projected facts expose op/nature for titles', ({ assert }) => {
    const facts: ReportFact[] = [
      {
        id: 'gps.load.max',
        value: 278,
        sourceDatasetId: 'gps',
        column: 'movement_load',
        op: 'max',
      },
      {
        id: 'gps.load.mean',
        value: 183,
        sourceDatasetId: 'gps',
        column: 'movement_load',
        op: 'mean',
      },
    ]
    const projected = projectFactsForDesign(facts)
    assert.equal(projected[0]?.nature, 'max')
    assert.equal(projected[1]?.nature, 'mean')
    assert.match(projected[0]?.label ?? '', /maximum/i)
    assert.match(projected[1]?.label ?? '', /mean/i)
  })
})

test.group('progress events', () => {
  test('full generation and local edit expose stable steps + status', ({ assert }) => {
    const full = buildProgressEvent({
      step: 'design_pages',
      language: 'fr',
      steps: FULL_GENERATION_STEPS,
    })
    assert.equal(full.step, 'design_pages')
    assert.equal(full.status, full.label)
    assert.equal(full.index, 5)
    assert.equal(full.total, FULL_GENERATION_STEPS.length)

    const edit = buildProgressEvent({
      step: 'apply_edit',
      language: 'en',
      steps: LOCAL_EDIT_STEPS,
    })
    assert.equal(edit.step, 'apply_edit')
    assert.equal(edit.index, 2)
    assert.equal(edit.total, 3)
  })
})

test.group('format locale + humanize', () => {
  test('Intl formats numbers and dates per language', ({ assert }) => {
    assert.match(formatReportNumber(1080, 'fr'), /^1[\s\u00a0\u202f]080$/)
    assert.equal(formatReportNumber(1080, 'en'), '1,080')
    assert.match(formatReportDate('2026-10-08', 'fr'), /oct/i)
    assert.match(formatReportDate('2026-10-08', 'en'), /Oct/)
  })

  test('humanizeTechnicalName examples', ({ assert }) => {
    assert.equal(humanizeTechnicalName('kpi_maxdeceleration'), 'Max deceleration')
    assert.equal(humanizeTechnicalName('hours_in_bed'), 'Hours in bed')
    assert.equal(humanizeTechnicalName('CENTRAL DEFENDER'), 'Central defender')
  })
})

test.group('free designer canvas sync', () => {
  test('syncs document blocks from stamped free-designer HTML', ({ assert }) => {
    const html = `<!DOCTYPE html><html data-artifact="free-designer"><body>
      <div class="page" data-block-id="page_1"><h1 class="headline">Title</h1></div>
      <div class="page" data-block-id="page_2"><figure data-block-id="fig_1"><svg data-chart="ds:sorted_bars"></svg></figure></div>
    </body></html>`
    const doc = emptyPremiumDocument({ from: '2026-10-05', to: '2026-10-11' }, [])
    doc.blocks = [
      { id: 'old1', type: 'text', text: 'stale' },
      { id: 'old2', type: 'text', text: 'stale' },
    ]
    const synced = syncDocumentFromFreeDesignerHtml(doc, html)
    assert.equal(synced.blocks.length, 3)
    assert.equal(synced.blocks[0]?.id, 'page_1')
    assert.equal(synced.blocks[2]?.id, 'fig_1')
  })
})
