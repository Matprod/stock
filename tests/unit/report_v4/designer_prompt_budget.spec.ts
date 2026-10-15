import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import {
  DESIGNER_INPUT_HARD_TOKENS,
  DESIGNER_INPUT_SOFT_TOKENS,
  estimateTokens,
  fitDesignerPromptBudget,
  lightenReferenceHtml,
} from '#services/report_v4/free_designer/prompt_budget'
import { selectFreeDesignerReferences } from '#services/report_v4/free_designer/select_references'
import { designKitPath } from '#services/report_v4/free_designer/kit_paths'
import { FREE_DESIGNER_SYSTEM_PROMPT } from '#services/report_v4/free_designer/build_prompt'

test.group('Designer prompt budget', () => {
  test('reports kit part sizes (brief, theme, each reference)', ({ assert }) => {
    const brief = readFileSync(designKitPath('brief.md'), 'utf8')
    const theme = readFileSync(designKitPath('theme.css'), 'utf8')
    const refsDir = designKitPath('references', 'fr')
    const names = [
      '02-summary.html',
      '04-load-acwr.html',
      '06-wellness.html',
      '09-player-sheet.html',
    ]
    const rows = names.map((name) => {
      const raw = readFileSync(join(refsDir, name), 'utf8')
      const light = lightenReferenceHtml(raw)
      return {
        id: name,
        rawTokens: estimateTokens(raw),
        lightTokens: estimateTokens(light),
      }
    })
    assert.isAbove(estimateTokens(brief), 500)
    assert.isAbove(estimateTokens(theme), 500)
    for (const row of rows) {
      assert.isBelow(row.lightTokens, row.rawTokens)
    }
    assert.isBelow(estimateTokens(brief) + estimateTokens(theme), DESIGNER_INPUT_SOFT_TOKENS)
    assert.isBelow(
      rows.reduce((sum, row) => sum + row.lightTokens, 0),
      DESIGNER_INPUT_SOFT_TOKENS
    )
  })

  test('selects at most 2 references and budget fit stays under hard limit', ({ assert }) => {
    const refs = selectFreeDesignerReferences({
      domains: ['gps', 'load', 'wellness', 'sleep', 'match'],
      individualSheets: true,
      hasLongTable: true,
      multiSection: true,
      language: 'fr',
    })
    assert.isAtMost(refs.length, 2)

    const oversizedRefs = [
      ...refs,
      {
        id: 'extra-a',
        filename: 'extra-a.html',
        briefHint: 'extra',
        bodyHtml: `<div>${'x'.repeat(80_000)}</div>`,
      },
      {
        id: 'extra-b',
        filename: 'extra-b.html',
        briefHint: 'extra',
        bodyHtml: `<div>${'y'.repeat(80_000)}</div>`,
      },
    ]

    const hugeRows = Array.from({ length: 2_000 }, (_, i) => ({
      joueur: `Player Name With Long Label ${i}`,
      mood_rating: 3,
      hours_in_bed: 7.25,
      kpi_distanceTotal: 1000 + i,
      note: `row-payload-${i}-${'z'.repeat(40)}`,
    }))
    const fitted = fitDesignerPromptBudget({
      systemPrompt: FREE_DESIGNER_SYSTEM_PROMPT,
      brief: readFileSync(designKitPath('brief.md'), 'utf8'),
      theme: readFileSync(designKitPath('theme.css'), 'utf8'),
      references: oversizedRefs,
      coachPrompt: 'Bilan staff wellness radar sommeil humeur bandes min max',
      askContractJson: JSON.stringify({ requirements: ['wellness', 'sleep'] }),
      facts: Array.from({ length: 2_000 }, (_, i) => ({
        id: `fact.${i}.mean`,
        value: i,
        unit: 'AU',
      })),
      datasets: [
        {
          id: 'ds_huge',
          columns: ['joueur', 'mood_rating', 'hours_in_bed', 'kpi_distanceTotal', 'note'],
          rows: hugeRows,
        },
      ],
    })
    assert.isAtMost(fitted.references.length, 2)
    assert.isTrue(fitted.withinHardLimit)
    assert.isAtMost(fitted.parts.total, DESIGNER_INPUT_HARD_TOKENS)
    assert.isAbove(fitted.trimmed.length, 0)
  })
})
