import { test } from '@japa/runner'
import { CHART_SVG_TYPE, renderChartSvg } from '#services/report_v4/chart_svg/index'
import { displayPositionLabel, resolveColumnLabel } from '#services/report_v4/metrics/column_labels'
import { replaceEmptyChartHostsInHtml } from '#services/report_v4/empty_block_unavailable'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test.group('chart_svg radar / scatter / lines_band', () => {
  test('radar renders up to 5 axes for one player', ({ assert }) => {
    const result = renderChartSvg({
      type: CHART_SVG_TYPE.RADAR,
      datasetId: 'wellness_radar',
      options: {
        axes: [
          { key: 'mood', label: 'Humeur', max: 5 },
          { key: 'stress', label: 'Stress', max: 5 },
          { key: 'energy', label: 'Énergie', max: 5 },
          { key: 'soreness', label: 'Courbatures', max: 5 },
          { key: 'sleep', label: 'Sommeil', max: 5 },
        ],
        series: [{ name: 'Joueur A', values: [4, 2, 3, 3, 4], focus: true }],
      },
    })
    assert.isUndefined(result.error)
    assert.include(result.svg, '<svg')
    assert.include(result.svg, 'Humeur')
    assert.include(result.svg, 'Joueur A')
  })

  test('scatter sleep × mood renders points', ({ assert }) => {
    const result = renderChartSvg({
      type: CHART_SVG_TYPE.SCATTER,
      datasetId: 'sleep_mood',
      options: {
        points: [
          { label: 'A', x: 7.2, y: 4, focus: true, side: 'r' },
          { label: 'B', x: 6.1, y: 3 },
        ],
        xDom: [5, 9],
        yDom: [1, 5],
        xTicks: [5, 7, 9],
        yTicks: [1, 3, 5],
        xTitle: 'Heures au lit',
        yTitle: 'Humeur',
      },
    })
    assert.isUndefined(result.error)
    assert.include(result.svg, 'Heures au lit')
    assert.include(result.svg, 'Humeur')
  })

  test('lines_band draws team mean with min-max envelope', ({ assert }) => {
    const result = renderChartSvg({
      type: CHART_SVG_TYPE.LINES_BAND,
      datasetId: 'team_load',
      options: {
        xLabels: ['L', 'M', 'M', 'J', 'V'],
        mean: [40, 42, 38, 45, 41],
        min: [20, 22, 18, 25, 21],
        max: [60, 62, 58, 65, 61],
        meanName: 'Moyenne équipe',
      },
    })
    assert.isUndefined(result.error)
    assert.include(result.svg, 'polygon')
    assert.include(result.svg, 'Moyenne équipe')
  })
})

test.group('labels and positions', () => {
  test('fallback labels cover run columns in English humanized form', ({ assert }) => {
    assert.equal(resolveColumnLabel('kpi_maxdeceleration', 'fr').label, 'Max deceleration')
    assert.equal(resolveColumnLabel('hours_in_bed', 'fr').label, 'Hours in bed')
    assert.equal(resolveColumnLabel('movement_load', 'fr').label, 'Movement load')
    assert.equal(resolveColumnLabel('biomarqueur', 'fr').label, 'Biomarqueur')
    assert.notMatch(resolveColumnLabel('kpi_maxdeceleration', 'fr').label, /_/)
  })

  test('CENTRAL DEFENDER stays English humanized regardless of report language', ({ assert }) => {
    assert.equal(displayPositionLabel('CENTRAL DEFENDER', 'fr'), 'Central defender')
    assert.equal(displayPositionLabel('Left Back', 'fr'), 'Left back')
    assert.equal(displayPositionLabel('CENTRAL DEFENDER', 'en'), 'Central defender')
  })
})

test.group('empty hosts → unavailable', () => {
  test('replaces empty chart-box with localized line', ({ assert }) => {
    const html =
      '<div class="page"><div class="chart-box" data-title="VALD"></div><div class="chart-box"><svg data-chart="ok:lines"></svg></div></div>'
    const out = replaceEmptyChartHostsInHtml(html, 'fr')
    assert.equal(out.replaced, 1)
    assert.include(out.html, 'non disponible')
    assert.include(out.html, 'VALD')
    assert.include(out.html, 'data-chart="ok:lines"')
  })
})

test.group('language ask only', () => {
  test('controller ignores HTTP language header', ({ assert }) => {
    const src = readFileSync(
      join(process.cwd(), 'app/services/report_v4/controller.ts'),
      'utf8'
    )
    assert.include(src, 'detectReportLanguage(payload.prompt)')
    assert.notInclude(src, "header('x-language')")
  })
})
