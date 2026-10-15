import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import { finalizeArtifactHtml } from '#services/report_v4/artifact_html'
import { resolveReportDesignPack } from '#services/report_v4/design/report_design_pack'
import {
  buildHarvestPlan,
  recordHarvestTried,
  verifyHarvestPlan,
} from '#services/report_v4/harvest_plan'
import { resolveColumnLabel } from '#services/report_v4/metrics/column_labels'
import {
  DEFAULT_REPORT_TIMEZONE,
  previousCompleteCalendarWeek,
  todayInTimeZone,
} from '#services/report_v4/lookback_range'
import { resolvePromptWindows } from '#services/report_v4/prompt_scope'

const BOURG_FLAGGED_COLUMNS = [
  'energy_consumption_carbs',
  'energy_consumption_fats',
  'epoc_final',
  'epoc_peak',
  'hf_average',
  'lf_average',
  'lf_hf_ratio',
  'wellbeing_rating',
  'zone1_time',
  'zone2_time',
  'zone3_time',
  'zone4_time',
  'zone5_time',
] as const

const WEEKLY_BOURG_HTML = join(
  process.cwd(),
  'tmp/reports_drafts/weekly-report-7-14-october-2026-2026-10-07_2026-10-14.html'
)

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
  requestPrompt: 'gps',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
})

test.group('Bourg deliverable J — column label table + snake_case finalize gate', () => {
  test('13 Bourg-flagged columns resolve from the catalog (not generic Title Case)', ({
    assert,
  }) => {
    assert.equal(BOURG_FLAGGED_COLUMNS.length, 13)
    const missing: string[] = []
    for (const column of BOURG_FLAGGED_COLUMNS) {
      const resolved = resolveColumnLabel(column, 'fr')
      if (resolved.source !== 'table') missing.push(column)
      assert.notMatch(resolved.label, /_/, `${column} label still snake-ish: ${resolved.label}`)
    }
    assert.deepEqual(missing, [], `catalog incomplete for: ${missing.join(', ')}`)
  })

  test('finalize blocks snake_case chart titles from shipping', ({ assert }) => {
    assert.isTrue(existsSync(WEEKLY_BOURG_HTML))
    const weekly = readFileSync(WEEKLY_BOURG_HTML, 'utf8')
    assert.match(weekly, /epoc_final|zone1_time|energy_consumption_carbs/)

    const pack = resolveReportDesignPack('mauna')
    const pad = 'x'.repeat(420)
    const html = `<!DOCTYPE html><html lang="fr" data-artifact="free"><body>
<h3>Kadin Shedrick — epoc_final</h3>
<div class="chart-box" id="chart_1" style="height:280px"></div>
<!-- ${pad} -->
</body></html>`
    const finalized = finalizeArtifactHtml({
      html,
      charts: [
        {
          id: 'chart_1',
          title: 'epoc_final',
          option: {
            xAxis: { type: 'category', data: ['a'] },
            series: [{ type: 'line', data: [1] }],
          },
        },
      ],
      pack,
      language: 'fr',
      injectMissingHosts: false,
      linkDisplayedNumbers: false,
    })
    assert.isTrue(finalized.ok, finalized.ok ? '' : finalized.error)
    if (!finalized.ok) return
    assert.isTrue(
      finalized.warnings.some((w) => /snake_case|raw_column|human_title/i.test(w)),
      'finalize must warn/block snake_case chart titles'
    )
    assert.notInclude(finalized.html, 'epoc_final')
  })
})

test.group('Bourg deliverable K — harvest_empty_after_try GPS false negative', () => {
  test('GPS dataset with kpi_/trimp/movement_load rows is rows not empty_after_try', ({
    assert,
  }) => {
    const state = stubState()
    const plan = buildHarvestPlan([PREMIUM_DOMAIN.GPS], {
      fetches: [{ domain: PREMIUM_DOMAIN.GPS, from: '2026-10-07', to: '2026-10-14' }],
    })
    recordHarvestTried(state, 'fetch_gps_intensity_daily', {
      from: '2026-10-07',
      to: '2026-10-14',
    })
    storeDataset(state, {
      id: 'gps_kpi',
      columns: ['joueur', 'kpi_distanceTotal', 'trimp', 'movement_load', 'epoc_final'],
      rows: [
        {
          joueur: 'Kadin Shedrick',
          kpi_distanceTotal: 3200,
          trimp: 90,
          movement_load: 280,
          epoc_final: 12,
        },
      ],
      dateRange: { from: '2026-10-07', to: '2026-10-14' },
      domain: PREMIUM_DOMAIN.GPS,
    })
    const verification = verifyHarvestPlan(state, plan)
    const gps = verification.verdicts.find((row) => row.domain === PREMIUM_DOMAIN.GPS)
    assert.equal(
      gps?.status,
      'rows',
      'Bourg §5: GPS with live kpi_/trimp rows must not be harvest_empty_after_try'
    )
  })
})

test.group('Bourg deliverable L — semaine dernière = complete elapsed calendar week', () => {
  test('resolvePromptWindows maps semaine dernière to previous Mon–Sun, not 8 days through today', ({
    assert,
  }) => {
    const today = todayInTimeZone(DEFAULT_REPORT_TIMEZONE)
    const windows = resolvePromptWindows(
      'Bilan staff Bourg-en-Bresse de la semaine dernière: GPS, match, wellness',
      undefined,
      [],
      { timeZone: DEFAULT_REPORT_TIMEZONE, today }
    )
    const expected = previousCompleteCalendarWeek(today)
    assert.deepEqual(windows.display, expected)
    assert.notEqual(windows.display.to, today)
    const spanDays =
      (Date.parse(`${windows.display.to}T12:00:00Z`) -
        Date.parse(`${windows.display.from}T12:00:00Z`)) /
        86400000 +
      1
    assert.equal(spanDays, 7)
  })

  test('LLM window system prompt must not define last week as rolling 7 days through today', ({
    assert,
  }) => {
    const src = readFileSync(
      join(process.cwd(), 'app/services/report_v4/prompt_windows_llm.ts'),
      'utf8'
    )
    assert.notInclude(
      src,
      'last 7 calendar days ending today',
      'WINDOW_SYSTEM_PROMPT still teaches rolling 7d for derniere semaine / last week'
    )
    assert.match(src, /complete elapsed calendar week|previous Mon(?:day)?|lundi|dimanche/i)
  })
})
