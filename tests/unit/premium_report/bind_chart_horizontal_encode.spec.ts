import { test } from '@japa/runner'
import { bindChartDataset } from '#services/premium_report/premium_report_document'
import type { PremiumDataset } from '#contracts/premium_report'

const matchDataset: PremiumDataset = {
  id: 'ds_match',
  title: 'match',
  columns: ['joueur', 'basketball_player_load', 'basketball_points'],
  rows: [
    { joueur: 'Darius McGhee', basketball_player_load: 420.5, basketball_points: 18 },
    { joueur: 'Tajuan Agee', basketball_player_load: 380.2, basketball_points: 12 },
  ],
}

test.group('bindChartDataset horizontal bar encode', () => {
  test('keeps metric on encode.x for horizontal bars after relabel', ({ assert }) => {
    const bound = bindChartDataset(
      {
        series: [
          {
            name: 'basketball_player_load',
            type: 'bar',
            encode: { y: 'joueur', x: 'basketball_player_load' },
          },
        ],
      },
      matchDataset,
      'en'
    )
    const series0 = Array.isArray(bound.series) ? bound.series[0] : null
    assert.isObject(series0)
    const encode = (series0 as { encode?: { x?: string; y?: string } }).encode
    assert.isString(encode?.x)
    assert.isString(encode?.y)
    assert.notEqual(encode?.x, encode?.y)
    assert.match(String(encode?.x), /player.?load/i)
    assert.match(String(encode?.y), /joueur|player|athlete|name/i)

    const source = (bound.dataset as { source?: unknown[] })?.source
    assert.isArray(source)
    const header = source![0] as string[]
    const xIdx = header.indexOf(encode!.x!)
    assert.isAbove(xIdx, -1)
    const firstVal = (source![1] as unknown[])[xIdx]
    assert.isNumber(Number(firstVal))
    assert.isTrue(Number.isFinite(Number(firstVal)))
  })
})
