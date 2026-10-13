import { test } from '@japa/runner'
import type { PremiumDataset } from '#contracts/premium_report'
import { auditArtifactHtml } from '#services/report_v4/grounding_html'
import { detectSoftDeltaGroundingScope } from '#services/report_v4/grounding_scope'
import type { GroundingAuditInput } from '#services/report_v4/grounding_types'
import {
  computeFactValue,
  formatFactValue,
  injectDataFactsInHtml,
  auditLiteralNumbersOutsideFacts,
} from '#services/report_v4/report_facts'

const ckDataset = (): PremiumDataset => ({
  id: 'biomarkers_raw',
  columns: ['joueur', 'biomarker', 'value'],
  rows: [
    { joueur: 'A', biomarker: 'ck', value: '1200' },
    { joueur: 'B', biomarker: 'ck', value: '2000' },
    { joueur: 'C', biomarker: 'ck', value: '800' },
    { joueur: 'D', biomarker: 'ck', value: '1500' },
    { joueur: 'E', biomarker: 'ck', value: '2000' },
    { joueur: 'F', biomarker: 'hr_recovery_90s', value: '40' },
  ],
})

const baseInput = (): GroundingAuditInput => ({
  roster: [{ name: 'Ada Lovelace' }],
  datasets: [ckDataset()],
  allowNutritionScope: false,
  harvestHasRows: true,
})

test.group('report_facts Phase 2A', () => {
  test('compute_report_fact count_where is deterministic', ({ assert }) => {
    const result = computeFactValue({
      dataset: ckDataset(),
      op: 'count_where',
      where: { column: 'value', op: 'gte', value: 1000 },
      filter: { column: 'biomarker', op: 'eq', value: 'ck' },
    })
    assert.isTrue(result.ok)
    if (result.ok) assert.equal(result.value, 4)
  })

  test('injectDataFactsInHtml fills spans with locale formatting', ({ assert }) => {
    const html = `<p>CK over 1000: <span data-fact="ck.over_1000_count"></span> assays.</p>`
    const facts = new Map([
      [
        'ck.over_1000_count',
        {
          id: 'ck.over_1000_count',
          value: 18,
          unit: 'assays',
          sourceDatasetId: 'biomarkers_raw',
          op: 'count_where' as const,
        },
      ],
    ])
    const fr = injectDataFactsInHtml({ html, facts, language: 'fr' })
    assert.equal(fr.filled, 1)
    assert.include(fr.html, '18')
    assert.include(fr.html, 'assays')
    assert.include(fr.html, 'data-fact="ck.over_1000_count"')
  })

  test('auditLiteralNumbersOutsideFacts rejects prose literals but keeps data-fact spans', ({
    assert,
  }) => {
    const bad = `<p>Ada Lovelace had the worst wellness score 12 this week.</p>`
    const badHits = auditLiteralNumbersOutsideFacts(bad)
    assert.isAtLeast(badHits.length, 1)
    assert.equal(badHits[0]?.code, 'literal_number')

    const good = `<p>CK peaks: <span data-fact="ck.over_1000_count"></span> on 2026-10-12.</p>`
    const goodHits = auditLiteralNumbersOutsideFacts(good)
    assert.lengthOf(goodHits, 0)
  })

  test('auditLiteralNumbersOutsideFacts allows display date ranges and years', ({ assert }) => {
    const html = `<p>Period 2025-12-01 → 2025-12-31 (December 2025).</p>`
    const hits = auditLiteralNumbersOutsideFacts(html)
    assert.lengthOf(hits, 0)
  })

  test('formatFactValue uses fr-FR grouping', ({ assert }) => {
    assert.equal(formatFactValue(1234, 'fr'), '1 234')
  })

  test('auditArtifactHtml rejects literal KPI when enforceLiteralFactGate is on', ({ assert }) => {
    const prev = process.env.REPORT_V4_DATA_FACTS
    process.env.REPORT_V4_DATA_FACTS = '1'
    try {
      const html = `<!DOCTYPE html><html><body>
<p>Ada Lovelace CK over threshold: 18 assays.</p>
</body></html>`
      const result = auditArtifactHtml(html, {
        ...baseInput(),
        enforceLiteralFactGate: true,
      })
      assert.isFalse(result.ok)
      assert.isTrue(result.violations.some((v) => v.code === 'literal_number'))
    } finally {
      if (prev === undefined) delete process.env.REPORT_V4_DATA_FACTS
      else process.env.REPORT_V4_DATA_FACTS = prev
    }
  })

  test('soft delta scope only audits injected blocks for literal numbers', ({ assert }) => {
    const prev = process.env.REPORT_V4_DATA_FACTS
    process.env.REPORT_V4_DATA_FACTS = '1'
    try {
      const html = `<!DOCTYPE html><html><body>
<article class="section-block"><p>Prior prose cites 99 invented.</p></article>
<article class="chart-card" data-mauna-soft-injected="1">
  <h3>Load</h3>
  <p>Ada Lovelace steady with <span data-fact="load.row_count"></span> rows.</p>
</article>
</body></html>`
      const scope = detectSoftDeltaGroundingScope(html)
      const result = auditArtifactHtml(
        html,
        { ...baseInput(), enforceLiteralFactGate: true },
        scope
      )
      assert.isTrue(result.ok)
    } finally {
      if (prev === undefined) delete process.env.REPORT_V4_DATA_FACTS
      else process.env.REPORT_V4_DATA_FACTS = prev
    }
  })
})
