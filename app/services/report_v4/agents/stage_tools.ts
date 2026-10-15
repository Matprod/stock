import logger from '@adonisjs/core/services/logger'
import type { PremiumTool } from '#services/premium_report/premium_report_tools'
import {
  emptyReportBrief,
  parseReportBrief,
} from '#services/report_v4/report_brief'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { AppLanguage } from '#utils/localize'
import {
  ARTIFACT_MIN_HTML_BYTES,
  REPORT_V4_ISO_DATE_PATTERN,
} from '#services/report_v4/report_v4_constants'
import {
  auditReportBrief,
  buildGroundingAuditInput,
  formatGroundingNudge,
} from '#services/report_v4/grounding_report'
import type { SubjectiveScaleFieldContent } from '#contracts/subjective_scale'
import { buildDesignContextPayload } from '#services/report_v4/agents/designer_tools_context'
import {
  executeSetReportHtml,
  type SetReportHtmlState,
} from '#services/report_v4/agents/designer_tools_set_html'
export { renderDesignerTemplateArtifact } from '#services/report_v4/agents/designer_tools_template'

type DesignerWellnessScale = {
  field: string
  label: string
  domain: string
  min: number
  max: number
  isReversed: boolean
  higherIsBetter: boolean
}

const WELLNESS_SCALE_DOMAINS = new Set(['health_rating', 'sleep'])

export const projectWellnessScalesForDesigner = (
  catalogue: SubjectiveScaleFieldContent[]
): DesignerWellnessScale[] =>
  catalogue
    .filter((field) => WELLNESS_SCALE_DOMAINS.has(field.domain))
    .map((field) => ({
      field: field.fieldName,
      label: field.label,
      domain: field.domain,
      min: field.min,
      max: field.max,
      isReversed: field.isReversed,
      higherIsBetter: field.isReversed,
    }))

export const projectHeatScalesFromCatalogue = (
  catalogue: SubjectiveScaleFieldContent[]
): Array<{ field: string; label: string; isReversed: boolean; min: number; max: number }> =>
  catalogue.map((field) => ({
    field: field.fieldName,
    label: field.label,
    isReversed: field.isReversed,
    min: field.min,
    max: field.max,
  }))

export const formatClubSubjectiveScalesBrief = (
  catalogue: SubjectiveScaleFieldContent[]
): string => {
  const rows = catalogue
    .filter(
      (field) => WELLNESS_SCALE_DOMAINS.has(field.domain) || field.domain === 'sport_activity'
    )
    .slice(0, 24)
  if (!rows.length) return ''
  return rows
    .map((field) => {
      const higherIsBetter = field.isReversed
      const goodEnd = higherIsBetter ? field.max : field.min
      const badEnd = higherIsBetter ? field.min : field.max
      const label = field.label?.trim() || field.fieldName
      return `${field.fieldName} (${label}): ${field.min}–${field.max}, higherIsBetter=${higherIsBetter} (good≈${goodEnd}, concern≈${badEnd})`
    })
    .join('; ')
}

export const projectSubjectiveScalesForProfiler = (
  catalogue: SubjectiveScaleFieldContent[]
): Array<{
  field: string
  label: string
  min: number
  max: number
  higherIsBetter: boolean
}> =>
  catalogue.map((field) => ({
    field: field.fieldName,
    label: field.label,
    min: field.min,
    max: field.max,
    higherIsBetter: field.isReversed,
  }))

const reportBriefInputSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    period: {
      type: 'object',
      properties: {
        from: {
          type: 'string',
          pattern: REPORT_V4_ISO_DATE_PATTERN,
          description: 'ISO display start (YYYY-MM-DD).',
        },
        to: {
          type: 'string',
          pattern: REPORT_V4_ISO_DATE_PATTERN,
          description: 'ISO display end (YYYY-MM-DD).',
        },
      },
      required: ['from', 'to'],
    },
    focus: { type: 'string', maxLength: 500 },
    narrative: {
      type: 'array',
      items: { type: 'string', maxLength: 600 },
      maxItems: 20,
    },
    signals: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        properties: {
          athlete: { type: 'string', maxLength: 120 },
          athleteId: { type: 'string', maxLength: 64 },
          domains: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 12 },
          level: { type: 'string', enum: ['watch', 'review', 'info'] },
          summary: { type: 'string', minLength: 1, maxLength: 600 },
          metrics: {
            type: 'object',
            additionalProperties: { type: ['string', 'number'] },
          },
        },
        required: ['summary', 'level'],
      },
    },
    sections: {
      type: 'array',
      maxItems: 24,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 64 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          kind: { type: 'string', enum: ['team', 'athlete', 'cross', 'coverage'] },
          athleteId: { type: 'string', maxLength: 64 },
          athleteName: { type: 'string', maxLength: 120 },
          bullets: { type: 'array', items: { type: 'string', maxLength: 400 }, maxItems: 12 },
          chartHints: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 8 },
          tableHints: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 8 },
        },
        required: ['title', 'kind'],
      },
    },
  },
  required: ['title', 'period'],
  description:
    'Structured ReportBrief. Provide at least one of narrative[], signals[], or sections[].',
} as const

export const createReportBriefTools = (run: ReportV4RunState): PremiumTool[] => [
  {
    schema: {
      name: 'commit_report_brief',
      description:
        'Commit the structured ReportBrief JSON (signals, sections, narrative). Required before designer stage.',
      input_schema: {
        type: 'object',
        properties: {
          insight: reportBriefInputSchema,
        },
        required: ['insight'],
      },
    },
    execute: async (input) => {
      const doc = run.agentState.document
      const fallbackPeriod = {
        from: doc.dateRange.from,
        to: doc.dateRange.to,
      }
      const raw =
        input.insight && typeof input.insight === 'object' && !Array.isArray(input.insight)
          ? (input.insight as Record<string, unknown>)
          : {}
      const coerced = {
        ...raw,
        title:
          (typeof raw.title === 'string' && raw.title.trim()) ||
          doc.title.trim() ||
          (run.agentState.language === 'fr' ? 'Rapport staff' : 'Staff report'),
        period: {
          from:
            (raw.period &&
            typeof raw.period === 'object' &&
            !Array.isArray(raw.period) &&
            typeof (raw.period as { from?: unknown }).from === 'string'
              ? (raw.period as { from: string }).from
              : null) || fallbackPeriod.from,
          to:
            (raw.period &&
            typeof raw.period === 'object' &&
            !Array.isArray(raw.period) &&
            typeof (raw.period as { to?: unknown }).to === 'string'
              ? (raw.period as { to: string }).to
              : null) || fallbackPeriod.to,
        },
      }
      const parsed = parseReportBrief(coerced)
      if (!parsed) {
        return JSON.stringify({
          error: 'Invalid ReportBrief',
          need: ['title', 'period.from', 'period.to'],
          hint: 'Include narrative[] and/or signals[] and/or sections[]',
        })
      }
      if (parsed.signals.length === 0 && parsed.narrative.length > 0) {
        parsed.signals = parsed.narrative.slice(0, 6).map((summary) => ({
          domains: [],
          level: /spike|overload|pull|watch|concern|risk|atypical|outlier/i.test(summary)
            ? ('watch' as const)
            : ('info' as const),
          summary,
          metrics: {},
        }))
      }
      if (parsed.sections.length === 0) {
        const headings = doc.blocks
          .filter((b) => b.type === 'heading')
          .map((b) => (b.type === 'heading' ? b.text.trim() : ''))
          .filter(Boolean)
        parsed.sections = headings.slice(0, 12).map((title, i) => ({
          id: `sec-${i + 1}`,
          title,
          kind: 'team' as const,
          bullets: [],
          chartHints: [],
          tableHints: [],
        }))
      }
      if (
        parsed.signals.length === 0 &&
        parsed.sections.length === 0 &&
        parsed.narrative.length === 0
      ) {
        return JSON.stringify({
          error: 'ReportBrief empty',
          need: 'narrative[] and/or signals[] and/or sections[]',
        })
      }
      if (parsed.signals.length === 0 && parsed.sections.length === 0) {
        parsed.sections = [
          {
            id: 'overview',
            title: parsed.title,
            kind: 'team',
            bullets: parsed.narrative.slice(0, 4),
            chartHints: [],
            tableHints: [],
          },
        ]
      }
      const grounding = auditReportBrief(
        parsed,
        buildGroundingAuditInput({
          roster: run.roster,
          state: run.agentState,
          allowNutritionScope: run.allowNutritionScope,
          clubName: run.clubName,
        })
      )
      if (!grounding.ok) {
        logger.warn(
          {
            codes: grounding.violations.map((v) => v.code),
            violations: grounding.violations.slice(0, 12),
          },
          'report_v4.grounding_reject'
        )
        return JSON.stringify({
          error: 'ReportBrief failed grounding audit',
          nudge: formatGroundingNudge(grounding),
          violations: grounding.violations.slice(0, 12),
        })
      }
      run.reportBrief = parsed
      return JSON.stringify({
        ok: true,
        signals: parsed.signals.length,
        sections: parsed.sections.length,
        narrative: parsed.narrative.length,
      })
    },
  },
  {
    schema: {
      name: 'get_report_brief',
      description: 'Read the current ReportBrief (if committed).',
      input_schema: { type: 'object', properties: {} },
    },
    execute: async () =>
      JSON.stringify({
        ok: true,
        insight: run.reportBrief ?? emptyReportBrief(run.agentState.dateRange),
      }),
  },
]

export const createDesignerTools = (args: {
  run: ReportV4RunState
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  populatedDomains: string[]
  coachPrompt?: string
  wellnessScales?: DesignerWellnessScale[]
  sectionOrder?: string[]
  individualSheetsAsk?: boolean
}): PremiumTool[] => {
  const state: SetReportHtmlState = {
    freeHtmlRejects: 0,
    hostRepairNudged: false,
  }

  return [
    {
      schema: {
        name: 'get_design_context',
        description:
          'Lean materials for composing the HTML artifact: pack tokens, projected ReportBrief, charts (use these ids), tables, roster, club wellness scales (min/max/isReversed). Call before set_report_html. Do not invent numbers.',
        input_schema: { type: 'object', properties: {} },
      },
      execute: async () => buildDesignContextPayload(args),
    },
    {
      schema: {
        name: 'set_report_html',
        description:
          'PRIMARY: commit free-form HTML with every requiredChartIds host. Server finalizes fonts/ECharts/print CSS. After two grounding rejects the server auto-applies the emergency template.',
        input_schema: {
          type: 'object',
          properties: {
            html: {
              type: 'string',
              minLength: ARTIFACT_MIN_HTML_BYTES,
              description:
                'Full HTML document starting with <!DOCTYPE html> and including an <html>…</html> tree. Empty chart hosts only — do not inline chart boot scripts.',
            },
          },
          required: ['html'],
        },
      },
      execute: async (input) =>
        executeSetReportHtml({
          input,
          toolArgs: args,
          state,
        }),
    },
  ]
}
