import { test } from '@japa/runner'
import { detectReportLanguage } from '#services/report_v4/detect_report_language'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test.group('Bourg deliverable E — FREE_DESIGNER flag persistence', () => {
  test('service no longer writes health-data snapshots', ({ assert }) => {
    const src = readFileSync(
      join(process.cwd(), 'app/services/report_v4/report_v4_service.ts'),
      'utf8'
    )
    assert.notInclude(src, 'writeReportSnapshot')
    assert.notInclude(src, 'report_v4.snapshot_written')
    assert.match(src, /resolveReportV4RunFlags/)
    assert.match(src, /report_v4\.run_timing/)
  })

  test('start banner logs freeDesigner flags', ({ assert }) => {
    const logSrc = readFileSync(
      join(process.cwd(), 'app/services/premium_report/premium_report_log.ts'),
      'utf8'
    )
    const catalogSrc = readFileSync(
      join(process.cwd(), 'app/services/report_v4/orchestrator/steps/init_pipeline_catalog.ts'),
      'utf8'
    )
    assert.match(logSrc, /freeDesigner=\$\{args\.freeDesigner \? 'on' : 'off'\}/)
    assert.match(catalogSrc, /resolveReportV4RunFlags/)
    assert.match(catalogSrc, /freeDesigner:/)
  })
})

test.group('Bourg deliverable F — language follows coach ask', () => {
  test('French coach ask resolves to fr via detectReportLanguage', ({ assert }) => {
    assert.equal(
      detectReportLanguage(
        'Bilan staff Bourg-en-Bresse de la semaine dernière: GPS, match, wellness'
      ),
      'fr'
    )
    assert.equal(
      detectReportLanguage('Weekly staff report for last week: GPS, match, wellness'),
      'en'
    )
  })

  test('Hamburg French ask is fr; English ask is en', ({ assert }) => {
    assert.equal(
      detectReportLanguage(
        'Fais un rapport staff Hambourg du 1 au 7 mars: GPS, charge, wellness, scores'
      ),
      'fr'
    )
    assert.equal(
      detectReportLanguage(
        'Build a Hamburg staff report for 1–7 March: GPS, load, wellness, scores'
      ),
      'en'
    )
  })

  test('controller uses ask language only (no HTTP header)', ({ assert }) => {
    const src = readFileSync(join(process.cwd(), 'app/services/report_v4/controller.ts'), 'utf8')
    assert.match(src, /detectReportLanguage\(payload\.prompt\)/)
    assert.notInclude(src, "header('x-language')")
    assert.notInclude(src, 'parseAppLanguage')
  })
})
