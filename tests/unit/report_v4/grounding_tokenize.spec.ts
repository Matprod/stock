import { test } from '@japa/runner'
import {
  parseLocalizedNumber,
  scanNumbers,
  type ScanContext,
} from '#services/report_v4/grounding_tokenize'

const wrap = (prose: string): string =>
  `<!DOCTYPE html><html><body><p data-block="s1">${prose}</p></body></html>`

const scanProse = (prose: string, ctx: ScanContext = {}) => scanNumbers(wrap(prose), ctx)

const ungroundedValues = (prose: string, ctx?: ScanContext) =>
  scanProse(prose, ctx).ungrounded.map((t) => t.value)

test.group('grounding_tokenizer · phase A', () => {
  test('1 du 14/07/2026 au 12/10/2026 → ignored dates', ({ assert }) => {
    const scan = scanProse('du 14/07/2026 au 12/10/2026')
    assert.lengthOf(scan.ungrounded, 0)
    assert.isTrue(
      scan.ignored.some((i) => i.reason.startsWith('date') || i.reason === 'year')
    )
  })

  test('2 le 25 septembre 2025 → ignored date letters', ({ assert }) => {
    assert.lengthOf(scanProse('le 25 septembre 2025').ungrounded, 0)
  })

  test('3 2025-10-01 → ignored ISO date', ({ assert }) => {
    assert.lengthOf(scanProse('2025-10-01').ungrounded, 0)
  })

  test('4 entre le 20 et le 25 septembre → ignored date range', ({ assert }) => {
    assert.lengthOf(scanProse('entre le 20 et le 25 septembre').ungrounded, 0)
  })

  test('5 J-3, J+2 → ignored day markers', ({ assert }) => {
    assert.lengthOf(scanProse('J-3, J+2').ungrounded, 0)
  })

  test('6 semaine 5, S5 → ignored week markers', ({ assert }) => {
    assert.lengthOf(scanProse('semaine 5, S5').ungrounded, 0)
  })

  test('7 19h30, 19:30 → ignored times', ({ assert }) => {
    assert.lengthOf(scanProse('19h30, 19:30').ungrounded, 0)
  })

  test('8 1er octobre, 2e match, 3ème → ignored ordinals', ({ assert }) => {
    assert.lengthOf(scanProse('1er octobre, 2e match, 3ème').ungrounded, 0)
  })

  test('9 de 0 à 18 sur 100 → two numbers to ground', ({ assert }) => {
    const values = ungroundedValues('de 0 à 18 sur 100')
    assert.lengthOf(values, 2)
    assert.deepEqual(values.sort((a, b) => a - b), [0, 18])
  })

  test('10 18 % → anchor with percent unit', ({ assert }) => {
    const scan = scanProse('18 %')
    assert.lengthOf(scan.ungrounded, 1)
    assert.equal(scan.ungrounded[0]?.value, 18)
    assert.equal(scan.ungrounded[0]?.unit?.toLowerCase(), '%')
  })

  test('11 1 000 U/L with nbsp → value 1000', ({ assert }) => {
    const scan = scanProse('1\u00a0000 U/L')
    assert.lengthOf(scan.ungrounded, 1)
    assert.equal(scan.ungrounded[0]?.value, 1000)
    assert.equal(scan.ungrounded[0]?.unit?.toUpperCase(), 'U/L')
  })

  test('12 1,000 U/L english → value 1000', ({ assert }) => {
    const scan = scanProse('1,000 U/L', { language: 'en' })
    assert.lengthOf(scan.ungrounded, 1)
    assert.equal(scan.ungrounded[0]?.value, 1000)
  })

  test('13 12,5 french decimal → 12.5', ({ assert }) => {
    assert.equal(parseLocalizedNumber('12,5', 'fr'), 12.5)
    assert.equal(ungroundedValues('12,5')[0], 12.5)
  })

  test('14 2 000 thin space → 2000', ({ assert }) => {
    assert.equal(ungroundedValues('2\u202f000')[0], 2000)
  })

  test('15 trois blessures → word count to ground', ({ assert }) => {
    const scan = scanProse('trois blessures')
    assert.lengthOf(scan.ungrounded, 1)
    assert.equal(scan.ungrounded[0]?.kind, 'word')
    assert.equal(scan.ungrounded[0]?.value, 3)
  })

  test('16 un joueur, une semaine → articles ignored', ({ assert }) => {
    assert.lengthOf(scanProse('un joueur, une semaine').ungrounded, 0)
  })

  test('17 deux fois → ignored without count noun', ({ assert }) => {
    assert.lengthOf(scanProse('deux fois').ungrounded, 0)
  })

  test('18 attributes chart id and data-block ignored', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body><div id="chart_injury_gantt" data-block="s2.fig1" class="chart-box"></div><p>ok</p></body></html>`
    assert.lengthOf(scanNumbers(html).ungrounded, 0)
  })

  test('19 section numbering and list indexes ignored', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body><h2 data-block="s1.title">01 · Blessures</h2><ol><li>1. Premier</li><li>2. Second</li></ol></body></html>`
    assert.lengthOf(scanNumbers(html).ungrounded, 0)
  })

  test('20 footer pagination 2 / 3 ignored', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body><div class="foot">2 / 3</div><p>note</p></body></html>`
    assert.lengthOf(scanNumbers(html).ungrounded, 0)
  })

  test('21 proper names with digits ignored', ({ assert }) => {
    const scan = scanProse('U19, Ligue 1, FC Exemple 2', {
      properNames: ['FC Exemple 2', 'Ligue 1', 'U19'],
    })
    assert.lengthOf(scan.ungrounded, 0)
  })

  test('22 jersey n° 9 ignored when in roster', ({ assert }) => {
    assert.lengthOf(scanProse('n° 9', { jerseyNumbers: [9] }).ungrounded, 0)
  })

  test('23 isolated year in report window ignored', ({ assert }) => {
    assert.lengthOf(
      scanProse('Bilan 2026', {
        displayRange: { from: '2026-01-01', to: '2026-12-31' },
      }).ungrounded,
      0
    )
  })

  test('24 wellness scale bounds ignored', ({ assert }) => {
    assert.lengthOf(
      scanProse('échelle 1 = très bien, 6 = très mal', {
        wellnessScales: [{ min: 1, max: 6 }],
      }).ungrounded,
      0
    )
  })

  test('25 fact threshold ignored', ({ assert }) => {
    assert.lengthOf(
      scanProse('seuil ≥ 1 000 U/L', {
        facts: [{ id: 'ck.over_1000_count', value: 3, thresholds: [1000] }],
        factThresholds: [1000],
      }).ungrounded,
      0
    )
  })

  test('26 number inside data-fact span ignored', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body><p>CK peaks: <span data-fact="ck.over_1000_count">18</span>.</p></body></html>`
    assert.lengthOf(scanNumbers(html).ungrounded, 0)
  })

  test('27 number in table cell outside prose scan', ({ assert }) => {
    const html = `<!DOCTYPE html><html><body><table><tr><td>18</td></tr></table><p>ok</p></body></html>`
    assert.lengthOf(scanNumbers(html).ungrounded, 0)
  })

  test('28 18 with matching fact → matched not ungrounded', ({ assert }) => {
    const scan = scanProse('18', {
      facts: [{ id: 'inj.count', value: 18 }],
    })
    assert.lengthOf(scan.ungrounded, 0)
    assert.lengthOf(scan.matched, 1)
    assert.equal(scan.matched[0]?.factId, 'inj.count')
  })

  test('incident Hambourg dates 2025-12-01 → 2025-12-31 produce no rejects', ({ assert }) => {
    const scan = scanProse('Period 2025-12-01 → 2025-12-31 (December 2025).')
    assert.lengthOf(scan.ungrounded, 0)
  })
})
