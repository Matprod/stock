import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE, PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import type { PremiumDataset } from '#contracts/premium_report'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { auditArtifactHtml } from '#services/report_v4/grounding_report'
import { auditLiteralNumbersOutsideFacts } from '#services/report_v4/grounding_facts'
import { executeAddSheetComments } from '#services/report_v4/athlete_sheets'
import { markImputedCells, isImputedCell } from '#services/report_v4/imputed_cells'

const stubState = (): PremiumReportState => ({
  document: emptyPremiumDocument({ from: '2026-10-07', to: '2026-10-14' }, []),
  datasets: new Map(),
  defaultAfter: 'end',
  dateRange: { from: '2026-10-07', to: '2026-10-14' },
  clubId: 'club-bourg',
  athleteIds: [],
  language: 'fr',
  sqlFailures: new Map(),
  blockSql: false,
  toolHistory: [],
  harvestTried: [],
  jevValidations: 0,
  jevBlocked: 0,
  requestPrompt: 'fiches',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
  limits: {
    requireLiveDatasetId: true,
    skipTextCaptionJev: true,
    deterministicCaptionGate: true,
    groundedAthleteNames: ['Ada'],
  },
})

test.group('Bourg deliverable G — literal_number blocking on synthesis / sheets', () => {
  test('free ranges and roster counts without facts are literal_number violations (blocking)', ({
    assert,
  }) => {
    const html = `<p>Weekly report 7–14 October 2026 covering 12 players across 8 GPS sessions.</p>
<p>Période du 7 au 14 octobre pour 12 joueurs.</p>`
    const result = auditArtifactHtml(
      html,
      {
        roster: [{ id: 'a1', name: 'Ada' }],
        datasets: [],
        allowNutritionScope: false,
        harvestHasRows: false,
        enforceLiteralFactGate: true,
        facts: [{ id: 'f1', value: 99, unit: null }],
        groundingLanguage: 'en',
        properNames: ['Bourg-En-Bresse'],
      },
      { mode: 'full' }
    )
    assert.isFalse(result.ok, 'literal_number must block synthesis/sheet prose again')
    const literal = result.violations.filter((v) => v.code === 'literal_number')
    assert.isAtLeast(
      literal.length,
      1,
      `expected blocking literal_number, got ${JSON.stringify(result)}`
    )
  })

  test('repair removes the sentence that carries the ungrounded literal', ({ assert }) => {
    const html = `<p>Load stayed stable this week.</p><p>Peak movement load hit 278 UA.</p>`
    const result = auditArtifactHtml(
      html,
      {
        roster: [{ id: 'a1', name: 'Ada' }],
        datasets: [],
        allowNutritionScope: false,
        harvestHasRows: false,
        enforceLiteralFactGate: true,
        facts: [{ id: 'f1', value: 99, unit: null }],
        groundingLanguage: 'en',
        properNames: [],
      },
      { mode: 'full' }
    )
    assert.isFalse(result.ok, `expected literal block, got ${JSON.stringify(result)}`)
    const repaired =
      typeof result.repairedHtml === 'string' ? result.repairedHtml : null
    assert.isString(
      repaired,
      'audit/repair must expose repairedHtml that drops the offending sentence'
    )
    assert.notInclude(repaired ?? '', '278')
    assert.include(repaired ?? '', 'Load stayed stable')
  })
})

test.group('Bourg deliverable H — literal_number ignores counts and dates', () => {
  test('session counts and dates are not literal_number hits', ({ assert }) => {
    const html = `<p>Staff logged 45 GPS sessions this week (8 octobre).</p>
<p>3 séances GPS pour 12 joueurs.</p>
<svg><text>0</text><text>100</text><text>200</text></svg>`
    const hits = auditLiteralNumbersOutsideFacts(html)
    assert.equal(hits.length, 0)
  })

  test('ungrounded load figure remains a literal_number hit', ({ assert }) => {
    const html = `<p>Peak load hit 278 UA on the focus day.</p>`
    const hits = auditLiteralNumbersOutsideFacts(html)
    assert.isAtLeast(hits.length, 1)
    assert.equal(hits[0]?.evidence, '278')
  })
})

test.group('Bourg deliverable G — sheet comment facts at source', () => {
  test('add_sheet_comments exposes min/max/mean/delta facts and rejects free ranges', async ({
    assert,
  }) => {
    const state = stubState()
    const load: PremiumDataset = {
      id: 'load_ds',
      columns: ['joueur', 'trimp'],
      rows: [
        { joueur: 'Ada', trimp: 40 },
        { joueur: 'Ada', trimp: 60 },
        { joueur: 'Bea', trimp: 50 },
      ],
    }
    storeDataset(state, load)
    const storedLoad = [...state.datasets.values()][0]!
    state.sheetRetainedMeasures = [{ datasetId: storedLoad.id, metric: 'trimp' }]
    state.document.blocks.push({
      id: 'h-ada',
      type: PREMIUM_BLOCK_TYPE.HEADING,
      text: 'Ada',
      level: 2,
    })

    const rangeReject = await executeAddSheetComments({
      state,
      input: {
        comments: [{ athlete: 'Ada', text: 'Ada load sat in a 10–90 band this week.' }],
      },
    })
    const rangeParsed = JSON.parse(rangeReject) as {
      rejected?: Array<{ athlete: string; error: string }>
      applied?: unknown[]
      factsByAthlete?: Record<string, Array<{ op: string; value: number }>>
    }
    assert.isAtLeast(rangeParsed.rejected?.length ?? 0, 1)
    assert.match(JSON.stringify(rangeParsed.rejected), /range|fact|forbidden/i)
    assert.equal(rangeParsed.applied?.length ?? 0, 0)
    const facts = rangeParsed.factsByAthlete?.Ada ?? []
    const ops = new Set(facts.map((row) => row.op))
    assert.isTrue(ops.has('min'))
    assert.isTrue(ops.has('max'))
    assert.isTrue(ops.has('mean'))
    assert.isTrue(ops.has('delta'))

    const mean = facts.find((row) => row.op === 'mean')?.value
    assert.isNumber(mean)
    const okApply = await executeAddSheetComments({
      state,
      input: {
        comments: [{ athlete: 'Ada', text: `Ada mean trimp ${mean} vs team.` }],
      },
    })
    const okParsed = JSON.parse(okApply) as { ok?: boolean; applied?: unknown[] }
    assert.isTrue(okParsed.ok)
    assert.equal(okParsed.applied?.length ?? 0, 1)
  })
})

test.group('Bourg deliverable I — imputed values never commented in text', () => {
  test('add_sheet_comments rejects prose that cites an imputed sentinel', async ({ assert }) => {
    const state = stubState()
    const scores: PremiumDataset = {
      id: 'scores',
      columns: ['joueur', 'performance_score'],
      rows: [
        { joueur: 'Ada', performance_score: 50 },
        { joueur: 'Ada', performance_score: 50 },
        { joueur: 'Bea', performance_score: 80 },
      ],
    }
    storeDataset(state, scores)
    const ds = [...state.datasets.values()][0]!
    markImputedCells({ datasets: [ds] })
    assert.isTrue(isImputedCell(ds, 0, 'performance_score'))

    state.document.blocks.push({
      id: 'h-ada',
      type: PREMIUM_BLOCK_TYPE.HEADING,
      text: 'Ada',
      level: 2,
    })

    const direct = await executeAddSheetComments({
      state,
      input: {
        comments: [
          {
            athlete: 'Ada',
            text: 'Ada averaged performance_score 50 this week — ready to load up.',
          },
        ],
      },
    })
    const parsed = JSON.parse(direct) as {
      ok?: boolean
      rejected?: Array<{ athlete: string; error: string }>
      applied?: unknown[]
      error?: string
    }
    assert.isAtLeast(
      parsed.rejected?.length ?? 0,
      1,
      `expected imputed reject, got ${direct}`
    )
    assert.match(JSON.stringify(parsed.rejected ?? parsed), /imput|sentinel|écart|forbidden/i)
    assert.equal(parsed.applied?.length ?? 0, 0)
  })
})
