import { test } from '@japa/runner'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { clampFetchesToAsk } from '#services/report_v4/prompt_windows_llm'
import { sqlBiomarkersDaily } from '#services/premium_report/premium_report_sql_templates'

test.group('biomarkers fetch window clamp', () => {
  test('snaps non-overlapping Dec biomarkers archive to March display', ({ assert }) => {
    const clamped = clampFetchesToAsk(
      'Fait moi un rapport sur mon equipe du 1 au 7 mars.',
      { from: '2026-03-01', to: '2026-03-07' },
      [
        {
          domain: PREMIUM_DOMAIN.BIOMARKERS,
          from: '2025-12-01',
          to: '2025-12-31',
        },
        {
          domain: PREMIUM_DOMAIN.SCORES,
          from: '2026-03-01',
          to: '2026-03-07',
        },
      ]
    )
    const bio = clamped.find((row) => row.domain === PREMIUM_DOMAIN.BIOMARKERS)
    assert.deepEqual(bio, {
      domain: PREMIUM_DOMAIN.BIOMARKERS,
      from: '2026-03-01',
      to: '2026-03-07',
    })
  })

  test('keeps Dec biomarkers when coach named December', ({ assert }) => {
    const clamped = clampFetchesToAsk(
      'Compare wellness in March with biomarkers from December 2025',
      { from: '2026-03-01', to: '2026-03-07' },
      [
        {
          domain: PREMIUM_DOMAIN.BIOMARKERS,
          from: '2025-12-01',
          to: '2025-12-31',
        },
      ]
    )
    assert.deepEqual(clamped[0], {
      domain: PREMIUM_DOMAIN.BIOMARKERS,
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  test('biomarkers SQL includes global types without club pivot rows', ({ assert }) => {
    const sql = sqlBiomarkersDaily({
      clubId: 'club-1',
      from: '2026-03-01',
      to: '2026-03-07',
    })
    assert.notInclude(sql, 'JOIN biomarker_type_clubs')
    assert.include(sql, 'NOT EXISTS')
    assert.include(sql, 'biomarker_type_clubs')
  })
})
