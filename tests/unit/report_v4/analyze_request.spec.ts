import { test } from '@japa/runner'
import { analyzeRequest } from '#services/report_v4/analyze_request'

test.group('analyzeRequest', () => {
  test('empty prompt returns heuristic defaults without a model call', async ({ assert }) => {
    const result = await analyzeRequest('   ')
    assert.equal(result.provider, 'heuristic')
    assert.deepEqual(result.askDomains, [])
    assert.isFalse(result.periodFollowUp)
    assert.isFalse(result.multiSection)
    assert.isFalse(result.windows.explicit)
    assert.ok(result.windows.display.from)
    assert.ok(result.windows.display.to)
  })
})
