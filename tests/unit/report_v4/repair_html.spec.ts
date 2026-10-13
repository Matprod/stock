import { test } from '@japa/runner'
import {
  findDuplicateChartHosts,
  findMissingChartHosts,
  repairHtml,
  type GroundingIssue,
  type RepairContext,
} from '#services/report_v4/repair_html'
import { scanNumbers, scanToLiteralViolations } from '#services/report_v4/grounding_tokenizer'
import { formatFactValue } from '#services/report_v4/report_facts'

const doc = (body: string): string =>
  `<!DOCTYPE html><html><body>${body}</body></html>`

const baseCtx = (over: Partial<RepairContext> = {}): RepairContext => ({
  language: 'fr',
  facts: [],
  requiredChartIds: [],
  reaudit: async () => [],
  ...over,
})

test.group('repair_html · phase B', () => {
  test('wrap_fact: literal_number equal to registered fact', async ({ assert }) => {
    const facts = [{ id: 'inj.count', value: 18 }]
    const html = doc(`<p data-block="s1">Le groupe compte 18 blessures.</p>`)
    const report = await repairHtml(
      html,
      [{ code: 'literal_number', evidence: '18' }],
      baseCtx({
        facts,
        reaudit: async (candidate) => {
          if (candidate.includes('data-fact="inj.count"')) return []
          return [{ code: 'literal_number', evidence: '18' }]
        },
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.isTrue(report.applied.some((op) => op.code === 'wrap_fact'))
    assert.include(report.html, 'data-fact="inj.count"')
    assert.notInclude(report.html.replace(/<span[^>]*data-fact="inj.count"[^>]*>[\s\S]*?<\/span>/, ''), '18')
  })

  test('wrap_fact refused when finalize render differs (0.18% ≠ 18 %)', async ({ assert }) => {
    const rendered = formatFactValue(0.18, 'fr', '%').replace(/\u00a0/g, ' ').trim()
    assert.equal(rendered, '0,18 %')
    const html = doc(`<p>Part haute: 18 %.</p><p>a</p><p>b</p><p>c</p>`)
    const report = await repairHtml(
      html,
      [{ code: 'literal_number', evidence: '18 %' }],
      baseCtx({
        facts: [{ id: 'share.high', value: 0.18, unit: '%' }],
        reaudit: async (candidate) =>
          candidate.includes('18 %') ? [{ code: 'literal_number', evidence: '18 %' }] : [],
      })
    )
    assert.notInclude(report.html, 'data-fact="share.high"')
  })

  test('wrap_fact when percent fact formats as 18 %', async ({ assert }) => {
    const html = doc(`<p>Part haute: 18 %.</p>`)
    const report = await repairHtml(
      html,
      [{ code: 'literal_number', evidence: '18 %' }],
      baseCtx({
        facts: [{ id: 'share.high', value: 18, unit: '%' }],
        reaudit: async (candidate) =>
          candidate.includes('data-fact="share.high"')
            ? []
            : [{ code: 'literal_number', evidence: '18 %' }],
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.include(report.html, 'data-fact="share.high"')
  })

  test('numeric_ungrounded without matching fact → drop_sentence', async ({ assert }) => {
    const html = doc(`
      <p data-block="s1">Score inventé 99 sur la période.</p>
      <p>OK suite.</p><p>pad1</p><p>pad2</p><p>pad3</p>
    `)
    const report = await repairHtml(
      html,
      [{ code: 'numeric_ungrounded', evidence: '99' }],
      baseCtx({
        facts: [{ id: 'inj.count', value: 3 }],
        reaudit: async (candidate) =>
          candidate.includes('99') ? [{ code: 'numeric_ungrounded', evidence: '99' }] : [],
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.isTrue(report.applied.some((op) => op.code === 'drop_sentence'))
    assert.notInclude(report.html, '99')
    assert.include(report.html, 'OK suite')
  })

  test('numeric_ungrounded model patch accepted then clean', async ({ assert }) => {
    const html = doc(`<p data-block="s1">Il y a 99 cas.</p>`)
    const report = await repairHtml(
      html,
      [{ code: 'numeric_ungrounded', evidence: '99' }],
      baseCtx({
        facts: [{ id: 'inj.count', value: 3 }],
        requestModelPatch: async () => [
          {
            blockPath: 's1',
            find: 'Il y a 99 cas.',
            replace: 'Il y a <span data-fact="inj.count"></span> cas.',
          },
        ],
        reaudit: async (candidate) =>
          candidate.includes('99') ? [{ code: 'numeric_ungrounded', evidence: '99' }] : [],
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.isTrue(report.modelCalled)
    assert.isTrue(report.applied.some((op) => op.code === 'model_patch'))
    assert.include(report.html, 'data-fact="inj.count"')
  })

  test('model patch rejected when it injects a new hard number', async ({ assert }) => {
    const html = doc(`
      <p data-block="s1">Il y a 99 cas.</p>
      <p>pad1</p><p>pad2</p><p>pad3</p><p>pad4</p>
    `)
    const report = await repairHtml(
      html,
      [{ code: 'numeric_ungrounded', evidence: '99' }],
      baseCtx({
        facts: [{ id: 'inj.count', value: 3 }],
        requestModelPatch: async () => [
          {
            blockPath: 's1',
            find: 'Il y a 99 cas.',
            replace: 'Il y a 42 cas.',
          },
        ],
        reaudit: async (candidate) => {
          const scan = scanNumbers(candidate, { facts: [{ id: 'inj.count', value: 3 }] })
          return scanToLiteralViolations(scan).map((v) => ({
            code: v.code,
            evidence: v.evidence,
          }))
        },
      })
    )
    assert.notInclude(report.html, '42')
    assert.isTrue(report.applied.some((op) => op.code === 'drop_sentence'))
    assert.equal(report.verdict, 'repaired')
  })

  test('insert_host for missing chart-box', async ({ assert }) => {
    const html = doc(`<section class="page"><p>Load</p></section>`)
    const report = await repairHtml(
      html,
      [{ code: 'chart_host_missing', evidence: 'chart_load_acwr' }],
      baseCtx({
        requiredChartIds: ['chart_load_acwr'],
        reaudit: async (candidate) =>
          findMissingChartHosts(candidate, ['chart_load_acwr']).map((id) => ({
            code: 'chart_host_missing',
            evidence: id,
          })),
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.isTrue(report.applied.some((op) => op.code === 'insert_host'))
    assert.include(report.html, 'id="chart_load_acwr"')
    assert.include(report.html, 'chart-box')
  })

  test('dedupe_host keeps first chart-box', async ({ assert }) => {
    const html = doc(`
      <div class="chart-box" id="chart_a"></div>
      <div class="chart-box" id="chart_a"></div>
    `)
    assert.deepEqual(findDuplicateChartHosts(html), ['chart_a'])
    const report = await repairHtml(
      html,
      [{ code: 'chart_host_duplicate', evidence: 'chart_a' }],
      baseCtx({
        requiredChartIds: ['chart_a'],
        reaudit: async (candidate) =>
          findDuplicateChartHosts(candidate).map((id) => ({
            code: 'chart_host_duplicate',
            evidence: id,
          })),
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.lengthOf(findDuplicateChartHosts(report.html), 0)
    assert.include(report.html, 'id="chart_a"')
  })

  test('athlete_unknown → drop_sentence', async ({ assert }) => {
    const html = doc(`
      <p>Ghost Player est à risque.</p>
      <p>Suite propre.</p><p>pad1</p><p>pad2</p><p>pad3</p>
    `)
    const report = await repairHtml(
      html,
      [{ code: 'athlete_unknown', evidence: 'Ghost Player' }],
      baseCtx({
        reaudit: async (candidate) =>
          candidate.includes('Ghost Player')
            ? [{ code: 'athlete_unknown', evidence: 'Ghost Player' }]
            : [],
      })
    )
    assert.equal(report.verdict, 'repaired')
    assert.notInclude(report.html, 'Ghost Player')
    assert.include(report.html, 'Suite propre')
  })

  test('strip script / photo elements', async ({ assert }) => {
    const html = doc(`
      <p>OK</p>
      <script>alert(1)</script>
      <img class="athlete-photo" src="data:image/png;base64,xxx" />
    `)
    const report = await repairHtml(html, [], baseCtx())
    assert.oneOf(report.verdict, ['ok', 'repaired'])
    assert.notInclude(report.html, '<script')
    assert.notInclude(report.html, 'athlete-photo')
  })

  test('blocking: html_unparseable → fallback', async ({ assert }) => {
    const report = await repairHtml(
      '',
      [{ code: 'literal_number', evidence: '1' }],
      baseCtx({
        reaudit: async () => [{ code: 'literal_number', evidence: '1' }],
      })
    )
    assert.equal(report.verdict, 'fallback')
  })

  test('blocking: no required hosts after failed insert path', async ({ assert }) => {
    const html = doc(`<p>empty</p>`)
    const report = await repairHtml(html, [], baseCtx({
      requiredChartIds: ['chart_a', 'chart_b'],
      reaudit: async () => [],
      maxRounds: 0,
    }))
    assert.equal(report.verdict, 'fallback')
    assert.isTrue(report.remaining.some((i) => i.code === 'chart_hosts_absent'))
  })

  test('blocking: prose_drop_ratio when too many sentences removed', async ({ assert }) => {
    const html = doc(`
      <p>a 1</p><p>b 2</p><p>c 3</p><p>d 4</p>
    `)
    const issues: GroundingIssue[] = [
      { code: 'numeric_ungrounded', evidence: '1' },
      { code: 'numeric_ungrounded', evidence: '2' },
      { code: 'numeric_ungrounded', evidence: '3' },
      { code: 'numeric_ungrounded', evidence: '4' },
    ]
    const report = await repairHtml(
      html,
      issues,
      baseCtx({
        proseDropRatioMax: 0.3,
        reaudit: async (candidate) => {
          const left: GroundingIssue[] = []
          for (const n of ['1', '2', '3', '4']) {
            if (candidate.includes(n)) left.push({ code: 'numeric_ungrounded', evidence: n })
          }
          return left
        },
      })
    )
    assert.equal(report.verdict, 'fallback')
    assert.isTrue(report.remaining.some((i) => i.code === 'prose_drop_ratio'))
  })

  test('blocking: kpi_without_fact', async ({ assert }) => {
    const html = doc(`<div class="kpi">18</div><p>ok</p>`)
    const report = await repairHtml(
      html,
      [{ code: 'literal_number', evidence: '18' }],
      baseCtx({
        facts: [],
        reaudit: async () => [],
      })
    )
    assert.equal(report.verdict, 'fallback')
    assert.isTrue(report.remaining.some((i) => i.code === 'kpi_without_fact'))
  })

  test('ok when no issues and hosts present', async ({ assert }) => {
    const html = doc(`<p>Clean prose.</p><div class="chart-box" id="chart_a"></div>`)
    const report = await repairHtml(html, [], baseCtx({ requiredChartIds: ['chart_a'] }))
    assert.equal(report.verdict, 'ok')
    assert.lengthOf(report.remaining, 0)
  })
})
