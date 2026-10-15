import type { ReportBrief } from '#services/report_v4/report_brief'
import {
  projectArtifactChartsForDesign,
  projectArtifactTablesForDesign,
} from '#services/report_v4/artifact_html'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import { projectFactsForDesign } from '#services/report_v4/report_facts'
import type { AppLanguage } from '#utils/localize'

type DesignerWellnessScale = {
  field: string
  label: string
  domain: string
  min: number
  max: number
  isReversed: boolean
  higherIsBetter: boolean
}

export const projectBriefForDesign = (insight: ReportBrief | null | undefined) => {
  if (!insight) return null
  return {
    title: insight.title,
    period: insight.period,
    focus: insight.focus.trim().slice(0, 160),
    narrative: insight.narrative,
    signals: insight.signals.map((s) => ({
      athlete: s.athlete,
      athleteId: s.athleteId,
      domains: s.domains,
      level: s.level,
      summary: s.summary,
    })),
    sections: insight.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      kind: sec.kind,
      athleteId: sec.athleteId,
      athleteName: sec.athleteName,
      bullets: sec.bullets,
      chartHints: sec.chartHints,
      tableHints: sec.tableHints,
    })),
  }
}

export const buildDesignContextPayload = (args: {
  run: ReportV4RunState
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  populatedDomains: string[]
  coachPrompt?: string
  wellnessScales?: DesignerWellnessScale[]
  sectionOrder?: string[]
}): string => {
  const charts = projectArtifactChartsForDesign(args.run.agentState.document)
  const tables = projectArtifactTablesForDesign(args.run.agentState.document)
  return JSON.stringify({
    pack: {
      id: args.designPack.id,
      hint: args.designPack.promptHint,
      fonts: args.designPack.fonts,
      palette: args.designPack.palette,
      tokens: args.designPack.tokens,
    },
    language: args.language,
    clubName: args.clubName,
    title: args.run.agentState.document.title,
    dateRange: args.run.agentState.document.dateRange,
    coachPrompt: args.coachPrompt?.trim() || null,
    insight: projectBriefForDesign(args.run.reportBrief),
    roster: args.run.roster.map((r) => ({
      name: r.name,
      position: r.position,
    })),
    populatedDomains: args.populatedDomains,
    wellnessScales: args.wellnessScales ?? [],
    wellnessScaleHint:
      'AUTHORITATIVE club wellness/sleep scales — captions MUST use these min/max (never invent 1–10 or 1–7 from date spans). isReversed=true → higherIsBetter; isReversed=false → high is worse (e.g. soreness). Date ranges like 1–7 Mars are NOT scales. Prefer exact label for prose.',
    charts,
    tables,
    facts: projectFactsForDesign(args.run.facts.values()),
    factHint:
      'Named facts are server-computed. In prose/KPI tiles write <span data-fact="fact.id"></span> only — NEVER a numeric literal (dates and section indexes excepted). Server fills values at finalize.',
    requiredChartIds: charts.map((c) => c.id),
    sectionOrder: args.sectionOrder?.length ? args.sectionOrder : null,
    sectionOrderHint: args.sectionOrder?.length
      ? `REQUIRED band order: ${args.sectionOrder.join(' → ')}. Cover → TOC → executive → domain bands → outliers/watch → athlete sheets → reliability.`
      : null,
    chartHostHint:
      'REQUIRED: host every requiredChartIds / charts[].id exactly once as empty <div class="chart-box" id="{exact charts[].id}" style="width:100%;height:280px"></div> (line ~340px). Copy ids verbatim from this payload — never invent chart_1..N. charts[] is lean metadata only (id/title/chartType/seriesNames) — do not expect option/dataset. Use charts[].title as-is (metric + i/n) — never invent athlete name ranges or Group N. Server injects real ECharts options at finalize. Boot/fonts/print CSS are injected server-side. Individual sheets: group chart ids under the matching athlete heading — never share one chart under a list of athlete headings.',
    prefer: 'set_report_html',
    groundingFirst:
      'Grounding runs on every set_report_html. On reject: fix cited spans and retry set_report_html. After two rejects the server applies the emergency template automatically.',
  })
}
