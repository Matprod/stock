import logger from '@adonisjs/core/services/logger'
import type { PremiumTool } from '#services/premium_report/premium_report_tools'
import {
  emptyReportBrief,
  parseReportBrief,
  type ReportBrief,
} from '#services/report_v4/report_brief'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import { buildClubHtmlReport, prepareReportV4Document } from '#services/report_v4/club_html_report'
import {
  collectInsightAthleteNames,
  resolveInsightRosterPhotos,
} from '#services/report_v4/roster_macros'
import {
  collectArtifactCharts,
  collectArtifactTables,
  countPresentChartHosts,
  finalizeArtifactHtml,
  finalizeMinimalEmptyArtifact,
  freeArtifactTooThinForCharts,
  migrateOrdinalChartHostsInHtml,
  projectArtifactChartsForDesign,
  projectArtifactTablesForDesign,
} from '#services/report_v4/artifact_html'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { AppLanguage } from '#utils/localize'
import {
  ARTIFACT_MIN_HTML_BYTES,
  REPORT_V4_ISO_DATE_PATTERN,
} from '#services/report_v4/report_v4_constants'
import {
  auditArtifactHtml,
  auditReportBrief,
  buildGroundingAuditInput,
  detectSoftDeltaGroundingScope,
  formatGroundingNudge,
  type GroundingWellnessScale,
} from '#services/report_v4/grounding_auditor'
import type { SubjectiveScaleFieldContent } from '#contracts/subjective_scale'
import { projectFactsForDesign } from '#services/report_v4/report_facts'
import {
  findDuplicateChartHosts,
  findMissingChartHosts,
  isReportV4RepairEnabled,
  issuesFromDuplicateChartHosts,
  issuesFromMissingChartHosts,
  repairHtml,
  toGroundingIssues,
} from '#services/report_v4/repair_html'

export type DesignerWellnessScale = {
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
    .filter((field) => WELLNESS_SCALE_DOMAINS.has(field.domain) || field.domain === 'sport_activity')
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

/** Lean ReportBrief for Designer — drop per-signal metrics (numbers live in charts/tables). */
const projectBriefForDesign = (insight: ReportBrief | null | undefined) => {
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
          (typeof raw.title === 'string' && raw.title.trim()) || doc.title.trim() || 'Staff report',
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

export const renderDesignerTemplateArtifact = async (args: {
  run: ReportV4RunState
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  populatedDomains: string[]
  coachPrompt?: string
  title?: string
}): Promise<string> => {
  const title =
    args.title?.trim() ||
    args.run.reportBrief?.title ||
    args.run.agentState.document.title ||
    'Staff report'
  args.run.agentState.document.title = title
  const document = prepareReportV4Document(
    args.run.agentState.document,
    args.language,
    args.run.agentState.heatScales
  )
  const roster = await resolveInsightRosterPhotos({
    roster: args.run.roster,
    athleteNames: collectInsightAthleteNames(args.run.reportBrief),
  })
  return buildClubHtmlReport({
    document,
    designPack: args.designPack,
    meta: {
      clubName: args.clubName,
      language: args.language,
      populatedDomains: args.populatedDomains,
      emptyDomains: [],
      title,
      designPackId: args.designPack.id,
      roster,
      reportBrief: args.run.reportBrief,
      coachPrompt: args.coachPrompt,
      clubInsightScience: args.run.clubInsightScience,
    },
  })
}

const renderTemplateArtifact = renderDesignerTemplateArtifact

const renderEmptyCoverageArtifact = (args: {
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  dateRange: { from: string; to: string }
  title?: string
  message?: string
}): string | null => {
  const finalized = finalizeMinimalEmptyArtifact({
    clubName: args.clubName,
    title: args.title,
    message:
      args.message?.trim() ||
      `For ${args.dateRange.from} → ${args.dateRange.to}, no usable data for this ask.`,
    dateRange: args.dateRange,
    pack: args.designPack,
    language: args.language,
  })
  return finalized.ok ? finalized.html : null
}

const tryEmergencyDesignerArtifact = async (
  args: {
    run: ReportV4RunState
    clubName: string
    language: AppLanguage
    designPack: ReportDesignPack
    populatedDomains: string[]
    coachPrompt?: string
    title?: string
  },
  reason: string
): Promise<{ html: string; mode: 'template_fallback' | 'free_empty' } | null> => {
  const charts = collectArtifactCharts(args.run.agentState.document, args.run.agentState.heatScales)
  const tables = collectArtifactTables(args.run.agentState.document)
  const populated = args.populatedDomains.filter(Boolean)
  try {
    if (charts.length === 0 && tables.length === 0) {
      logger.warn(
        {
          reason: `${reason}_empty_coverage`,
          charts: 0,
          tables: 0,
          populatedDomains: populated.length,
        },
        'report_v4.designer_fallback_template'
      )
      const emptyHtml = renderEmptyCoverageArtifact({
        clubName: args.clubName,
        language: args.language,
        designPack: args.designPack,
        dateRange: args.run.agentState.document.dateRange,
        title: args.title,
      })
      return emptyHtml ? { html: emptyHtml, mode: 'free_empty' } : null
    }
    logger.warn(
      {
        reason,
        charts: charts.length,
        tables: tables.length,
        briefSignals: args.run.reportBrief?.signals.length ?? 0,
        populatedDomains: populated.length,
      },
      'report_v4.designer_fallback_template'
    )
    const html = await renderTemplateArtifact(args)
    return { html, mode: 'template_fallback' }
  } catch (error) {
    logger.error(
      { err: error, reason, charts: charts.length },
      'report_v4.designer_template_recover_failed'
    )
    return null
  }
}

export const createDesignerTools = (args: {
  run: ReportV4RunState
  clubName: string
  language: AppLanguage
  designPack: ReportDesignPack
  populatedDomains: string[]
  coachPrompt?: string
  wellnessScales?: DesignerWellnessScale[]
}): PremiumTool[] => {
  let freeHtmlRejects = 0
  let hostRepairNudged = false

  const commitEmergencyFallback = async (
    reason: string,
    rejectPayload: Record<string, unknown>
  ): Promise<string> => {
    const emergency = await tryEmergencyDesignerArtifact(args, reason)
    if (emergency) {
      args.run.htmlArtifact = emergency.html
      args.run.agentState.mustUseTools = false
      logger.info(
        {
          reason,
          mode: emergency.mode,
          htmlBytes: emergency.html.length,
          freeHtmlRejects,
        },
        'report_v4.designer_template_recovered'
      )
      return JSON.stringify({
        ok: true,
        mode: emergency.mode,
        autoFallback: true,
        bytes: emergency.html.length,
        charts: collectArtifactCharts(args.run.agentState.document, args.run.agentState.heatScales)
          .length,
        sections: args.run.reportBrief?.sections.length ?? 0,
        freeHtmlRejects,
        priorReject: rejectPayload,
        done: true,
      })
    }
    return JSON.stringify({
      ...rejectPayload,
      freeHtmlRejects,
      autoFallbackFailed: true,
      hint: 'Emergency template failed — retry set_report_html with a thinner document hosting every requiredChartIds id.',
    })
  }

  return [
    {
      schema: {
        name: 'get_design_context',
        description:
          'Lean materials for composing the HTML artifact: pack tokens, projected ReportBrief, charts (use these ids), tables, roster, club wellness scales (min/max/isReversed). Call before set_report_html. Do not invent numbers.',
        input_schema: { type: 'object', properties: {} },
      },
      execute: async () => {
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
          chartHostHint:
            'REQUIRED: host every requiredChartIds / charts[].id exactly once as empty <div class="chart-box" id="{exact charts[].id}" style="width:100%;height:280px"></div> (line ~340px). Copy ids verbatim from this payload — never invent chart_1..N. charts[] is lean metadata only (id/title/chartType/seriesNames) — do not expect option/dataset. Use charts[].title as-is (metric + i/n) — never invent athlete name ranges or Group N. Server injects real ECharts options at finalize. Boot/fonts/print CSS are injected server-side.',
          prefer: 'set_report_html',
          groundingFirst:
            'Grounding runs on every set_report_html. On reject: fix cited spans and retry set_report_html. After two rejects the server applies the emergency template automatically.',
        })
      },
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
      execute: async (input) => {
        try {
          const raw = typeof input.html === 'string' ? input.html.trim() : ''
          const charts = collectArtifactCharts(
            args.run.agentState.document,
            args.run.agentState.heatScales
          )
          const tables = collectArtifactTables(args.run.agentState.document)
          const groundingInput = {
            ...buildGroundingAuditInput({
              roster: args.run.roster,
              state: args.run.agentState,
              allowNutritionScope: args.run.allowNutritionScope,
              wellnessScales: (args.wellnessScales ?? []) as GroundingWellnessScale[],
              clubName: args.clubName,
            }),
            enforceLiteralFactGate: args.run.facts.size > 0,
            facts: [...args.run.facts.values()].map((fact) => ({
              id: fact.id,
              value: fact.value,
              unit: fact.unit,
            })),
            groundingLanguage: args.language,
            properNames: [args.clubName],
          }
          const groundingScope = detectSoftDeltaGroundingScope(raw)
          let workingHtml = raw
          let grounding = auditArtifactHtml(workingHtml, groundingInput, groundingScope)
          const requiredChartIds = charts.map((c) => c.id)
          const repairFacts = [...args.run.facts.values()].map((fact) => ({
            id: fact.id,
            value: fact.value,
            unit: fact.unit,
          }))
          const runRepair = async (issues = toGroundingIssues(grounding.violations)) =>
            repairHtml(workingHtml, issues, {
              language: args.language,
              facts: repairFacts,
              requiredChartIds,
              reaudit: async (candidate) => {
                const result = auditArtifactHtml(
                  candidate,
                  groundingInput,
                  detectSoftDeltaGroundingScope(candidate) ?? groundingScope
                )
                return toGroundingIssues(result.violations)
              },
            })

          if (!grounding.ok) {
            logger.warn(
              {
                codes: grounding.violations.map((v) => v.code),
                violations: grounding.violations.slice(0, 12),
              },
              'report_v4.grounding_reject'
            )
            if (isReportV4RepairEnabled()) {
              const repaired = await runRepair()
              if (repaired.verdict === 'ok' || repaired.verdict === 'repaired') {
                workingHtml = repaired.html
                grounding = auditArtifactHtml(
                  workingHtml,
                  groundingInput,
                  detectSoftDeltaGroundingScope(workingHtml) ?? groundingScope
                )
              }
            }
            if (!grounding.ok) {
              freeHtmlRejects += 1
              args.run.htmlArtifact = null
              if (freeHtmlRejects < 2) {
                return JSON.stringify({
                  error: 'HTML failed grounding audit',
                  nudge: formatGroundingNudge(grounding),
                  violations: grounding.violations.slice(0, 8),
                  freeHtmlRejects,
                  hint: 'Fix only the cited spans / numbers, then retry set_report_html. After two rejects the server auto-templates.',
                })
              }
              return await commitEmergencyFallback('set_report_html_grounding_reject', {
                error: 'HTML failed grounding audit after retry',
                nudge: formatGroundingNudge(grounding),
                violations: grounding.violations.slice(0, 8),
                hint: 'Repeated grounding reject — emergency template applied.',
              })
            }
          }

          const migrated = migrateOrdinalChartHostsInHtml(workingHtml, charts)
          let authoredHtml = migrated.html
          let presentBefore = countPresentChartHosts(authoredHtml, charts)
          let missingBefore = Math.max(0, charts.length - presentBefore)

          if (missingBefore > 0 && charts.length > 0 && isReportV4RepairEnabled()) {
            const hostIssues = [
              ...issuesFromMissingChartHosts(findMissingChartHosts(authoredHtml, requiredChartIds)),
              ...issuesFromDuplicateChartHosts(findDuplicateChartHosts(authoredHtml)),
            ]
            const hostRepair = await repairHtml(authoredHtml, hostIssues, {
              language: args.language,
              facts: repairFacts,
              requiredChartIds,
              reaudit: async (candidate) => {
                const result = auditArtifactHtml(
                  candidate,
                  groundingInput,
                  detectSoftDeltaGroundingScope(candidate) ?? groundingScope
                )
                return [
                  ...toGroundingIssues(result.violations),
                  ...issuesFromMissingChartHosts(findMissingChartHosts(candidate, requiredChartIds)),
                  ...issuesFromDuplicateChartHosts(findDuplicateChartHosts(candidate)),
                ]
              },
            })
            if (hostRepair.verdict === 'ok' || hostRepair.verdict === 'repaired') {
              authoredHtml = hostRepair.html
              presentBefore = countPresentChartHosts(authoredHtml, charts)
              missingBefore = Math.max(0, charts.length - presentBefore)
            }
          }

          if (missingBefore > 0 && charts.length > 0 && !hostRepairNudged && !isReportV4RepairEnabled()) {
            hostRepairNudged = true
            freeHtmlRejects += 1
            args.run.htmlArtifact = null
            if (freeHtmlRejects < 2) {
              return JSON.stringify({
                error: 'html missing chart hosts — repair required',
                requiredChartIds,
                presentHosts: presentBefore,
                missingHosts: missingBefore,
                freeHtmlRejects,
                hint: 'Host every requiredChartIds id as <div class="chart-box" id="{exact id}">, then retry set_report_html.',
              })
            }
            return await commitEmergencyFallback('set_report_html_missing_hosts', {
              error: 'html missing chart hosts after retry',
              requiredChartIds,
              presentHosts: presentBefore,
              missingHosts: missingBefore,
            })
          }

          if (
            missingBefore > 0 &&
            freeArtifactTooThinForCharts({
              chartCount: charts.length,
              injectedCharts: missingBefore,
              presentHosts: presentBefore,
            })
          ) {
            freeHtmlRejects += 1
            args.run.htmlArtifact = null
            return await commitEmergencyFallback('set_report_html_thin_hosts', {
              error: 'html too thin: most chart hosts missing from authored layout',
              charts: charts.length,
              presentHosts: presentBefore,
              missingHosts: missingBefore,
              requiredChartIds,
            })
          }

          const allowInject = missingBefore > 0 && hostRepairNudged
          const finalized = finalizeArtifactHtml({
            html: authoredHtml,
            charts,
            pack: args.designPack,
            coachPrompt: args.coachPrompt,
            language: args.language,
            tables,
            injectMissingHosts: allowInject,
            facts: args.run.facts,
          })
          if (!finalized.ok) {
            freeHtmlRejects += 1
            args.run.htmlArtifact = null
            return await commitEmergencyFallback('set_report_html_finalize_reject', {
              error: finalized.error,
              warnings: finalized.warnings,
              requiredChartIds: charts.map((c) => c.id),
            })
          }
          if (
            freeArtifactTooThinForCharts({
              chartCount: charts.length,
              injectedCharts: finalized.injectedCharts,
              presentHosts: finalized.presentHosts,
            })
          ) {
            freeHtmlRejects += 1
            args.run.htmlArtifact = null
            return await commitEmergencyFallback('set_report_html_thin_finalized', {
              error: 'html too thin: most chart hosts missing from authored layout',
              warnings: finalized.warnings,
              charts: charts.length,
              presentHosts: finalized.presentHosts,
              injectedCharts: finalized.injectedCharts,
              requiredChartIds: charts.map((c) => c.id),
            })
          }
          const finalizedGrounding = auditArtifactHtml(
            finalized.html,
            groundingInput,
            detectSoftDeltaGroundingScope(finalized.html) ?? groundingScope
          )
          if (!finalizedGrounding.ok) {
            freeHtmlRejects += 1
            args.run.htmlArtifact = null
            logger.warn(
              {
                codes: finalizedGrounding.violations.map((v) => v.code),
                violations: finalizedGrounding.violations.slice(0, 12),
              },
              'report_v4.grounding_reject'
            )
            return await commitEmergencyFallback('set_report_html_finalized_grounding', {
              error: 'Finalized HTML failed grounding audit',
              nudge: formatGroundingNudge(finalizedGrounding),
              violations: finalizedGrounding.violations.slice(0, 8),
            })
          }
          args.run.htmlArtifact = finalized.html
          args.run.agentState.mustUseTools = false
          return JSON.stringify({
            ok: true,
            mode: 'free',
            bytes: finalized.html.length,
            charts: charts.length,
            presentHosts: finalized.presentHosts,
            injectedCharts: finalized.injectedCharts,
            warnings: finalized.warnings,
            done: true,
          })
        } catch (error) {
          freeHtmlRejects += 1
          args.run.htmlArtifact = null
          logger.error({ err: error }, 'report_v4.set_report_html_exception')
          return await commitEmergencyFallback('set_report_html_exception', {
            error: 'set_report_html raised an exception',
          })
        }
      },
    },
  ]
}
