import { test } from '@japa/runner'
import {
  CHART_SVG_TYPE,
  renderChartSvg,
  riskClass,
  perfClass,
} from '#services/report_v4/chart_svg/index'

const FERREIRA_RISK = [47, 51, 58, 66, 71, 72, 70]
const LINDQVIST_RISK = [69, 68, 70, 63, 18, 15, 12]
const DAYS = ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8']
const WEEKS = ['W5', 'W6', 'W7', 'W8', 'W9', 'W10']
const TEAM_LOAD = [2310, 2480, 2390, 2620, 2150, 2710]
const CHRONIC = [2280, 2340, 2370, 2450, 2410, 2468]
const ACWR_LINDQVIST = [0.94, 1.02, 0.98, 1.11, 1.18, 1.52]
const ACWR_FERREIRA = [1.01, 0.96, 1.04, 1.12, 0.99, 1.08]
const ACWR_TEAM = [0.98, 1.03, 0.99, 1.06, 0.89, 1.09]
const AVAILABILITY = [
  [19, 2, 3],
  [19, 2, 3],
  [20, 1, 3],
  [20, 1, 3],
  [21, 0, 3],
  [20, 1, 3],
  [21, 0, 3],
]
const INJURIES = [
  {
    who: 'A. Keller',
    what: 'Hamstring',
    start: 6.4,
    end: 11.2,
    ongoing: true,
    phase: 'Individual return',
  },
  {
    who: 'Y. Diallo',
    what: 'Ankle sprain',
    start: 8.2,
    end: 12.3,
    ongoing: true,
    phase: 'Reconditioning',
  },
  {
    who: 'M. Costa',
    what: 'Adductors',
    start: 9.1,
    end: 11.4,
    ongoing: true,
    phase: 'Individual return',
  },
  {
    who: 'Q. Laurent',
    what: 'Knee contusion',
    start: 4.3,
    end: 6.1,
    ongoing: false,
    phase: 'Recovered',
  },
]
const MEAN_FATIGUE = {
  'T. Lindqvist': 6.1,
  'K. Osei': 4.9,
  'M. Ferreira': 4.6,
  'A. Moreau': 4.9,
  'S. Kowalczyk': 4.1,
  'F. Dumont': 4.1,
  'D. Varga': 3.6,
  'L. Brandt': 3.4,
  'E. Haddad': 3.9,
  'J. Okafor': 3.3,
  'R. Silva': 3.1,
  'P. Nieminen': 3.0,
  'B. Traoré': 3.7,
  'C. Rossi': 2.9,
  'H. Yilmaz': 2.7,
  'G. Petrov': 3.2,
  'V. Mensah': 3.5,
  'I. Berger': 3.8,
}
const FATIGUE_TEAM = [3, 3, 4, 4, 5, 4, 4]
const FATIGUE_PANELS = [
  { title: 'T. Lindqvist', values: [4, 5, 6, 7, 8, 7, 6] },
  { title: 'K. Osei', values: [3, 4, 5, 6, 6, 5, 5] },
  { title: 'M. Ferreira', values: [3, 3, 4, 5, 6, 6, 5] },
]
const POS_BARS = [
  { label: 'Attacking mid. (4)', value: 3210 },
  { label: 'Winger (3)', value: 3060 },
  { label: 'Forward (4)', value: 2905 },
  { label: 'Full-back (3)', value: 2900 },
  { label: 'Centre-back (3)', value: 2660 },
  { label: 'Defensive mid. (2)', value: 2380 },
]
const DEV_ITEMS = [
  { label: 'Lindqvist', value: 23 },
  { label: 'Ferreira', value: 19 },
  { label: 'Okafor', value: -4 },
  { label: 'Berger', value: -12 },
]
const MATRIX_ROWS = [
  {
    label: 'M. Ferreira',
    risk: FERREIRA_RISK,
    perf: [52, 46, 60, 49, 45, 41, 47],
    riskMean: 62.1,
    perfMean: 48.6,
    focus: true,
  },
  {
    label: 'T. Lindqvist',
    risk: LINDQVIST_RISK,
    perf: [70, 58, 50, 56, 41, 63, 71],
    riskMean: 45.0,
    perfMean: 58.4,
    focus: true,
  },
  {
    label: 'A. Moreau',
    risk: [18, 16, 17, 19, 17, 17, 18],
    perf: [51, 50, 46, 52, 44, 41, 43],
    riskMean: 17.4,
    perfMean: 46.7,
  },
]

const countClass = (svg: string, cls: string) =>
  (svg.match(new RegExp(`class="${cls}"`, 'g')) || []).length

const valueLabelCount = (svg: string) => countClass(svg, 'value')

test.group('chart_svg', () => {
  test('sparkline labels start peak trough last only', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.SPARKLINE,
      datasetId: 'ferreira_risk',
      dataset: { values: FERREIRA_RISK },
    })
    assert.isUndefined(error)
    assert.include(svg, 'data-chart="ferreira_risk:sparkline"')
    assert.include(svg, 'class="line-risk"')
    assert.include(svg, 'class="dot-risk"')
    assert.include(svg, 'aria-label="Daily risk"')
    assert.equal(valueLabelCount(svg), 3)
    assert.isBelow(valueLabelCount(svg), FERREIRA_RISK.length)
    assert.match(svg, /<text class="value"[^>]*>47<\/text>/)
    assert.match(svg, /<text class="value"[^>]*>72<\/text>/)
    assert.match(svg, /<text class="value"[^>]*>70<\/text>/)
  })

  test('lines chart has series end labels and selected point values', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.LINES,
      datasetId: 'player_scores',
      dataset: {
        xLabels: DAYS,
        sessionDays: [1, 2, 3, 4],
        series: [
          {
            kind: 'risk',
            name: 'Risk',
            values: FERREIRA_RISK,
            labelAt: [0, 5],
            below: [],
          },
          {
            kind: 'perf',
            name: 'Perf',
            values: [52, 46, 60, 49, 45, 41, 47],
            labelAt: [2],
            below: [2],
          },
        ],
        annotation: { from: 1, to: 5, text: '+21 points in 4 days' },
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'class="line-risk"')
    assert.include(svg, 'class="line-perf"')
    assert.include(svg, 'class="dot-risk"')
    assert.include(svg, 'class="dot-perf"')
    assert.include(svg, 'class="annot"')
    assert.include(svg, 'Risk 70')
    assert.include(svg, 'Perf 47')
    assert.isBelow(valueLabelCount(svg), FERREIRA_RISK.length * 2)
  })

  test('sorted bars leader uses bar-lead and values at bar ends', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.SORTED_BARS,
      datasetId: 'gps_distance',
      dataset: {
        items: POS_BARS,
        w: 333,
        row: 22,
        labelW: 124,
        ref: { value: 2872, label: 'team' },
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'class="bar-lead"')
    assert.include(svg, 'class="bar"')
    assert.include(svg, 'class="line-ref"')
    assert.include(svg, 'aria-label="Ranking"')
    assert.equal(valueLabelCount(svg), POS_BARS.length)
    assert.include(svg, '3,210')
  })

  test('gap to reference signed labels and axis', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.GAP_TO_REFERENCE,
      datasetId: 'hmld_gap',
      dataset: { items: DEV_ITEMS, span: 30 },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Gap to reference"')
    assert.include(svg, 'class="bar-lead"')
    assert.include(svg, 'class="axis"')
    assert.include(svg, '+23%')
    assert.include(svg, '\u221212%')
    assert.include(svg, 'position mean')
  })

  test('small multiples share ref line and end labels', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.SMALL_MULTIPLES,
      datasetId: 'fatigue_panels',
      dataset: {
        panels: FATIGUE_PANELS,
        ref: FATIGUE_TEAM,
        yMin: 1,
        yMax: 10,
        ticks: [1, 4, 7, 10],
        cols: 3,
        xFrom: '2 Mar',
        xTo: '8 Mar',
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Small multiples"')
    assert.include(svg, 'class="line-ref"')
    assert.isAtLeast(countClass(svg, 'line-ref'), 3)
    assert.isAtLeast(valueLabelCount(svg), 3)
    assert.isBelow(valueLabelCount(svg), FATIGUE_PANELS.length * 7)
  })

  test('scatter labels only focus points', ({ assert }) => {
    const points = [
      { label: 'T. Lindqvist', x: 1.52, y: 45, focus: true, side: 'l' as const },
      { label: 'M. Ferreira', x: 1.08, y: 62.1, focus: true, side: 'r' as const },
      { label: 'K. Osei', x: 1.34, y: 7.7, focus: true, side: 'r' as const },
      { label: 'A. Moreau', x: 1.21, y: 17.4 },
      { label: 'D. Varga', x: 0.97, y: 7.3 },
    ]
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.SCATTER,
      datasetId: 'acwr_risk',
      dataset: {
        points,
        w: 698,
        h: 250,
        xDom: [0.8, 1.6],
        yDom: [0, 80],
        xTicks: [0.8, 1.0, 1.2, 1.4, 1.6],
        yTicks: [0, 20, 40, 60, 80],
        xRef: { v: 1.3, label: 'threshold 1.3' },
        yRef: { v: 20, label: 'risk 20' },
        xTitle: 'ACWR this week',
        yTitle: 'Mean risk (0–100)',
        zones: [{ x: 1.58, y: 76, text: 'high load, high risk', anchor: 'end' }],
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Scatter"')
    assert.include(svg, 'class="line-ref"')
    assert.include(svg, 'T. Lindqvist')
    assert.include(svg, 'M. Ferreira')
    assert.notInclude(svg, '>A. Moreau<')
    assert.equal(valueLabelCount(svg), 3)
  })

  test('acwr band and end-of-line labels', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.ACWR,
      datasetId: 'acwr_week',
      dataset: {
        labels: WEEKS,
        w: 333,
        h: 200,
        series: [
          { name: 'Lindqvist', values: ACWR_LINDQVIST, color: 'var(--series-1)' },
          { name: 'Ferreira', values: ACWR_FERREIRA, color: 'var(--series-2)' },
          { name: 'Team', values: ACWR_TEAM, ref: true },
        ],
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'class="band"')
    assert.include(svg, 'class="line-ref"')
    assert.include(svg, 'Lindqvist 1.52')
    assert.include(svg, 'Ferreira 1.08')
    assert.include(svg, 'Team 1.09')
    assert.equal(valueLabelCount(svg), 3)
  })

  test('columns plus line highlights last and peak columns', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.COLUMNS_LINE,
      datasetId: 'team_load',
      dataset: {
        labels: WEEKS,
        cols: TEAM_LOAD,
        line: CHRONIC,
        w: 333,
        h: 200,
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Weekly load"')
    assert.include(svg, 'class="bar-lead"')
    assert.include(svg, 'class="bar"')
    assert.include(svg, '2,710')
    assert.isBelow(valueLabelCount(svg), TEAM_LOAD.length)
  })

  test('stacked columns write counts inside tall segments', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.STACKED_COLUMNS,
      datasetId: 'availability',
      dataset: {
        labels: ['2', '3', '4', '5', '6', '7', '8'],
        parts: AVAILABILITY,
        colors: ['var(--avail-ok)', 'var(--avail-mod)', 'var(--avail-out)'],
        total: 24,
        w: 333,
        h: 210,
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Availability by day"')
    assert.include(svg, 'var(--avail-ok)')
    assert.match(svg, /<text class="value"[^>]*>19<\/text>/)
    assert.isAtLeast(valueLabelCount(svg), 7)
  })

  test('timeline marks today and absence bars', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.TIMELINE,
      datasetId: 'injuries',
      dataset: { rows: INJURIES, from: 3, to: 13, now: 10, w: 698 },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Absences by player"')
    assert.include(svg, 'class="grid"')
    assert.include(svg, 'today')
    assert.include(svg, 'A. Keller')
    assert.include(svg, 'stroke-dasharray="3 2"')
    assert.include(svg, 'W10')
  })

  test('distribution labels focus athletes only', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.DISTRIBUTION,
      datasetId: 'wellness_dist',
      dataset: {
        rows: [
          {
            title: 'Fatigue',
            values: MEAN_FATIGUE,
            focus: ['T. Lindqvist', 'M. Ferreira'],
          },
        ],
        dom: [1, 10],
        ticks: [1, 5, 10],
        w: 698,
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'aria-label="Distribution"')
    assert.include(svg, 'median')
    assert.include(svg, 'T. Lindqvist 6.1')
    assert.include(svg, 'M. Ferreira 4.6')
    assert.equal(valueLabelCount(svg), 2)
    assert.isBelow(valueLabelCount(svg), Object.keys(MEAN_FATIGUE).length)
  })

  test('matrix heatmap uses risk and performance ramp classes', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: CHART_SVG_TYPE.MATRIX,
      datasetId: 'team_matrix',
      dataset: {
        rows: MATRIX_ROWS,
        dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        dayNumbers: [2, 3, 4, 5, 6, 7, 8],
      },
    })
    assert.isUndefined(error)
    assert.include(svg, 'data-chart="team_matrix:matrix"')
    assert.include(svg, 'class="chart-matrix"')
    assert.include(svg, 'class="mx focus"')
    assert.include(svg, 'class="mx team"')
    assert.include(svg, 'class="r3"')
    assert.include(svg, 'class="p4"')
    assert.include(svg, 'M. Ferreira')
    assert.equal(riskClass(72), 'r3')
    assert.equal(riskClass(8), 'r0')
    assert.equal(perfClass(70), 'p4')
    assert.equal(perfClass(30), 'p0')
  })

  test('unknown type returns error', ({ assert }) => {
    const { svg, error } = renderChartSvg({
      type: 'pie',
      datasetId: 'x',
      dataset: {},
    })
    assert.equal(svg, '')
    assert.include(error ?? '', 'unknown chart type')
  })
})
