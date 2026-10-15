import logger from '@adonisjs/core/services/logger'
import {
  auditArtifactHtml,
  buildGroundingAuditInput,
  detectSoftDeltaGroundingScope,
  formatGroundingNudge,
  type GroundingWellnessScale,
} from '#services/report_v4/grounding_report'
import {
  commitEmergencyFallback,
  type DesignerToolArgs,
} from '#services/report_v4/agents/designer_tools_fallback'
import type { SetReportHtmlState } from '#services/report_v4/agents/designer_tools_set_html_hosts'

type DesignerWellnessScale = {
  field: string
  label: string
  domain: string
  min: number
  max: number
  isReversed: boolean
  higherIsBetter: boolean
}

export const buildSetHtmlGroundingCtx = (args: {
  raw: string
  toolArgs: DesignerToolArgs & { wellnessScales?: DesignerWellnessScale[] }
  charts: Array<{ id: string }>
}) => {
  const { toolArgs, charts } = args
  const groundingInput = {
    ...buildGroundingAuditInput({
      roster: toolArgs.run.roster,
      state: toolArgs.run.agentState,
      allowNutritionScope: toolArgs.run.allowNutritionScope,
      wellnessScales: (toolArgs.wellnessScales ?? []) as GroundingWellnessScale[],
      clubName: toolArgs.clubName,
    }),
    enforceLiteralFactGate: toolArgs.run.facts.size > 0,
    facts: [...toolArgs.run.facts.values()].map((fact) => ({
      id: fact.id,
      value: fact.value,
      unit: fact.unit,
    })),
    groundingLanguage: toolArgs.language,
    properNames: [toolArgs.clubName],
  }
  const groundingScope = detectSoftDeltaGroundingScope(args.raw)
  const workingHtml = args.raw
  const grounding = auditArtifactHtml(workingHtml, groundingInput, groundingScope)
  return {
    workingHtml,
    grounding,
    groundingInput,
    groundingScope,
    requiredChartIds: charts.map((c) => c.id),
  }
}

export type SetHtmlGroundingCtx = ReturnType<typeof buildSetHtmlGroundingCtx>

export const logLiteralFactWarnings = (result: ReturnType<typeof auditArtifactHtml>) => {
  if (!result.warnings?.length) return
  logger.warn(
    {
      codes: result.warnings.map((row) => row.code),
      warnings: result.warnings.slice(0, 12),
    },
    'report_v4.literal_fact_warn'
  )
}

export const repairAndGateSetHtmlGrounding = async (args: {
  ctx: SetHtmlGroundingCtx
  toolArgs: DesignerToolArgs
  state: SetReportHtmlState
  bumpReject: () => void
  emergency: (reason: string, rejectPayload: Record<string, unknown>) => Promise<string>
}): Promise<string | SetHtmlGroundingCtx> => {
  const { workingHtml, grounding, groundingInput, groundingScope, requiredChartIds } = args.ctx
  const { state, bumpReject, emergency } = args

  logLiteralFactWarnings(grounding)

  if (!grounding.ok) {
    const onlyLiterals =
      grounding.violations.length > 0 &&
      grounding.violations.every((row) => row.code === 'literal_number')
    if (onlyLiterals && grounding.repairedHtml) {
      const repairedAudit = auditArtifactHtml(
        grounding.repairedHtml,
        groundingInput,
        groundingScope
      )
      if (repairedAudit.ok) {
        return {
          workingHtml: grounding.repairedHtml,
          grounding: repairedAudit,
          groundingInput,
          groundingScope,
          requiredChartIds,
        }
      }
    }
    logger.warn(
      {
        codes: grounding.violations.map((v) => v.code),
        violations: grounding.violations.slice(0, 12),
      },
      'report_v4.grounding_reject'
    )
    bumpReject()
    if (state.freeHtmlRejects < 2) {
      return JSON.stringify({
        error: 'HTML failed grounding audit',
        nudge: formatGroundingNudge(grounding),
        violations: grounding.violations.slice(0, 8),
        warnings: grounding.warnings?.slice(0, 8),
        repairedHtml: grounding.repairedHtml,
        freeHtmlRejects: state.freeHtmlRejects,
        hint: 'Fix only the cited spans / numbers, then retry set_report_html. After two rejects the server auto-templates.',
      })
    }
    return await emergency('set_report_html_grounding_reject', {
      error: 'HTML failed grounding audit after retry',
      nudge: formatGroundingNudge(grounding),
      violations: grounding.violations.slice(0, 8),
      warnings: grounding.warnings?.slice(0, 8),
      hint: 'Repeated grounding reject — emergency template applied.',
    })
  }

  return {
    workingHtml,
    grounding,
    groundingInput,
    groundingScope,
    requiredChartIds,
  }
}

export const commitSetHtmlEmergency = (args: {
  toolArgs: DesignerToolArgs
  state: SetReportHtmlState
  reason: string
  rejectPayload: Record<string, unknown>
}) =>
  commitEmergencyFallback({
    toolArgs: args.toolArgs,
    reason: args.reason,
    rejectPayload: args.rejectPayload,
    freeHtmlRejects: args.state.freeHtmlRejects,
  })
