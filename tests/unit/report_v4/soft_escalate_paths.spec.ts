import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { evaluateSoftDiffGate } from '#services/report_v4/artifact_runtime/index'
import { buildSoftRunSummary } from '#services/report_v4/artifact_runtime/soft_summary'
import type { ArtifactEnvelope } from '#services/report_v4/artifact_runtime/types'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { stampDataBlockIdsInHtml } from '#services/report_v4/artifact_html'
import { runSoftRebind } from '#services/report_v4/soft_rebind'
import {
  formatSoftEditPathMessage,
  refusalFromDiffGate,
  refusalFromTemplateRecovered,
  refusalsFromSoftBlocked,
} from '#services/report_v4/soft_refusal'

const pack = () => resolveReportDesignPack('mauna')

const baseDoc = (): PremiumReportDocument => ({
  title: 'Bilan staff',
  dateRange: { from: '2026-01-01', to: '2026-01-14' },
  blocks: [
    { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness', level: 1 },
    {
      id: 'p1',
      type: PREMIUM_BLOCK_TYPE.TEXT,
      text: 'Deux joueurs à surveiller.',
    },
    {
      id: 'c1',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Courbatures',
      option: { series: [{ type: 'line', data: [1, 2, 3] }] },
    },
  ],
})

const htmlWithIds = (doc: PremiumReportDocument): string => {
  const raw = `<!DOCTYPE html><html><body><main>
<h2 data-block-id="h1">Wellness</h2>
<p data-block-id="p1">Deux joueurs à surveiller.</p>
<article class="chart-card" data-block-id="c1"><h3>Courbatures</h3><div id="chart_c1" class="chart-box" data-block-id="c1"></div></article>
</main></body></html>`
  return stampDataBlockIdsInHtml(raw, doc)
}

const softArgs = (over: Partial<Parameters<typeof runSoftRebind>[0]>) => ({
  priorHtml: htmlWithIds(baseDoc()),
  document: baseDoc(),
  priorDocument: baseDoc(),
  priorBlockIds: new Set(['h1', 'p1', 'c1']),
  priorChartCount: 1,
  softOps: null,
  softProseOnly: true,
  softEditorialOnly: false,
  softEditorialAppliedEarly: false,
  recommendationStrip: false,
  canvasAskKind: PREMIUM_CANVAS_ASK.MICRO_EDIT,
  heatScales: [],
  designPack: pack(),
  language: 'fr' as const,
  clubName: 'Test FC',
  progress: () => undefined,
  ...over,
})

const softEnvelope = (): ArtifactEnvelope => ({
  mode: 'soft_ops',
  contracts: {
    athleteCoverage: 'named',
    requiredAthletes: [],
    vizOps: [],
    designOps: [],
    requiredMetrics: [],
    softAllowed: true,
    individualSheets: false,
  },
  chartDefaults: { dropEmptyDays: false, markLineValues: [] },
  coverage: { requiredNames: [], individualSheets: false },
  harvest: { requiredMetrics: [], requireLoadDomain: false },
})

test.group('soft escalate paths (step 4)', () => {
  test('soft_truth_escalate returns typed refusals and rebuild ask', ({ assert }) => {
    const prior = baseDoc()
    const next = baseDoc()
    next.blocks = next.blocks.map((block) =>
      block.id === 'p1' && block.type === 'text'
        ? { ...block, text: 'Texte impossible à resynchroniser dans le HTML' }
        : block
    )
    const priorHtml = htmlWithIds(prior).replace('data-block-id="p1"', 'data-block-id="other"')
    const result = runSoftRebind(
      softArgs({
        priorHtml,
        document: next,
        priorDocument: prior,
      })
    )
    assert.isTrue(result.restoredPrior)
    assert.include(result.softBlocked, 'prose_miss')
    assert.isTrue(result.refusals.some((row) => row.code === 'soft_truth_escalate'))
    assert.isTrue(result.refusals.some((row) => row.code === 'prose_miss'))
    assert.match(result.coachMessage ?? '', /refasse le rapport/i)

    const fromBlocked = refusalsFromSoftBlocked({
      softBlocked: result.softBlocked,
      unsyncedBlockIds: result.unsyncedBlockIds,
      language: 'fr',
    })
    assert.isTrue(fromBlocked.some((row) => row.code === 'soft_truth_escalate'))

    const summary = buildSoftRunSummary({
      envelope: softEnvelope(),
      softApplied: result.softApplied,
      softBlocked: result.softBlocked,
      language: 'fr',
      editPath: 'local_refused',
      refusals: result.refusals,
    })
    assert.match(summary.markdown, /édition locale refusée/i)
    assert.isTrue(summary.followUps.some((row) => /refasse/i.test(row.question)))
  })

  test('soft_diff_gate maps to SoftRefusal and local_refused path', ({ assert }) => {
    const prior = baseDoc()
    const next: PremiumReportDocument = {
      ...prior,
      title: 'Titre hors périmètre',
      blocks: [prior.blocks[2]!, prior.blocks[0]!, prior.blocks[1]!],
    }
    const diff = evaluateSoftDiffGate({
      prior,
      next,
      allowBlockIds: new Set(['p1']),
    })
    assert.exists(diff)
    assert.isFalse(diff!.ok)

    const refusals = refusalFromDiffGate({
      mutatedOutsideAllowlist: diff!.mutatedOutsideAllowlist,
      orderChanged: diff!.orderChanged,
      documentFieldsChanged: diff!.documentFieldsChanged,
      language: 'fr',
    })
    assert.isTrue(refusals.some((row) => row.code === 'soft_diff_gate'))
    assert.isTrue(diff!.orderChanged)
    assert.isTrue(refusals.some((row) => row.code === 'diff_order'))
    assert.isTrue(refusals.some((row) => row.code === 'diff_doc'))

    const message = formatSoftEditPathMessage({
      path: 'local_refused',
      language: 'fr',
      detail:
        "Je n'ai pas pu appliquer la modification localement (hors périmètre). Le rapport précédent a été conservé. Voulez-vous que je refasse le rapport ?",
    })
    assert.match(message, /hors périmètre/i)
    assert.match(message, /refasse/i)

    const summary = buildSoftRunSummary({
      envelope: softEnvelope(),
      softApplied: [],
      softBlocked: ['diff_gate', 'diff_order'],
      language: 'fr',
      editPath: 'local_refused',
      refusals,
    })
    assert.match(summary.markdown, /soft_diff_gate/)
    assert.isTrue(summary.followUps.some((row) => /refasse/i.test(row.question)))
  })

  test('designer_template_recovered surfaces path and coach message', ({ assert }) => {
    const refusal = refusalFromTemplateRecovered({
      reason: 'set_report_html_grounding_reject',
      language: 'fr',
    })
    assert.equal(refusal.code, 'designer_template_recovered')
    assert.match(refusal.reason, /modèle de secours/i)

    const message = formatSoftEditPathMessage({
      path: 'template_recovered',
      language: 'fr',
      detail: refusal.reason,
    })
    assert.match(message, /modèle de secours/i)

    const summary = buildSoftRunSummary({
      envelope: softEnvelope(),
      softApplied: [],
      softBlocked: [],
      language: 'fr',
      editPath: 'template_recovered',
      refusals: [refusal],
    })
    assert.match(summary.markdown, /modèle de secours/i)
    assert.match(summary.markdown, /designer_template_recovered/)
    assert.equal(summary.editPath, 'template_recovered')
  })
})
