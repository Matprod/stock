import { test } from '@japa/runner'
import { ensureMetricUnitInSql } from '#utils/agent/agent_sql'
import { sqlSafeDecimalCast } from '#services/premium_report/premium_report_sql_templates'

test.group('ensureMetricUnitInSql + CTE safety', () => {
  test('does not inject unit into WITH scoped_days when AS unit already present', ({ assert }) => {
    const sql = `
WITH scoped_days AS (
  SELECT d.id
  FROM days d
  JOIN athletes a ON d.athlete_id = a.id
),
day_period_minutes AS (
  SELECT sa.day_id, SUM(CAST(pmv.value AS DECIMAL)) AS minutes
  FROM sport_activities sa
  JOIN periods p ON p.sport_activity_id = sa.id
  JOIN period_metric_values pmv ON pmv.period_id = p.id
  JOIN period_metrics pm ON pm.id = pmv.metric_id
  WHERE pm.name IN ('total_duration')
  GROUP BY sa.day_id
)
SELECT d.date_of_day, NULL::text AS unit
FROM days d
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN day_period_minutes per ON per.day_id = d.id
`.trim()
    const out = ensureMetricUnitInSql(sql)
    assert.equal(out, sql)
    assert.notInclude(out.split('scoped_days')[1]!.slice(0, 120), 'pmcu.unit')
  })

  test('does not inject before first CTE FROM when unit missing — injects on main SELECT', ({
    assert,
  }) => {
    const sql = `
WITH scoped_days AS (
  SELECT d.id
  FROM days d
),
day_vals AS (
  SELECT pmv.period_id, pmv.value
  FROM period_metric_values pmv
  JOIN period_metrics pm ON pm.id = pmv.metric_id
)
SELECT d.date_of_day, CAST(v.value AS DECIMAL) AS valeur
FROM days d
JOIN day_vals v ON true
`.trim()
    const out = ensureMetricUnitInSql(sql)
    assert.include(out, 'scoped_days AS (\n  SELECT d.id\n  FROM days d')
    assert.match(out, /SELECT d\.date_of_day, CAST\(v\.value AS DECIMAL\) AS valeur,\s*MAX\(COALESCE/i)
  })
})

test.group('sqlSafeDecimalCast', () => {
  test('rejects non-numeric text like match result L/W', ({ assert }) => {
    const expr = sqlSafeDecimalCast('samv.value')
    assert.include(expr, "~ '^-{0,1}[0-9]+(\\.[0-9]+){0,1}$'")
    assert.notInclude(expr, '?')
    assert.include(expr, 'CAST(TRIM(samv.value) AS DECIMAL)')
    assert.notMatch(expr, /CAST\(NULLIF\(TRIM\(samv\.value\),''\) AS DECIMAL\)/)
  })
})
