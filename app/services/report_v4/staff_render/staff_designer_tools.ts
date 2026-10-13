import logger from '@adonisjs/core/services/logger'
import type { PremiumTool } from '#services/premium_report/premium_report_tools'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { AppLanguage } from '#utils/localize'
import { projectFactsForDesign } from '#services/report_v4/report_facts'
import type { StaffFact } from '#services/report_v4/staff_render/facts_bind'
import {
  parseStaffReportDocument,
  staffReportToolInputSchema,
  STAFF_COMPONENT_NAMES,
} from '#services/report_v4/staff_render/schema'
import { renderStaffReportHtml } from '#services/report_v4/staff_render/render_report'
import { buildStaffBarlowFontFaceCss } from '#services/report_v4/staff_render/staff_fonts'
import {
  auditStaffReportVisual,
  formatStaffVisualAuditReport,
} from '#services/report_v4/staff_render/visual_audit'

const toStaffFacts = (run: ReportV4RunState): Map<string, StaffFact> => {
  const map = new Map<string, StaffFact>()
  for (const fact of run.facts.values()) {
    map.set(fact.id, { id: fact.id, value: fact.value })
  }
  return map
}

export const createStaffDesignerTools = (args: {
  run: ReportV4RunState
  language: AppLanguage
  clubName: string
  coachPrompt?: string
}): PremiumTool[] => [
  {
    schema: {
      name: 'get_design_context',
      description:
        'Materials for the staff component schema: available components, facts (cite as {{fait:id}}), brief, roster. Do not write HTML.',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async () =>
      JSON.stringify({
        mode: 'staff_components',
        language: args.language,
        clubName: args.clubName,
        coachPrompt: args.coachPrompt?.trim() || null,
        components: STAFF_COMPONENT_NAMES,
        facts: projectFactsForDesign(args.run.facts.values()),
        factHint:
          'All numbers in prose/KPI must use {{fait:id}} tokens. Server replaces them. Literal digits become warnings, not hard failures.',
        prefer: 'set_staff_report',
        forbidden: 'Do not call set_report_html. Do not emit free HTML.',
      }),
  },
  {
    schema: {
      name: 'set_staff_report',
      description:
        'PRIMARY: commit the staff report schema (pages × typed component blocks). Server renders HTML/SVG and PDF. Invalid schema → typed refusal, no half page.',
      input_schema: staffReportToolInputSchema as unknown as Record<string, unknown>,
    },
    execute: async (input) => {
      const parsed = await parseStaffReportDocument(input.document)
      if (!parsed.ok) {
        logger.warn(
          { code: parsed.code, reason: parsed.reason, detail: parsed.detail },
          'report_v4.staff_schema_refuse'
        )
        return JSON.stringify({
          error: parsed.code,
          reason: parsed.reason,
          detail: parsed.detail ?? null,
          hint: 'Fix the schema and retry set_staff_report. Do not send HTML.',
        })
      }
      const document = {
        ...parsed.document,
        language: parsed.document.language ?? args.language,
        clubName: parsed.document.clubName ?? args.clubName,
      }
      const rendered = renderStaffReportHtml({
        document,
        facts: toStaffFacts(args.run),
        fontFaceCss: buildStaffBarlowFontFaceCss(),
      })
      const visualWarnings = auditStaffReportVisual({
        html: rendered.html,
        announcedChartCount: rendered.chartCount,
      })
      if (rendered.warnings.length || rendered.missingFacts.length || visualWarnings.length) {
        logger.warn(
          {
            literalWarnings: rendered.warnings.slice(0, 40),
            missingFacts: rendered.missingFacts,
            visual: formatStaffVisualAuditReport(visualWarnings),
          },
          'report_v4.staff_render_warn'
        )
      }
      args.run.htmlArtifact = rendered.html
      args.run.agentState.mustUseTools = false
      return JSON.stringify({
        ok: true,
        mode: 'staff_components',
        bytes: rendered.html.length,
        pages: rendered.pageCount,
        charts: rendered.chartCount,
        warnings: [...rendered.warnings, ...visualWarnings.map((row) => row.code)],
        missingFacts: rendered.missingFacts,
        done: true,
      })
    },
  },
]
