import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { injectReportV4RunBanner } from '#services/report_v4/run_banner_html'
import {
  detectReportV4Path,
  formatReportV4RunFlagsLine,
  resolveReportV4RunFlags,
} from '#services/report_v4/run_flags'

test.group('Report-v4 run flags (0.1)', () => {
  test('detects free vs classic path from artifact marker', ({ assert }) => {
    assert.equal(detectReportV4Path('<html data-artifact="free-designer">'), 'free')
    assert.equal(detectReportV4Path('<html data-artifact="free">'), 'classic')
    assert.equal(detectReportV4Path('<html>'), 'classic')
  })

  test('formatReportV4RunFlagsLine is stable', ({ assert }) => {
    assert.equal(
      formatReportV4RunFlagsLine({
        freeDesigner: true,
        freeDesignerRefs: true,
        lang: 'fr',
        path: 'free',
      }),
      'freeDesigner=on · refs=on · lang=fr · path=free'
    )
  })

  test('resolveReportV4RunFlags uses language and html path', ({ assert }) => {
    const flags = resolveReportV4RunFlags({
      language: 'fr',
      html: '<html data-artifact="free-designer"></html>',
    })
    assert.equal(flags.lang, 'fr')
    assert.equal(flags.path, 'free')
    assert.isBoolean(flags.freeDesigner)
    assert.isBoolean(flags.freeDesignerRefs)
  })
})

test.group('Report-v4 HTML run banner (0.1)', () => {
  test('injects banner after body and stamps html data attrs', ({ assert }) => {
    const html = '<html lang="fr"><body><main>report</main></body></html>'
    const out = injectReportV4RunBanner(html, {
      runId: 'run-test-1',
      flags: {
        freeDesigner: true,
        freeDesignerRefs: false,
        lang: 'fr',
        path: 'free',
      },
    })
    assert.include(out, 'class="report-v4-run-banner"')
    assert.include(out, 'data-run-id="run-test-1"')
    assert.include(out, 'data-free-designer="1"')
    assert.include(out, 'data-free-designer-refs="0"')
    assert.include(out, 'data-lang="fr"')
    assert.include(out, 'data-path="free"')
    assert.include(out, 'freeDesigner=on')
    assert.match(out, /<html[^>]*data-path="free"/)
    assert.isTrue(out.indexOf('report-v4-run-banner') < out.indexOf('<main>'))
  })

  test('is idempotent', ({ assert }) => {
    const html = '<html><body><p>x</p></body></html>'
    const once = injectReportV4RunBanner(html, {
      runId: 'r1',
      flags: { freeDesigner: true, freeDesignerRefs: true, lang: 'en', path: 'free' },
    })
    const twice = injectReportV4RunBanner(once, {
      runId: 'r2',
      flags: { freeDesigner: false, freeDesignerRefs: false, lang: 'fr', path: 'classic' },
    })
    assert.equal(once, twice)
  })
})

test.group('Report-v4 snapshots removed', () => {
  test('service no longer writes report_snapshots', ({ assert }) => {
    const src = readFileSync(join(process.cwd(), 'app/services/report_v4/report_v4_service.ts'), 'utf8')
    assert.notInclude(src, 'writeReportSnapshot')
    assert.notInclude(src, 'report_v4.snapshot_written')
  })
})
