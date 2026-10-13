import { test } from '@japa/runner'
import {
  legacyReportGoneBody,
  legacyReportGoneMessage,
  REPORT_V4_LEGACY_GONE_CODE,
} from '#services/report_v4/legacy_gone'

test.group('legacy report gone (phase 2)', () => {
  test('returns fr and en retirement copy with replacement path', ({ assert }) => {
    assert.equal(REPORT_V4_LEGACY_GONE_CODE, 'report_legacy_gone')
    assert.match(legacyReportGoneMessage('fr'), /Report v4/)
    assert.match(legacyReportGoneMessage('en'), /Report v4/)
    const body = legacyReportGoneBody('fr')
    assert.equal(body.code, REPORT_V4_LEGACY_GONE_CODE)
    assert.equal(body.replacement, '/reports/report-v4')
  })
})
