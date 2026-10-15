import { test } from '@japa/runner'
import { selectFreeDesignerReferences } from '#services/report_v4/free_designer/select_references'

test.group('free_designer select_references', () => {
  test('always includes 02-summary', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: [],
      individualSheets: false,
      language: 'en',
    })
    assert.isAtLeast(refs.length, 1)
    assert.equal(refs[0]?.id, '02-summary')
    assert.include(refs[0]?.bodyHtml ?? '', 'class="page"')
    assert.notInclude(refs[0]?.bodyHtml ?? '', '<head>')
    assert.notInclude(refs[0]?.bodyHtml ?? '', '</head>')
  })

  test('caps at 4 pages total', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: ['scores', 'load', 'gps', 'wellness', 'injury', 'match'],
      individualSheets: true,
      hasLongTable: true,
      multiSection: true,
      pageCountHint: 8,
      language: 'en',
    })
    assert.isAtMost(refs.length, 4)
    assert.include(
      refs.map((r) => r.id),
      '02-summary'
    )
  })

  test('uses fr references path when language is fr', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: ['scores'],
      individualSheets: false,
      language: 'fr',
    })
    assert.equal(refs[0]?.id, '02-summary')
    assert.equal(refs[0]?.filename, '02-summary.html')
    assert.match(refs[0]?.bodyHtml ?? '', /Synthèse|résumé|staff|joueurs/i)
  })

  test('uses en references path otherwise', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: ['scores'],
      individualSheets: false,
      language: 'en',
    })
    assert.equal(refs[0]?.id, '02-summary')
    assert.match(refs[0]?.bodyHtml ?? '', /Summary|Staff|players/i)
  })

  test('adds team-matrix for scores domain', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: ['scores'],
      individualSheets: false,
      language: 'en',
    })
    assert.deepEqual(
      refs.map((r) => r.id),
      ['02-summary', '03-team-matrix']
    )
  })
})
