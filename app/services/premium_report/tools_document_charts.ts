import { PREMIUM_LINE_MAX_ATHLETES } from '#constants/premium_report.constants'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { executeAddChart } from '#services/premium_report/tools_document_charts_add'

export const createChartDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'add_chart',
      description: `Add chart from datasetId. ALWAYS pass chartType (line|bar|radar|scatter|heatmap|donut|bar-line). Never mix performance_score and injury_risk_score on one chart. Radar = single athlete multi-axis profile only — multi-athlete wellness/GPS profiles auto-coerce to grouped bar. Single athlete + same-scale subjective ratings (mood/stress/energy/soreness/sleep quality on the club Likert band) → ONE line chart with values=[...] for all compatible ratings. Multi-athlete lines stay ONE metric (use athletes:[] or splitAthletes). Title = metric or "Wellness" for multi-rating; no athlete name ranges (legend carries names; split parts use i/n). Staff overview: athletes:[...] (≤${PREMIUM_LINE_MAX_ATHLETES}) or charts_to_team mode=overlay — do NOT splitAthletes the whole roster. splitAthletes:true when coach asked every player / individual lines (chunks ≤${PREMIUM_LINE_MAX_ATHLETES}). Individuals + team mean/minmax → split chunks PLUS separate aggregate mean±minmax charts.`,
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          datasetId: { type: 'string' },
          datasetIds: { type: 'array', items: { type: 'string' } },
          chartType: {
            type: 'string',
            enum: ['donut', 'bar', 'line', 'bar-line', 'heatmap', 'radar', 'scatter'],
          },
          category: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
          athletes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Limit line series to these athlete names (exact match on joueur).',
          },
          splitAthletes: {
            type: 'boolean',
            description: `Opt-in when coach asked every player / individually / individual evolutions. Chunks into ≤${PREMIUM_LINE_MAX_ATHLETES} series; titles stay metric (+ i/n), never athlete ranges. Default false — prefer athletes:[...] Top-N or charts_to_team.`,
          },
          refLines: {
            type: 'string',
            enum: ['none', 'mean', 'mean_median', 'full'],
            description:
              'Default none. Use mean/mean_median only when a squad baseline is useful (ranking vs average) — not on multi-player evolutions.',
          },
          option: { type: 'object' },
          after: { type: 'string' },
        },
        required: ['title', 'chartType'],
      },
    },
    execute: async (input) => executeAddChart(state, input),
  },
]
