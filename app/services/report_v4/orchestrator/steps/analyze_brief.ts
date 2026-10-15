import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { runAnalystSoftSkip } from '#services/report_v4/orchestrator/steps/analyst_soft_skip'
import { runAnalystPass } from '#services/report_v4/orchestrator/steps/analyst_pass'
import { mapPresentPlayersByDataset } from '#services/report_v4/present_players'

export const analyzeBrief = async (state: PipelineState): Promise<void> => {
  const { ctx } = state
  const { args, framed, plan: planRaw } = ctx
  const { club, multiSectionAsk, edit, preserveCanvas, displayRange, clubPostes } = framed
  const { policy, domains, softOps } = planRaw
  const { agentState, periodKpis } = state

  if (state.recommendationStrip || state.skipAnalystForSoftPath) {
    runAnalystSoftSkip(state)
  } else {
    const datasets = m.catalogDatasets(agentState)
    const presentPlayers = mapPresentPlayersByDataset(agentState.datasets.values())
    const presentBrief = Object.entries(presentPlayers)
      .map(([id, names]) => `${id}:[${names.slice(0, 40).join(',')}]`)
      .join(' | ')
    const envelope = [
      '[REPORT_V4_ANALYST]',
      `Club: ${club.name}`,
      `Here is the data for the Display period: ${displayRange.from} to ${displayRange.to}.`,
      `Allowed domains: ${domains.join(',')}`,
      `Club postes: ${clubPostes.join(', ') || 'none'}`,
      policy.excludedDomains.length ? `Banned domains: ${policy.excludedDomains.join(',')}` : '',
      policy.sectionOrder.length
        ? `Structure (coach): ${policy.sectionOrder.join(' → ')}`
        : policy.monitoringPlaybook
          ? 'Structure: squad story → data-justified individuals → relevant follow-ups.'
          : '',
      `Datasets: ${
        datasets
          .map((d) =>
            d.dateRange
              ? `${d.id}(${d.rows},${d.dateRange.from}→${d.dateRange.to})`
              : `${d.id}(${d.rows})`
          )
          .join(', ') || 'none'
      }`,
      presentBrief
        ? `Players present by dataset: ${presentBrief}. Athletes absent from all datasets → short sheet "No data for the period" via build_athlete_sheets — never search by name.`
        : 'Players present by dataset: none.',
      'ReportBrief.period and canvas titles use the Display period. Prefer datasetIds whose dateRange overlaps Display.',
      'Top-N tables: title Top N ⇒ exactly N rows.',
      'Cite precomputed ask facts (athlete.<id>.<metric>.{mean|max|last|delta}, team.<metric>.mean) — do not spam compute_report_fact for those.',
      domains.includes(m.PREMIUM_DOMAIN.SCORES)
        ? 'Scores: separate charts for performance_score and injury_risk_score when both asked. Individual lines ask → splitAthletes chunks (metric titles + i/n, no athlete name ranges) + separate team mean±minmax aggregates. Staff overview without individuals → athletes:[watch] or team-mean only (no full-roster split).'
        : '',
      'Top-N + mean (GPS etc.): filter/rank N athletes on real columns, add_chart with athletes=[N names], charts_to_team mode=overlay. Title Top N ⇒ N series (+ mean).',
      domains.includes(m.PREMIUM_DOMAIN.GPS) && periodKpis.length > 0
        ? `GPS periodKpis: ${periodKpis.map((k) => k.alias).join(', ')}. ${
            policy.monitoringPlaybook || multiSectionAsk
              ? 'Chart 2–4 distinct families — not distance+HMLD only.'
              : 'Chart only the families THIS ask needs (system GPS rails decide density).'
          }`
        : '',
      domains.includes(m.PREMIUM_DOMAIN.BIOMARKERS)
        ? 'Biomarkers: use fetch_biomarkers_daily / fetch_biomarkers on the biomarkers fetch window. If the dataset has zero lab rows, commit a short brief note "no lab rows" under a Biomarkers heading — do not fill with wellness/GPS columns.'
        : '',
      preserveCanvas
        ? `SOFT EDIT (${edit.canvasAsk.kind}): keep layout. ${m.softAnalystContinueForAsk({
            additive: Boolean(softOps?.additiveSoft),
            restoreSheets: Boolean(softOps?.restoreSheets),
            addSectionProse: Boolean(softOps?.addSectionProse),
            layoutRepair: Boolean(softOps?.layoutRepair),
            enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
          })}`
        : '',
      `Coach: ${args.prompt.trim()}`,
    ]
      .filter(Boolean)
      .join('\n')

    await runAnalystPass(state, envelope)
  }

  agentState.blockSql = false
}
