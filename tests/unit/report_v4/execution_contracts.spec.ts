import { test } from '@japa/runner'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type { PremiumReportDocument } from '#contracts/premium_report'
import {
  attachAbsoluteMarkLines,
  buildAbsoluteMarkLines,
} from '#services/premium_report/charts/echarts_options'
import { asEchartsOption } from '#services/premium_report/charts/echarts_types'
import { dropEmptyMetricDays } from '#services/premium_report/dataset_ops'
import { checkAcwrSeries } from '#services/premium_report/tools_document_shared'
import {
  acwrHarvestNudge,
  applyArtifactOpsToDocument,
  applyDesignOpsToHtml,
  buildSoftRunSummary,
  countSoftMutations,
  evaluateCoverageGate,
  evaluateSoftDiffGate,
  listCoveredAthleteNames,
  pathCostBudgetUsd,
  prepareSoftArtifactPath,
  artifactContractsFromIntent,
  envelopeFromContracts,
  resolvePathCostClass,
  resolveSoftClarify,
  verifyAcwrHarvest,
  type ArtifactIntentFlags,
} from '#services/report_v4/artifact_runtime/index'

const NONE: ArtifactIntentFlags = {
  allAthletes: false,
  dropEmptyDays: false,
  wantsThresholds: false,
  stripVisualMap: false,
  remapEncode: false,
  chartAcwr: false,
  mentionAcwr: false,
  strengthenTitle: false,
  accentBand: false,
  tightenSpacing: false,
  emphasizeCaptions: false,
}

const flags = (partial: Partial<ArtifactIntentFlags>): ArtifactIntentFlags => ({
  ...NONE,
  ...partial,
})

test.group('report_v4 artifact runtime', () => {
  test('envelope modes: free / soft_ops / gated_rebuild', ({ assert }) => {
    assert.equal(
      envelopeFromContracts(artifactContractsFromIntent({
        flags: flags({}),
        prompt: 'Tighten the intro prose',
      })).mode,
      'free'
    )
    assert.equal(
      envelopeFromContracts(artifactContractsFromIntent({
        flags: flags({ wantsThresholds: true, mentionAcwr: true }),
        prompt: 'Add ACWR thresholds 0.6 and 1.3',
      })).mode,
      'soft_ops'
    )
    assert.equal(
      envelopeFromContracts(artifactContractsFromIntent({
        flags: flags({ allAthletes: true, mentionAcwr: true, chartAcwr: true }),
        prompt: 'Show ACWR for all players individually',
        rosterNames: ['Ada', 'Bea'],
      })).mode,
      'gated_rebuild'
    )
  })

  test('resolves all-athletes coverage and ACWR metric', ({ assert }) => {
    const contracts = artifactContractsFromIntent({
      flags: flags({ allAthletes: true, mentionAcwr: true, chartAcwr: true }),
      prompt: 'Show ACWR for all players individually',
      rosterNames: ['Ada', 'Bea', 'Cara'],
    })
    assert.equal(contracts.athleteCoverage, 'all')
    assert.deepEqual(contracts.requiredAthletes, ['Ada', 'Bea', 'Cara'])
    assert.isTrue(contracts.individualSheets)
    assert.include(contracts.requiredMetrics, 'acwr_ewma')
    assert.isFalse(contracts.softAllowed)
  })

  test('soft-allows ACWR threshold mark lines without chart_metric', ({ assert }) => {
    const contracts = artifactContractsFromIntent({
      flags: flags({ wantsThresholds: true, mentionAcwr: true }),
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
      rosterNames: ['Ada'],
    })
    assert.isTrue(contracts.softAllowed)
    assert.include(contracts.requiredMetrics, 'acwr_ewma')
    const mark = contracts.vizOps.find((op) => op.kind === 'mark_lines')
    assert.exists(mark)
    if (mark?.kind === 'mark_lines') {
      assert.deepEqual(mark.values, [0.6, 1.3])
    }
    assert.isFalse(contracts.vizOps.some((op) => op.kind === 'chart_metric'))
  })

  test('resolves drop empty days viz op', ({ assert }) => {
    const contracts = artifactContractsFromIntent({
      flags: flags({ dropEmptyDays: true }),
      prompt: 'Remove empty days from the load curves',
    })
    assert.isTrue(contracts.softAllowed)
    assert.isTrue(contracts.vizOps.some((op) => op.kind === 'drop_empty_days'))
  })

  test('resolves strip_visualMap as soft_ops', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ stripVisualMap: true }),
      prompt: 'Hide the color scale / visualMap on the bars',
    }))
    assert.equal(envelope.mode, 'soft_ops')
    assert.isTrue(envelope.contracts.softAllowed)
    assert.isTrue(envelope.contracts.vizOps.some((op) => op.kind === 'strip_visualMap'))
  })

  test('resolves remap_encode swap axes as soft_ops', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ remapEncode: true, mentionAcwr: true }),
      prompt: 'Swap the axes on the ACWR chart',
    }))
    assert.equal(envelope.mode, 'soft_ops')
    assert.isTrue(envelope.contracts.softAllowed)
    const remap = envelope.contracts.vizOps.find((op) => op.kind === 'remap_encode')
    assert.exists(remap)
    if (remap?.kind === 'remap_encode') assert.equal(remap.mode, 'swap_axes')
  })

  test('resolves design ops as soft_ops without analyst rebuild', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ strengthenTitle: true, tightenSpacing: true }),
      prompt: 'Make the titles stronger and tighten spacing',
    }))
    assert.equal(envelope.mode, 'soft_ops')
    assert.isTrue(envelope.contracts.softAllowed)
    assert.isTrue(envelope.contracts.designOps.some((op) => op.kind === 'strengthen_title'))
    assert.isTrue(envelope.contracts.designOps.some((op) => op.kind === 'tighten_spacing'))
  })

  test('applyDesignOpsToHtml injects classes and css once', ({ assert }) => {
    const html = `<html><head></head><body class="report"><div class="band"><h1>Load</h1></div></body></html>`
    const first = applyDesignOpsToHtml(html, [
      { kind: 'strengthen_title' },
      { kind: 'accent_band' },
    ])
    assert.isTrue(first.changed)
    assert.include(first.applied, 'strengthen_title')
    assert.include(first.applied, 'accent_band')
    assert.include(first.html, 'mauna-title-strong')
    assert.include(first.html, 'mauna-band-accent')
    assert.include(first.html, 'data-mauna-soft-design="1"')
    const second = applyDesignOpsToHtml(first.html, [{ kind: 'strengthen_title' }])
    assert.isFalse(second.changed)
  })

  test('coverage gate refuses incomplete roster', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ allAthletes: true }),
      prompt: 'Individual sheets for all players',
      rosterNames: ['Ada', 'Bea', 'Cara', 'Dee', 'Eve'],
    }))
    const coverage = evaluateCoverageGate(
      {
        blocks: [
          { type: 'heading', title: 'Ada' },
          { type: 'chart', title: 'Bea load' },
        ],
      },
      envelope
    )
    assert.exists(coverage)
    assert.isFalse(coverage!.ok)
    assert.equal(coverage!.delivered, 2)
    assert.equal(coverage!.required, 5)
  })

  test('coverage gate lists only named athletes present in titles', ({ assert }) => {
    const document = {
      blocks: [
        { type: 'heading', title: 'Ada — sheet' },
        { type: 'chart', title: 'Bea ACWR' },
        { type: 'chart', title: 'Team mean' },
      ],
    }
    const covered = listCoveredAthleteNames(document, ['Ada', 'Bea', 'Cara', 'Dee'])
    assert.deepEqual(covered, ['Ada', 'Bea'])
  })

  test('coverage gate also matches series names and dataset joueur column', ({ assert }) => {
    const document = {
      blocks: [
        {
          type: 'chart',
          title: 'Squad ACWR',
          option: {
            series: [{ name: 'Cara' }, { name: 'Dee' }],
            legend: { data: ['Cara', 'Dee'] },
          },
        },
        {
          type: 'chart',
          title: 'Bar snapshot',
          option: {
            dataset: {
              source: [
                ['joueur', 'acwr_ewma'],
                ['Eve', 1.1],
                ['Fay', 0.9],
              ],
            },
            series: [{ type: 'bar' }],
          },
        },
      ],
    }
    const covered = listCoveredAthleteNames(document, ['Ada', 'Cara', 'Dee', 'Eve', 'Fay'])
    assert.deepEqual(covered, ['Cara', 'Dee', 'Eve', 'Fay'])
  })

  test('soft mutation counter treats zero as no applied', ({ assert }) => {
    const zero = countSoftMutations({
      editorialRemoved: 0,
      tocAdded: false,
      emptyStripped: 0,
      syncedProse: 0,
      syncedTables: 0,
      injectedHostShells: 0,
      injectedProse: 0,
      injectedSections: 0,
      injectedTables: 0,
      injectedCharts: 0,
      recoStripped: 0,
      sheetsRebuilt: 0,
      chartOptionsPatched: 0,
    })
    assert.equal(zero.appliedCount, 0)
    assert.deepEqual(zero.applied, [])

    const patched = countSoftMutations({
      editorialRemoved: 0,
      tocAdded: false,
      emptyStripped: 0,
      syncedProse: 0,
      syncedTables: 0,
      injectedHostShells: 0,
      injectedProse: 0,
      injectedSections: 0,
      injectedTables: 0,
      injectedCharts: 0,
      recoStripped: 0,
      sheetsRebuilt: 0,
      chartOptionsPatched: 2,
    })
    assert.equal(patched.appliedCount, 1)
    assert.deepEqual(patched.applied, ['chart_options:2'])
  })

  test('verifyAcwrHarvest is pending when build_load_summary was not called', ({ assert }) => {
    const state = {
      datasets: new Map(),
      toolHistory: [{ name: 'fetch_srpe_daily' }],
    }
    const result = verifyAcwrHarvest(state, ['acwr_ewma'])
    assert.equal(result.status, 'pending')
    assert.isFalse(result.ok)
    assert.deepEqual(result.missing, ['build_load_summary'])
  })

  test('verifyAcwrHarvest is ok when acwr_ewma column has rows', ({ assert }) => {
    const state = {
      datasets: new Map([
        [
          'ds1',
          {
            columns: ['joueur', 'date_of_day', 'acwr_ewma'],
            rows: [{ joueur: 'Ada', acwr_ewma: 1.1 }],
          },
        ],
      ]),
      toolHistory: [{ name: 'build_load_summary' }],
    }
    const result = verifyAcwrHarvest(state, ['acwr_ewma'])
    assert.equal(result.status, 'ok')
    assert.isTrue(result.ok)
    assert.isTrue(result.hasAcwrColumn)
    assert.isFalse(result.emptyDeclared)
  })

  test('verifyAcwrHarvest empty_declared after build_load_summary without acwr column', ({
    assert,
  }) => {
    const state = {
      datasets: new Map([
        [
          'ds1',
          {
            columns: ['joueur', 'date_of_day', 'srpe_daily'],
            rows: [],
          },
        ],
      ]),
      toolHistory: [{ name: 'build_load_summary' }],
    }
    const result = verifyAcwrHarvest(state, ['acwr_ewma'])
    assert.equal(result.status, 'empty_declared')
    assert.isTrue(result.ok)
    assert.isFalse(result.hasAcwrColumn)
    assert.isTrue(result.emptyDeclared)
  })

  test('prepareSoftArtifactPath patches mark lines onto soft ops', ({ assert }) => {
    const document: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-01-01', to: '2026-01-03' },
      blocks: [
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'ACWR EWMA',
          option: {
            series: [{ type: 'line', data: [0.9, 1.1] }],
          },
        },
      ],
    }
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ wantsThresholds: true, mentionAcwr: true }),
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
    }))
    const prep = prepareSoftArtifactPath({
      document,
      envelope,
      softOps: null,
      softEditorialOnly: true,
    })
    assert.isAtLeast(prep.opResult.patched, 1)
    assert.equal(prep.softOps?.chartOptionsPatched, prep.opResult.patched)
    assert.isTrue(prep.softEditorialOnly)
  })

  test('acwrHarvestNudge only fires on pending', ({ assert }) => {
    assert.isString(
      acwrHarvestNudge({
        status: 'pending',
        ok: false,
        missing: ['build_load_summary'],
        triedLoadSummary: false,
        hasAcwrColumn: false,
        emptyDeclared: false,
      })
    )
    assert.isNull(
      acwrHarvestNudge({
        status: 'empty_declared',
        ok: true,
        missing: [],
        triedLoadSummary: true,
        hasAcwrColumn: false,
        emptyDeclared: true,
      })
    )
    assert.isNull(
      acwrHarvestNudge({
        status: 'ok',
        ok: true,
        missing: [],
        triedLoadSummary: true,
        hasAcwrColumn: true,
        emptyDeclared: false,
      })
    )
  })
})

test.group('report_v4 viz ops', () => {
  test('buildAbsoluteMarkLines emits yAxis values', ({ assert }) => {
    const lines = buildAbsoluteMarkLines([0.6, 1.3], 'yAxis')
    assert.lengthOf(lines, 2)
    assert.equal((lines[0] as { yAxis?: number }).yAxis, 0.6)
    assert.equal((lines[1] as { yAxis?: number }).yAxis, 1.3)
  })

  test('attachAbsoluteMarkLines patches first series', ({ assert }) => {
    const option = attachAbsoluteMarkLines(
      asEchartsOption({
        series: [{ type: 'line', data: [1, 2] }],
      }),
      [0.6, 1.3]
    )
    const series = option.series as Array<{ markLine?: { data?: unknown[] } }>
    assert.exists(series[0]?.markLine?.data)
    assert.lengthOf(series[0]!.markLine!.data!, 2)
  })

  test('dropEmptyMetricDays removes null metric calendar rows', ({ assert }) => {
    const result = dropEmptyMetricDays(
      {
        id: 'tmp',
        columns: ['date_of_day', 'srpe_daily'],
        rows: [
          { date_of_day: '2026-01-01', srpe_daily: 120 },
          { date_of_day: '2026-01-02', srpe_daily: null },
          { date_of_day: '2026-01-03', srpe_daily: 90 },
        ],
      },
      ['srpe_daily']
    )
    assert.equal(result.dropped, 1)
    assert.lengthOf(result.dataset.rows, 2)
  })

  test('soft viz ops strip visualMap from chart options', ({ assert }) => {
    const document: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-01-01', to: '2026-01-03' },
      blocks: [
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'Wellness bar',
          option: {
            series: [{ type: 'bar', data: [1, 2, 3] }],
            visualMap: { type: 'piecewise', min: 1, max: 5 },
          },
        },
      ],
    }
    const contracts = artifactContractsFromIntent({
      flags: flags({ stripVisualMap: true }),
      prompt: 'Remove the color scale legend',
    })
    const patched = applyArtifactOpsToDocument(document, contracts)
    assert.equal(patched.patched, 1)
    assert.include(patched.applied, 'strip_visualMap')
    const chartBlock = patched.document.blocks[0]
    assert.equal(chartBlock?.type, PREMIUM_BLOCK_TYPE.CHART)
    if (chartBlock?.type !== PREMIUM_BLOCK_TYPE.CHART) return
    assert.isUndefined((chartBlock.option as { visualMap?: unknown }).visualMap)
  })

  test('soft viz ops remap encode swaps x/y', ({ assert }) => {
    const document: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-01-01', to: '2026-01-03' },
      blocks: [
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'ACWR',
          option: {
            xAxis: { type: 'category' },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', encode: { x: 'joueur', y: 'acwr_ewma' } }],
          },
        },
      ],
    }
    const contracts = artifactContractsFromIntent({
      flags: flags({ remapEncode: true }),
      prompt: 'Swap the axes',
    })
    const patched = applyArtifactOpsToDocument(document, contracts)
    assert.equal(patched.patched, 1)
    assert.include(patched.applied, 'remap_encode')
    const chartBlock = patched.document.blocks[0]
    assert.equal(chartBlock?.type, PREMIUM_BLOCK_TYPE.CHART)
    if (chartBlock?.type !== PREMIUM_BLOCK_TYPE.CHART) return
    const option = chartBlock.option as {
      xAxis: { type?: string }
      yAxis: { type?: string }
      series: Array<{ encode?: { x?: string; y?: string } }>
    }
    assert.equal(option.series[0]?.encode?.x, 'acwr_ewma')
    assert.equal(option.series[0]?.encode?.y, 'joueur')
    assert.equal(option.xAxis.type, 'value')
    assert.equal(option.yAxis.type, 'category')
  })

  test('soft viz ops apply mark lines and drop empty days on chart options', ({ assert }) => {
    const document: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-01-01', to: '2026-01-03' },
      blocks: [
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'ACWR EWMA',
          option: {
            dataset: {
              source: [
                ['date_of_day', 'acwr_ewma'],
                ['2026-01-01', 0.9],
                ['2026-01-02', null],
                ['2026-01-03', 1.1],
              ],
            },
            series: [{ type: 'line' }],
          },
        },
      ],
    }
    const contracts = artifactContractsFromIntent({
      flags: flags({ dropEmptyDays: true, wantsThresholds: true, mentionAcwr: true }),
      prompt: 'Drop empty days and add ACWR thresholds 0.6 and 1.3',
    })
    const patched = applyArtifactOpsToDocument(document, contracts)
    assert.isAtLeast(patched.patched, 1)
    assert.include(patched.applied, 'mark_lines')
    assert.include(patched.applied, 'drop_empty_days')
    const chartBlock = patched.document.blocks[0]
    assert.equal(chartBlock?.type, PREMIUM_BLOCK_TYPE.CHART)
    if (chartBlock?.type !== PREMIUM_BLOCK_TYPE.CHART) return
    const option = chartBlock.option as {
      dataset: { source: unknown[][] }
      series: Array<{ markLine?: { data?: unknown[] } }>
    }
    assert.lengthOf(option.dataset.source, 3)
    assert.exists(option.series[0]?.markLine?.data)
  })

  test('checkAcwrSeries coerces sparse roster lines to bar', ({ assert }) => {
    const rows = []
    for (let i = 0; i < 6; i++) {
      rows.push({
        joueur: `P${i}`,
        date_of_day: '2026-01-01',
        acwr_ewma: 1 + i * 0.1,
      })
      rows.push({
        joueur: `P${i}`,
        date_of_day: '2026-01-02',
        acwr_ewma: 1.05 + i * 0.1,
      })
    }
    const check = checkAcwrSeries(
      {
        id: 'ds',
        columns: ['joueur', 'date_of_day', 'acwr_ewma'],
        rows,
      },
      ['acwr_ewma']
    )
    assert.equal(check.status, 'sparse')
    if (check.status === 'sparse') {
      assert.isTrue(check.coerceToBar)
      assert.equal(check.acwrCol, 'acwr_ewma')
    }
  })
})

test.group('report_v4 soft★ phase1', () => {
  test('vague soft intent triggers clarify gate', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({}),
      prompt: 'Make it clearer',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Make it clearer',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: false,
      softOps: null,
      language: 'en',
    })
    assert.isTrue(clarify.needsClarify)
    assert.isBelow(clarify.confidence, 0.62)
    assert.isAbove(clarify.questions.length, 0)
    assert.include(clarify.markdown, 'vague')
  })

  test('vague soft intent asks in French by default', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({}),
      prompt: 'Rends ça plus clair',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Rends ça plus clair',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: false,
      softOps: null,
      language: 'fr',
    })
    assert.isTrue(clarify.needsClarify)
    assert.include(clarify.markdown, 'précision')
  })

  test('unresolved soft targets ask with candidate titles', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ mentionAcwr: true }),
      prompt: 'Improve the ACWR chart a bit',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Improve the ACWR chart a bit',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: true,
      candidateTitles: ['ACWR EWMA', 'Load mean', 'Wellness radar'],
      softOps: null,
      language: 'en',
    })
    assert.isTrue(clarify.needsClarify)
    assert.equal(clarify.reason, 'soft_targets_unresolved')
    assert.include(clarify.markdown, 'ACWR EWMA')
  })

  test('target hint without candidates asks in writing', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({}),
      prompt: 'Improve the chart',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Improve the chart',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: true,
      candidateTitles: [],
      softOps: null,
      language: 'fr',
    })
    assert.isTrue(clarify.needsClarify)
    assert.ok(clarify.questions.some((q) => q.id === 'target'))
    assert.include(clarify.markdown, 'graphique')
  })

  test('concrete soft ops skip clarify', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ wantsThresholds: true, mentionAcwr: true }),
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: false,
      softOps: null,
    })
    assert.isFalse(clarify.needsClarify)
  })

  test('editorial soft ops (TOC) skip vague clarify', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({}),
      prompt: 'Add a table of contents',
    }))
    const clarify = resolveSoftClarify({
      prompt: 'Add a table of contents',
      envelope,
      preserveCanvas: true,
      softTargetsUnresolved: false,
      softOps: {
        ops: [{ type: 'ensure_toc' }],
        editorialOnly: true,
        needsAnalyst: false,
        needsFetch: false,
        removeQueries: [],
        ensureToc: true,
        hasDataOps: false,
        restoreSheets: false,
        addSectionProse: false,
        additiveSoft: false,
        layoutRepair: false,
        wantsTeamMean: false,
        enrichExistingCharts: false,
      },
    })
    assert.isFalse(clarify.needsClarify)
  })

  test('diff gate detects mutation outside allowlist', ({ assert }) => {
    const prior: PremiumReportDocument = {
      title: 'Staff',
      dateRange: { from: '2026-01-01', to: '2026-01-03' },
      blocks: [
        {
          id: 'c1',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'ACWR',
          option: { series: [{ type: 'line', data: [1] }] },
        },
        {
          id: 'c2',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'GPS',
          option: { series: [{ type: 'bar', data: [2] }] },
        },
      ],
    }
    const next: PremiumReportDocument = {
      ...prior,
      blocks: [
        prior.blocks[0]!,
        {
          id: 'c2',
          type: PREMIUM_BLOCK_TYPE.CHART,
          title: 'GPS mutated',
          option: { series: [{ type: 'bar', data: [9] }] },
        },
      ],
    }
    const diff = evaluateSoftDiffGate({
      prior,
      next,
      allowBlockIds: new Set(['c1']),
    })
    assert.exists(diff)
    assert.isFalse(diff!.ok)
    assert.include(diff!.mutatedOutsideAllowlist, 'c2')
  })

  test('path cost class budgets for editorial and soft_ops', ({ assert }) => {
    const softOps = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ wantsThresholds: true, mentionAcwr: true }),
      prompt: 'Add ACWR thresholds 0.6 and 1.3',
    }))
    assert.equal(
      resolvePathCostClass({
        envelope: softOps,
        preserveCanvas: true,
        softEditorialOnly: false,
        skipAnalyst: true,
        needsFetch: false,
      }),
      'soft_ops'
    )
    assert.equal(pathCostBudgetUsd('editorial'), 0.05)
    assert.equal(pathCostBudgetUsd('soft_ops'), 0.08)
  })

  test('soft run summary lists applied and blocked', ({ assert }) => {
    const envelope = envelopeFromContracts(artifactContractsFromIntent({
      flags: flags({ dropEmptyDays: true }),
      prompt: 'Drop empty days',
    }))
    const summary = buildSoftRunSummary({
      envelope,
      softApplied: ['chart_options:1'],
      softBlocked: [],
      pathCostClass: 'soft_ops',
    })
    assert.include(summary.markdown, 'soft ops')
    assert.include(summary.markdown, 'chart_options:1')
    assert.isAtLeast(summary.followUps.length, 1)
  })

  test('golden soft matrix: 12 prompts resolve mode or clarify', ({ assert }) => {
    const cases: Array<{
      prompt: string
      expect: 'free' | 'soft_ops' | 'gated_rebuild' | 'clarify'
      flags: ArtifactIntentFlags
    }> = [
      { prompt: 'Add a table of contents', expect: 'free', flags: flags({}) },
      { prompt: 'Remove the executive summary section', expect: 'free', flags: flags({}) },
      {
        prompt: 'Add ACWR thresholds 0.6 and 1.3',
        expect: 'soft_ops',
        flags: flags({ wantsThresholds: true, mentionAcwr: true }),
      },
      {
        prompt: 'Drop empty days from the load curves',
        expect: 'soft_ops',
        flags: flags({ dropEmptyDays: true }),
      },
      {
        prompt: 'Hide the color scale on the bars',
        expect: 'soft_ops',
        flags: flags({ stripVisualMap: true }),
      },
      {
        prompt: 'Swap the axes on the ACWR chart',
        expect: 'soft_ops',
        flags: flags({ remapEncode: true, mentionAcwr: true }),
      },
      {
        prompt: 'Make the titles stronger',
        expect: 'soft_ops',
        flags: flags({ strengthenTitle: true }),
      },
      {
        prompt: 'Tighten spacing on the layout',
        expect: 'soft_ops',
        flags: flags({ tightenSpacing: true }),
      },
      { prompt: 'Make it clearer', expect: 'clarify', flags: flags({}) },
      { prompt: 'Improve it', expect: 'clarify', flags: flags({}) },
      {
        prompt: 'Show ACWR for all players individually',
        expect: 'gated_rebuild',
        flags: flags({ allAthletes: true, mentionAcwr: true, chartAcwr: true }),
      },
      { prompt: 'Polish the report', expect: 'clarify', flags: flags({}) },
    ]
    for (const row of cases) {
      const envelope = envelopeFromContracts(artifactContractsFromIntent({
        flags: row.flags,
        prompt: row.prompt,
        rosterNames: ['Ada', 'Bea', 'Cara'],
      }))
      if (row.expect === 'clarify') {
        const clarify = resolveSoftClarify({
          prompt: row.prompt,
          envelope,
          preserveCanvas: true,
          softTargetsUnresolved: false,
        })
        assert.isTrue(clarify.needsClarify, row.prompt)
        continue
      }
      assert.equal(envelope.mode, row.expect, row.prompt)
    }
  })
})
