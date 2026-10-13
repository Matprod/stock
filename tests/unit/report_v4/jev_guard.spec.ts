import { test } from '@japa/runner'
import { Exception } from '@adonisjs/core/exceptions'
import {
  isJevUnavailableError,
  jevUnavailableMessage,
  runIntentClassifier,
  throwJevUnavailable,
} from '#services/report_v4/jev_guard'

test.group('report_v4 jev_guard', () => {
  test('messages are localized', ({ assert }) => {
    assert.include(jevUnavailableMessage('en').toLowerCase(), 'temporarily unavailable')
    assert.include(jevUnavailableMessage('fr').toLowerCase(), 'momentanément indisponible')
  })

  test('throwJevUnavailable raises 503', ({ assert }) => {
    try {
      throwJevUnavailable({ context: 'test' })
      assert.fail('expected throw')
    } catch (error) {
      assert.instanceOf(error, Exception)
      assert.equal((error as Exception).status, 503)
      assert.isTrue(isJevUnavailableError(error))
      assert.include(String((error as Error).message), 'temporarily unavailable')
    }
  })

  test('runIntentClassifier falls back to Haiku when Jev throws', async ({ assert }) => {
    const result = await runIntentClassifier({
      context: 'test_haiku_fallback',
      jev: async () => {
        throw new Error('jev down')
      },
      haiku: async () => ({ ok: true }),
    })
    assert.equal(result.provider, 'haiku')
    assert.deepEqual(result.value, { ok: true })
  })

  test('runIntentClassifier raises 503 when Jev and Haiku both fail', async ({ assert }) => {
    try {
      await runIntentClassifier({
        context: 'test_both_fail',
        jev: async () => {
          throw new Error('jev down')
        },
        haiku: async () => {
          throw new Error('haiku down')
        },
      })
      assert.fail('expected throw')
    } catch (error) {
      assert.isTrue(isJevUnavailableError(error))
      assert.equal((error as Exception).status, 503)
    }
  })
})
