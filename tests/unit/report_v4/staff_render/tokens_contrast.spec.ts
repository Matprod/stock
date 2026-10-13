import { test } from '@japa/runner'
import {
  contrastRatio,
  STAFF_MIN_TEXT_CONTRAST,
} from '#services/report_v4/staff_render/contrast'
import {
  formatStaffDateRange,
  formatStaffMonthYear,
  formatStaffNumber,
} from '#services/report_v4/staff_render/format'
import {
  STAFF_COLORS,
  STAFF_FONTS,
  STAFF_PAGE,
  staffPerformanceFill,
  staffRiskFill,
  staffTextOnSurfacePairs,
} from '#services/report_v4/staff_render/tokens'

test.group('staff_render tokens', () => {
  test('page geometry and fonts match the maquette contract', ({ assert }) => {
    assert.equal(STAFF_PAGE.widthPx, 794)
    assert.equal(STAFF_PAGE.heightPx, 1123)
    assert.equal(STAFF_PAGE.marginXPx, 48)
    assert.equal(STAFF_FONTS.display, 'Barlow Condensed')
    assert.equal(STAFF_FONTS.body, 'Barlow')
    assert.equal(STAFF_COLORS.series.risk, '#C2410C')
    assert.equal(STAFF_COLORS.series.performance, '#1F5FB5')
  })

  test('every text/background token pair meets 4.5:1 contrast', ({ assert }) => {
    const pairs = staffTextOnSurfacePairs()
    assert.isAbove(pairs.length, 10)
    for (const pair of pairs) {
      const ratio = contrastRatio(pair.text, pair.background)
      assert.isAtLeast(
        ratio,
        STAFF_MIN_TEXT_CONTRAST,
        `${pair.id}: ${pair.text} on ${pair.background} = ${ratio.toFixed(2)}`
      )
    }
  })

  test('matrix fills resolve by score band', ({ assert }) => {
    assert.equal(staffRiskFill(0), '#EEF1F4')
    assert.equal(staffRiskFill(24), '#FCD9B6')
    assert.equal(staffRiskFill(49), '#F2994A')
    assert.equal(staffRiskFill(74), '#C2410C')
    assert.equal(staffRiskFill(75), '#7C2D12')
    assert.equal(staffPerformanceFill(34), '#E8EEF8')
    assert.equal(staffPerformanceFill(35), '#BFD3F0')
    assert.equal(staffPerformanceFill(54), '#8DB0E3')
    assert.equal(staffPerformanceFill(64), '#3F77C4')
    assert.equal(staffPerformanceFill(65), '#1F4E96')
  })
})

test.group('staff_render format', () => {
  test('formats french numbers with decimal comma and thin space thousands', ({ assert }) => {
    assert.equal(formatStaffNumber(49.7), '49,7')
    assert.equal(formatStaffNumber(3187, { maximumFractionDigits: 0 }), `3${'\u202f'}187`)
  })

  test('formats month names in full french', ({ assert }) => {
    assert.equal(formatStaffMonthYear('2026-03'), 'mars 2026')
    assert.equal(formatStaffDateRange('2026-03-01', '2026-03-07'), '1–7 mars 2026')
  })
})
