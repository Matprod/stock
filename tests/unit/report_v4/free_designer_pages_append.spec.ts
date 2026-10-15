import { test } from '@japa/runner'
import {
  assembleFreeDesignerHtml,
  countFreeDesignerPages,
  extractFreeDesignerPagesBody,
  mergeFreeDesignerPagesHtml,
} from '#services/report_v4/free_designer/assemble_document'
import { createFreeDesignerTools } from '#services/report_v4/free_designer/tools'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'

const page = (n: number, body = `Page ${n}`) =>
  `<div class="page"><h1 class="headline">${body}</h1><p class="lead">${'Staff content. '.repeat(12)}section ${n}</p><div class="kpi"><div class="label">KPI</div><div class="value">12</div></div></div>`

test.group('free designer set_report_pages append', () => {
  test('merge append concatenates page bodies', ({ assert }) => {
    const first = assembleFreeDesignerHtml({
      pagesHtml: page(1),
      language: 'fr',
    })
    const merged = mergeFreeDesignerPagesHtml({
      existingArtifact: first,
      incomingPagesHtml: page(2),
      mode: 'append',
    })
    assert.equal(countFreeDesignerPages(merged), 2)
    assert.include(merged, 'Page 1')
    assert.include(merged, 'Page 2')
  })

  test('tool replace then append builds multi-page artifact', async ({ assert }) => {
    const run = {
      htmlArtifact: null,
      facts: new Map(),
      agentState: {
        datasets: new Map(),
        limits: {},
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
    } as unknown as ReportV4RunState

    const tools = createFreeDesignerTools({ run, language: 'fr' })
    const setPages = tools.find((tool) => tool.schema.name === 'set_report_pages')
    assert.exists(setPages)

    const first = await setPages!.execute({
      html: `${page(1)}${page(2)}`,
      mode: 'replace',
      done: false,
    })
    assert.match(first, /"ok":true/)
    assert.isTrue(Boolean(run.htmlArtifact))
    assert.equal(countFreeDesignerPages(extractFreeDesignerPagesBody(run.htmlArtifact)), 2)

    const second = await setPages!.execute({
      html: page(3),
      mode: 'append',
      done: true,
    })
    assert.match(second, /"ok":true/)
    assert.match(second, /"pageCount":3/)
    assert.equal(countFreeDesignerPages(extractFreeDesignerPagesBody(run.htmlArtifact)), 3)
  })
})
