import { test } from '@japa/runner'
import {
  premiumLog,
  setPremiumConsoleLogging,
  withPremiumConsoleQuiet,
} from '#services/premium_report/premium_report_log'

test.group('premium console quiet during report-v4', () => {
  test('withPremiumConsoleQuiet suppresses premiumLog then restores', async ({ assert }) => {
    const writes: string[] = []
    const original = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk))
      return true
    }) as typeof process.stdout.write

    try {
      setPremiumConsoleLogging(true)
      premiumLog('visible-before')
      await withPremiumConsoleQuiet(async () => {
        premiumLog('hidden-inside')
        return null
      })
      premiumLog('visible-after')
    } finally {
      process.stdout.write = original
      setPremiumConsoleLogging(true)
    }

    const joined = writes.join('')
    assert.include(joined, 'visible-before')
    assert.include(joined, 'visible-after')
    assert.notInclude(joined, 'hidden-inside')
  })
})
