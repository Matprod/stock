import { test } from '@japa/runner'
import { parseHTML } from 'linkedom'

export type ReportCharacterization = {
  titles: string[]
  blockOrder: string[]
  chartCount: number
  chartIds: string[]
  hasError: boolean
}

const ERROR_MARKERS = [
  'generation failed',
  'rapport echoue',
  'rapport échoué',
  'stack trace',
  'cannot read',
  'undefined is not',
]

export const characterizeReportHtml = (html: string): ReportCharacterization => {
  const wrapped = html.includes('<html')
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`
  const { document } = parseHTML(wrapped)
  const titles = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const blockOrder = Array.from(document.querySelectorAll('[data-block]'))
    .map((el) => el.getAttribute('data-block') ?? '')
    .filter(Boolean)
  const chartNodes = Array.from(document.querySelectorAll('.chart-box[id], div.chart-box[id]'))
  const chartIds = chartNodes.map((el) => el.getAttribute('id') ?? '').filter(Boolean)
  const plain = (document.body?.textContent ?? document.documentElement?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  const hasErrorAttr = Boolean(document.querySelector('[data-mauna-error], .report-error'))
  return {
    titles,
    blockOrder,
    chartCount: chartIds.length,
    chartIds,
    hasError: hasErrorAttr || ERROR_MARKERS.some((marker) => plain.includes(marker.toLowerCase())),
  }
}

type CoachAskCase = {
  id: string
  prompt: string
  html: string
  expectTitles: string[]
  expectBlockOrder: string[]
  expectChartCount: number
}

const cases: CoachAskCase[] = [
  {
    id: 'wellness_7d',
    prompt: 'Bilan wellness des 7 derniers jours avec courbe de courbatures et sommeil',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Wellness — 7 jours</h1>
      <h2 data-block="s1.title">Courbatures</h2>
      <div class="chart-box" id="chart_soreness" data-block="s1.chart"></div>
      <h2 data-block="s2.title">Sommeil</h2>
      <div class="chart-box" id="chart_sleep" data-block="s2.chart"></div>
    </body></html>`,
    expectTitles: ['Wellness — 7 jours', 'Courbatures', 'Sommeil'],
    expectBlockOrder: ['p1.title', 's1.title', 's1.chart', 's2.title', 's2.chart'],
    expectChartCount: 2,
  },
  {
    id: 'acwr_all',
    prompt: 'Montre l’ACWR pour tous les joueurs individuellement',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">ACWR individuel</h1>
      <h2 data-block="a1.title">Ada</h2>
      <div class="chart-box" id="chart_acwr_ada" data-block="a1.chart"></div>
      <h2 data-block="a2.title">Bea</h2>
      <div class="chart-box" id="chart_acwr_bea" data-block="a2.chart"></div>
      <h2 data-block="t.title">Moyenne équipe</h2>
      <div class="chart-box" id="chart_acwr_team" data-block="t.chart"></div>
    </body></html>`,
    expectTitles: ['ACWR individuel', 'Ada', 'Bea', 'Moyenne équipe'],
    expectBlockOrder: [
      'p1.title',
      'a1.title',
      'a1.chart',
      'a2.title',
      'a2.chart',
      't.title',
      't.chart',
    ],
    expectChartCount: 3,
  },
  {
    id: 'injuries',
    prompt: 'Rapport blessures sur la période avec tableau et frise',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Blessures sur la période</h1>
      <div class="chart-box" id="chart_injury_gantt" data-block="s1.chart"></div>
      <table data-block="s1.table"><tr><td>ok</td></tr></table>
    </body></html>`,
    expectTitles: ['Blessures sur la période'],
    expectBlockOrder: ['p1.title', 's1.chart', 's1.table'],
    expectChartCount: 1,
  },
  {
    id: 'gps_hsr',
    prompt: 'Distance totale et HSR GPS sur 14 jours',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">GPS — distance et HSR</h1>
      <h2 data-block="s1.title">Distance totale</h2>
      <div class="chart-box" id="chart_distance" data-block="s1.chart"></div>
      <h2 data-block="s2.title">HSR</h2>
      <div class="chart-box" id="chart_hsr" data-block="s2.chart"></div>
    </body></html>`,
    expectTitles: ['GPS — distance et HSR', 'Distance totale', 'HSR'],
    expectBlockOrder: ['p1.title', 's1.title', 's1.chart', 's2.title', 's2.chart'],
    expectChartCount: 2,
  },
  {
    id: 'biomarkers_ck',
    prompt: 'Biomarqueurs CK : qui dépasse 1000 U/L',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">CK au-dessus de 1 000 U/L</h1>
      <div class="chart-box" id="chart_ck" data-block="s1.chart"></div>
      <table data-block="s1.table"><tr><td>Ada</td></tr></table>
    </body></html>`,
    expectTitles: ['CK au-dessus de 1 000 U/L'],
    expectBlockOrder: ['p1.title', 's1.chart', 's1.table'],
    expectChartCount: 1,
  },
  {
    id: 'sleep_team',
    prompt: 'Qualité de sommeil de l’équipe sur 30 jours',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Sommeil équipe — 30 jours</h1>
      <div class="chart-box" id="chart_sleep_team" data-block="s1.chart"></div>
    </body></html>`,
    expectTitles: ['Sommeil équipe — 30 jours'],
    expectBlockOrder: ['p1.title', 's1.chart'],
    expectChartCount: 1,
  },
  {
    id: 'match_stats',
    prompt: 'Stats de match du dernier mois avec minutes et charges',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Stats de match</h1>
      <h2 data-block="s1.title">Minutes jouées</h2>
      <div class="chart-box" id="chart_minutes" data-block="s1.chart"></div>
      <h2 data-block="s2.title">Charge match</h2>
      <div class="chart-box" id="chart_match_load" data-block="s2.chart"></div>
    </body></html>`,
    expectTitles: ['Stats de match', 'Minutes jouées', 'Charge match'],
    expectBlockOrder: ['p1.title', 's1.title', 's1.chart', 's2.title', 's2.chart'],
    expectChartCount: 2,
  },
  {
    id: 'soft_acwr_thresholds',
    prompt: 'Ajoute les seuils ACWR 0,6 et 1,3 sur le graphique existant',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">ACWR avec seuils</h1>
      <div class="chart-box" id="chart_acwr" data-block="s1.chart"></div>
      <p data-block="s1.note">Seuils 0,6 et 1,3</p>
    </body></html>`,
    expectTitles: ['ACWR avec seuils'],
    expectBlockOrder: ['p1.title', 's1.chart', 's1.note'],
    expectChartCount: 1,
  },
  {
    id: 'soft_stronger_titles',
    prompt: 'Renforce les titres et resserre l’espacement',
    html: `<!DOCTYPE html><html><body class="report mauna-title-strong">
      <h1 data-block="p1.title">Charge récente</h1>
      <h2 data-block="s1.title">sRPE quotidien</h2>
      <div class="chart-box" id="chart_srpe" data-block="s1.chart"></div>
    </body></html>`,
    expectTitles: ['Charge récente', 'sRPE quotidien'],
    expectBlockOrder: ['p1.title', 's1.title', 's1.chart'],
    expectChartCount: 1,
  },
  {
    id: 'soft_drop_empty_days',
    prompt: 'Enlève les jours vides des courbes de charge',
    html: `<!DOCTYPE html><html><body>
      <h1 data-block="p1.title">Charge sans jours vides</h1>
      <div class="chart-box" id="chart_load" data-block="s1.chart"></div>
    </body></html>`,
    expectTitles: ['Charge sans jours vides'],
    expectBlockOrder: ['p1.title', 's1.chart'],
    expectChartCount: 1,
  },
]

test.group('report_v4 characterization · 10 coach asks', () => {
  for (const ask of cases) {
    test(`${ask.id}: titles, block order, charts, no error`, ({ assert }) => {
      assert.isAbove(ask.prompt.trim().length, 10)
      const got = characterizeReportHtml(ask.html)
      assert.deepEqual(got.titles, ask.expectTitles)
      assert.deepEqual(got.blockOrder, ask.expectBlockOrder)
      assert.equal(got.chartCount, ask.expectChartCount)
      assert.isFalse(got.hasError)
    })
  }

  test('detects error banner in broken html', ({ assert }) => {
    const got = characterizeReportHtml(
      `<!DOCTYPE html><html><body><h1>Fail</h1><p class="report-error">generation failed</p></body></html>`
    )
    assert.isTrue(got.hasError)
  })
})
