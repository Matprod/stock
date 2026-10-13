import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import { evaluateSoftDiffGate } from '#services/report_v4/artifact_runtime/index'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import { runSoftRebind } from '#services/report_v4/soft_rebind'
import {
  stampDataBlockIdsInHtml,
  syncProseIntoArtifactHtml as syncProse,
} from '#services/report_v4/artifact_html'

const pack = () => resolveReportDesignPack('mauna')

const baseDoc = (): PremiumReportDocument => ({
  title: 'Bilan staff',
  dateRange: { from: '2026-01-01', to: '2026-01-14' },
  blocks: [
    { id: 'h1', type: PREMIUM_BLOCK_TYPE.HEADING, text: 'Wellness', level: 1 },
    {
      id: 'p1',
      type: PREMIUM_BLOCK_TYPE.TEXT,
      text: 'Deux joueurs à surveiller avec <span data-fact="wellness.flagged">2</span> alertes.',
    },
    {
      id: 'c1',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Courbatures',
      option: { series: [{ type: 'line', data: [1, 2, 3] }] },
    },
    {
      id: 'c2',
      type: PREMIUM_BLOCK_TYPE.CHART,
      title: 'Sommeil',
      option: { series: [{ type: 'line', data: [4, 5, 6] }] },
    },
  ],
})

const htmlWithIds = (doc: PremiumReportDocument): string => {
  const raw = `<!DOCTYPE html><html><body><main>
<h2 data-block-id="h1">Wellness</h2>
<p data-block-id="p1">Deux joueurs à surveiller avec <span data-fact="wellness.flagged">2</span> alertes.</p>
<article class="chart-card" data-block-id="c1"><h3>Courbatures</h3><div id="chart_c1" class="chart-box" data-block-id="c1"></div></article>
<article class="chart-card" data-block-id="c2"><h3>Sommeil</h3><div id="chart_c2" class="chart-box" data-block-id="c2"></div></article>
</main></body></html>`
  return stampDataBlockIdsInHtml(raw, doc)
}

const softArgs = (over: Partial<Parameters<typeof runSoftRebind>[0]>) => ({
  priorHtml: htmlWithIds(baseDoc()),
  document: baseDoc(),
  priorDocument: baseDoc(),
  priorBlockIds: new Set(['h1', 'p1', 'c1', 'c2']),
  priorChartCount: 2,
  softOps: {
    ops: [{ type: 'ensure_toc' as const }],
    editorialOnly: true,
    needsAnalyst: false,
    needsFetch: false,
    removeQueries: [] as string[],
    ensureToc: true,
    hasDataOps: false,
    restoreSheets: false,
    addSectionProse: false,
    additiveSoft: false,
    layoutRepair: false,
    wantsTeamMean: false,
    enrichExistingCharts: false,
  },
  softProseOnly: false,
  softEditorialOnly: true,
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

test.group('soft_rebind step 2', () => {
  test('partial text sync lists unsynced blocks and keeps prior html', ({ assert }) => {
    const prior = baseDoc()
    const next = baseDoc()
    next.blocks = next.blocks.map((block) =>
      block.id === 'p1' && block.type === 'text'
        ? { ...block, text: 'Nouveau texte sans correspondance HTML' }
        : block.id === 'h1' && block.type === 'heading'
          ? { ...block, text: 'Titre modifié' }
          : block
    )
    const brokenHtml = `<!DOCTYPE html><html><body><main>
<h2 data-block-id="h1">Wellness</h2>
<p data-block-id="other">Ancien paragraphe déjà pris</p>
<article class="chart-card" data-block-id="c1"><div id="chart_c1" class="chart-box"></div></article>
</main></body></html>`
    const sync = syncProse(brokenHtml, next, prior)
    assert.include(sync.unsynced, 'p1')
    assert.isAbove(sync.synced, 0)

    const result = runSoftRebind(
      softArgs({
        priorHtml: brokenHtml,
        document: next,
        priorDocument: prior,
        softProseOnly: true,
        softEditorialOnly: false,
        softOps: null,
      })
    )
    assert.include(result.softBlocked.join(','), 'prose_miss')
    assert.isTrue(result.restoredPrior)
    assert.isFalse(result.needsFreshArtifact)
    assert.equal(result.htmlArtifact, brokenHtml)
    assert.isString(result.coachMessage)
    assert.match(result.coachMessage ?? '', /pas pu appliquer/i)
    assert.isTrue(result.refusals.some((row) => row.code === 'soft_truth_escalate'))
  })

  test('zero_mutations keeps prior and does not escalate', ({ assert }) => {
    const doc = baseDoc()
    const result = runSoftRebind(
      softArgs({
        document: doc,
        priorDocument: doc,
        softOps: {
          ops: [],
          editorialOnly: true,
          needsAnalyst: false,
          needsFetch: false,
          removeQueries: [],
          ensureToc: false,
          hasDataOps: false,
          restoreSheets: false,
          addSectionProse: false,
          additiveSoft: false,
          layoutRepair: false,
          wantsTeamMean: false,
          enrichExistingCharts: false,
        },
        softEditorialOnly: true,
      })
    )
    assert.include(result.softBlocked, 'zero_mutations')
    assert.isFalse(result.needsFreshArtifact)
    assert.isFalse(result.softRebindRepair)
    assert.isString(result.htmlArtifact)
    assert.match(result.coachMessage ?? '', /Rien à changer/i)
    assert.isTrue(result.refusals.some((row) => row.code === 'zero_mutations'))
    assert.isFalse(result.refusals.some((row) => row.code === 'soft_truth_escalate'))
  })

  test('diff gate detects order change outside allowlist', ({ assert }) => {
    const prior = baseDoc()
    const next: PremiumReportDocument = {
      ...prior,
      blocks: [prior.blocks[2]!, prior.blocks[0]!, prior.blocks[1]!, prior.blocks[3]!],
    }
    const diff = evaluateSoftDiffGate({
      prior,
      next,
      allowBlockIds: new Set(['p1']),
    })
    assert.exists(diff)
    assert.isTrue(diff!.orderChanged)
    assert.isFalse(diff!.ok)
  })

  test('restores prior document and html when sync fails', ({ assert }) => {
    const prior = baseDoc()
    const next = baseDoc()
    next.blocks = next.blocks.map((block) =>
      block.id === 'p1' && block.type === 'text'
        ? { ...block, text: 'Texte impossible à resynchroniser' }
        : block
    )
    const priorHtml = htmlWithIds(prior).replace('data-block-id="p1"', 'data-block-id="other"')
    const result = runSoftRebind(
      softArgs({
        priorHtml,
        document: next,
        priorDocument: prior,
        softProseOnly: true,
        softEditorialOnly: false,
        softOps: null,
      })
    )
    assert.isTrue(result.restoredPrior)
    assert.isFalse(result.needsFreshArtifact)
    assert.equal(result.htmlArtifact, priorHtml)
    assert.deepEqual(
      result.document.blocks.map((b) => b.id),
      prior.blocks.map((b) => b.id)
    )
  })

  test('missing chart is reinserted at original block position', ({ assert }) => {
    const prior = baseDoc()
    const next: PremiumReportDocument = {
      ...prior,
      blocks: prior.blocks.filter((block) => block.id !== 'c1'),
    }
    const result = runSoftRebind(
      softArgs({
        document: next,
        priorDocument: prior,
        priorChartCount: 2,
        softEditorialOnly: false,
        softOps: {
          ops: [],
          editorialOnly: false,
          needsAnalyst: false,
          needsFetch: false,
          removeQueries: [],
          ensureToc: false,
          hasDataOps: true,
          restoreSheets: false,
          addSectionProse: false,
          additiveSoft: false,
          layoutRepair: false,
          wantsTeamMean: false,
          enrichExistingCharts: false,
        },
      })
    )
    const ids = result.document.blocks.map((b) => b.id)
    assert.include(ids, 'c1')
    assert.isBelow(ids.indexOf('c1'), ids.indexOf('c2'))
    assert.isAbove(ids.indexOf('c1'), ids.indexOf('p1'))
  })
})
