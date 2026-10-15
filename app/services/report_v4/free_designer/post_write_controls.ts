import logger from '@adonisjs/core/services/logger'
import { logLiteralFactWarnings } from '#services/report_v4/agents/designer_tools_set_html_grounding'
import {
  runLayoutChecksOnPages,
  type LayoutWarning,
} from '#services/report_v4/free_designer/layout_checks'
import {
  auditArtifactHtml,
  buildGroundingAuditInput,
  type GroundingViolation,
} from '#services/report_v4/grounding_report'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { AppLanguage } from '#utils/localize'

export type FreeDesignerPostWriteResult = {
  groundingWarnings: GroundingViolation[]
  layoutWarnings: LayoutWarning[]
}

export type FreeDesignerPostWriteArgs = {
  run: ReportV4RunState
  language: AppLanguage
  clubName: string
}

const runFreeDesignerGroundingWarnings = (args: {
  run: ReportV4RunState
  language: AppLanguage
  clubName: string
}): GroundingViolation[] => {
  const html = args.run.htmlArtifact
  if (!html) return []
  const groundingInput = {
    ...buildGroundingAuditInput({
      roster: args.run.roster,
      state: args.run.agentState,
      allowNutritionScope: args.run.allowNutritionScope,
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
  const result = auditArtifactHtml(html, groundingInput)
  logLiteralFactWarnings(result)
  const combined = [...result.violations, ...(result.warnings ?? [])]
  if (combined.length) {
    logger.warn(
      {
        violations: result.violations.slice(0, 12),
        warnings: (result.warnings ?? []).slice(0, 12),
      },
      'report_v4.free_designer_grounding_warn'
    )
  }
  return combined
}

export const runFreeDesignerPostWriteControls = async (
  args: FreeDesignerPostWriteArgs
): Promise<FreeDesignerPostWriteResult> => {
  const { run, language, clubName } = args
  const html = run.htmlArtifact
  if (!html) {
    return {
      groundingWarnings: [],
      layoutWarnings: [],
    }
  }

  const groundingWarnings = runFreeDesignerGroundingWarnings({ run, language, clubName })
  run.groundingWarnings = groundingWarnings

  const layout = await runLayoutChecksOnPages(html)
  run.layoutWarnings = layout.warnings
  if (layout.warnings.length) {
    logger.warn(
      { count: layout.warnings.length, warnings: layout.warnings.slice(0, 20) },
      'report_v4.free_designer_layout_warn'
    )
  }

  return {
    groundingWarnings,
    layoutWarnings: layout.warnings,
  }
}
