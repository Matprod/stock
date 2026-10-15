import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { recoverTemplateArtifact } from '#services/report_v4/orchestrator/steps/designer_template_recovery'
import { runDesignerPostProcess } from '#services/report_v4/orchestrator/steps/designer_post_process'
import {
  isReportV4FreeDesignerEnabled,
  isReportV4FreeDesignerRefsEnabled,
} from '#services/report_v4/free_designer/flag'
import {
  buildBudgetedFreeDesignerPrompt,
  FREE_DESIGNER_CONTINUE,
  FREE_DESIGNER_SYSTEM_PROMPT,
} from '#services/report_v4/free_designer/build_prompt'
import { designerOverflowStaffMessage } from '#services/report_v4/free_designer/prompt_budget'
import { selectFreeDesignerReferences } from '#services/report_v4/free_designer/select_references'
import { createFreeDesignerTools } from '#services/report_v4/free_designer/tools'
import { freeDesignerHtmlLooksValid } from '#services/report_v4/free_designer/assemble_document'
import { Exception } from '@adonisjs/core/exceptions'

export const runDesignerCompose = async (state: PipelineState): Promise<void> => {
  const { ctx } = state
  const { args, deps: d, framed, plan: planRaw } = ctx
  const { club, displayRange, multiSectionAsk } = framed
  const {
    policy,
    route,
    designPack,
    domains,
    artifactEnvelope,
    askRequirements,
    requestedMeasure,
  } = planRaw
  const { run, agentState, wellnessCatalogue, onIteration, sumSecs } = state
  const { chartCount, charts } = state
  const needsFreshArtifact = state.needsFreshArtifact
  const softRebindRepair = state.softRebindRepair
  const useFreeDesigner = isReportV4FreeDesignerEnabled() && !softRebindRepair

  const needsDesigner = needsFreshArtifact && !m.artifactHtmlLooksValid(run.htmlArtifact)

  if (needsDesigner) {
    if (useFreeDesigner) {
      const individualSheetsAsk =
        artifactEnvelope.coverage.individualSheets ||
        policy.reportShape === m.COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS ||
        Boolean(agentState.limits?.individualLinesAsk)
      const hasLongTable = m
        .collectArtifactTables(run.document)
        .some((table) => table.rows.length > 10)
      const references = isReportV4FreeDesignerRefsEnabled()
        ? selectFreeDesignerReferences({
            domains,
            individualSheets: individualSheetsAsk,
            hasLongTable,
            multiSection: multiSectionAsk,
            pageCountHint: policy.sectionOrder.length || undefined,
            language: args.language,
          })
        : []
      const budgeted = buildBudgetedFreeDesignerPrompt({
        language: args.language,
        references,
        askContract: { requirements: askRequirements, requestedMeasure },
        coachPrompt: args.prompt,
        facts: run.facts,
        datasets: run.agentState.datasets,
        displayRange,
        clubName: club.name,
        systemPrompt: FREE_DESIGNER_SYSTEM_PROMPT,
      })
      m.logger.info(
        {
          parts: budgeted.parts,
          trimmed: budgeted.trimmed,
          refs: budgeted.references.map((ref) => ref.id),
          withinHardLimit: budgeted.withinHardLimit,
        },
        'report_v4.designer_prompt_budget'
      )
      if (!budgeted.withinHardLimit) {
        const staffMessage = designerOverflowStaffMessage(args.language === 'en' ? 'en' : 'fr')
        m.logger.warn(
          { totalTokens: budgeted.parts.total, parts: budgeted.parts },
          'report_v4.designer_prompt_overflow'
        )
        throw new Exception(staffMessage, { status: 422, code: 'E_REPORT_V4_DESIGNER_OVERFLOW' })
      }
      agentState.requestPrompt = '[REPORT_V4_FREE_DESIGNER]'
      agentState.mustUseTools = true
      agentState.toolHistory = []
      const tools = createFreeDesignerTools({
        run,
        language: args.language,
        clubName: club.name,
      })
      const rejectMissingArtifact = (_s: typeof agentState): string | null => {
        if (
          freeDesignerHtmlLooksValid(run.htmlArtifact) ||
          m.artifactHtmlLooksValid(run.htmlArtifact)
        ) {
          return null
        }
        return FREE_DESIGNER_CONTINUE
      }
      let result: Awaited<ReturnType<typeof d.runPremiumReportAgent>>
      try {
        result = await d.runPremiumReportAgent({
          systemStable: `${FREE_DESIGNER_SYSTEM_PROMPT}\n\n${budgeted.fixedPrefix}`,
          systemRun: budgeted.variableSuffix,
          userPrompt:
            'Compose the report pages for this request. Commit with set_report_pages in batches of 1–3 pages (mode=replace then mode=append, done=true on the last batch). Do not emit the whole report in one tool call.',
          history: [],
          tools,
          state: agentState,
          maxIterations: m.REPORT_V4_DESIGNER_MAX_ITERATIONS,
          forceAnswerAt: m.REPORT_V4_DESIGNER_FORCE_ANSWER_AT,
          minIterations: m.REPORT_V4_DESIGNER_MIN_ITERATIONS,
          maxEndTurnNudges: 4,
          continuePrompt: FREE_DESIGNER_CONTINUE,
          acceptEndTurn: rejectMissingArtifact,
          maxTokens: m.REPORT_V4_DESIGNER_MAX_TOKENS,
          temperature: 0.35,
          onIteration: onIteration('designer'),
          signal: args.signal,
        })
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error)
        if (
          /too many tokens|prompt is too long|context.?length|maximum.*token|ValidationException/i.test(
            raw
          )
        ) {
          throw new Exception(designerOverflowStaffMessage(args.language === 'en' ? 'en' : 'fr'), {
            status: 422,
            code: 'E_REPORT_V4_DESIGNER_OVERFLOW',
            cause: error,
          })
        }
        throw error
      }
      m.addUsage(run.usage, result.usage)
      run.iterations += result.iterations
      m.logReportV4AgentStop({
        agent: 'designer',
        stopClass: result.stopClass,
        iterations: result.iterations,
        maxIterations: result.maxIterations,
        forceAnswerAt: result.forceAnswerAt,
        profile: 'full',
      })
      const designerTotal = {
        agent: 'designer',
        iterations: result.iterations,
        durationSec: sumSecs('designer'),
        usage: result.usage,
        detail: `htmlBytes=${run.htmlArtifact?.length ?? 0} freeDesigner=1 refs=${budgeted.references.map((r) => r.id).join(',')} tokens~${budgeted.parts.total}`,
      }
      m.logReportV4AgentTotal(designerTotal)
      state.recordAgentCost(designerTotal)
      m.logger.info(
        {
          htmlBytes: run.htmlArtifact?.length ?? 0,
          freeDesigner: true,
          refs: budgeted.references.map((r) => r.id),
          iterations: result.iterations,
          promptTokens: budgeted.parts.total,
        },
        'report_v4.designer_done'
      )
    } else {
      const designerMode = softRebindRepair ? 'soft_rebind_repair' : 'free_html_artifact'
      const envelope = [
        '[REPORT_V4_DESIGNER]',
        softRebindRepair ? '[SOFT_REBIND_REPAIR]' : '',
        `Club: ${club.name}`,
        `Display period: ${displayRange.from} → ${displayRange.to}`,
        `Pack: ${designPack.id}`,
        softRebindRepair
          ? 'Mode: repair soft rebind — set_report_html with every requiredChartIds host; keep canvas chart ids'
          : 'Mode: free HTML via set_report_html (Claude artifact)',
        `Charts to host: ${chartCount}`,
        `Brief signals: ${run.reportBrief?.signals.length ?? 0}`,
        policy.sectionOrder.length
          ? `REQUIRED section order (coach): ${policy.sectionOrder.join(' → ')}`
          : '',
        `Coach: ${args.prompt.trim()}`,
      ]
        .filter(Boolean)
        .join('\n')
      agentState.requestPrompt = envelope
      agentState.mustUseTools = true
      agentState.toolHistory = []
      const wellnessScales = m.projectWellnessScalesForDesigner(wellnessCatalogue)
      const wellnessScalesLine = wellnessScales
        .map(
          (scale) =>
            `${scale.field}(${scale.label || scale.field}): ${scale.min}–${scale.max}, isReversed=${scale.isReversed}`
        )
        .join(' | ')
      const tools = m.createDesignerTools({
        run,
        clubName: club.name,
        language: args.language,
        designPack,
        populatedDomains: domains,
        coachPrompt: args.prompt,
        wellnessScales,
        sectionOrder: policy.sectionOrder,
        individualSheetsAsk:
          artifactEnvelope.coverage.individualSheets ||
          policy.reportShape === m.COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS ||
          Boolean(agentState.limits?.individualLinesAsk),
      })
      const rejectMissingArtifact = (_s: typeof agentState): string | null => {
        if (m.artifactHtmlLooksValid(run.htmlArtifact)) return null
        return m.REPORT_V4_DESIGNER_CONTINUE
      }
      const designerInstruction = softRebindRepair
        ? 'SOFT REBIND REPAIR: deterministic rebind failed. Call get_design_context, then set_report_html with every requiredChartIds host once. Preserve canvas chart ids. Do not invent numbers. If grounding rejects, fix cited spans and retry set_report_html (server auto-templates after two rejects).'
        : 'Call get_design_context then set_report_html with every requiredChartIds host. Adapt density to THE ask. Do not invent numbers. If grounding rejects, fix cited spans and retry set_report_html once — server auto-templates only after two rejects.'
      const designerRunArgs = {
        clubName: club.name,
        route,
        language: args.language,
        packHint: designPack.promptHint,
        policy,
        displayRange,
        wellnessScalesLine: wellnessScalesLine || undefined,
      }
      const result = await d.runPremiumReportAgent({
        systemStable: m.buildDesignerSystemStable(),
        systemRun: m.buildDesignerSystemRun(designerRunArgs),
        userPrompt: JSON.stringify({
          stage: 'designer',
          mode: designerMode,
          coach: args.prompt.trim(),
          pack: { id: designPack.id, hint: designPack.promptHint },
          wellnessScales,
          chartCount,
          displayRange,
          request: envelope,
          instruction: designerInstruction,
        }),
        history: [],
        tools,
        state: agentState,
        maxIterations: softRebindRepair
          ? Math.min(8, m.REPORT_V4_DESIGNER_MAX_ITERATIONS)
          : m.REPORT_V4_DESIGNER_MAX_ITERATIONS,
        forceAnswerAt: softRebindRepair
          ? Math.min(6, m.REPORT_V4_DESIGNER_FORCE_ANSWER_AT)
          : m.REPORT_V4_DESIGNER_FORCE_ANSWER_AT,
        minIterations: m.REPORT_V4_DESIGNER_MIN_ITERATIONS,
        maxEndTurnNudges: softRebindRepair ? 2 : 4,
        continuePrompt: m.REPORT_V4_DESIGNER_CONTINUE,
        acceptEndTurn: rejectMissingArtifact,
        maxTokens: m.REPORT_V4_DESIGNER_MAX_TOKENS,
        temperature: softRebindRepair ? 0.2 : 0.35,
        onIteration: onIteration('designer'),
        signal: args.signal,
      })
      m.addUsage(run.usage, result.usage)
      run.iterations += result.iterations
      m.logReportV4AgentStop({
        agent: 'designer',
        stopClass: result.stopClass,
        iterations: result.iterations,
        maxIterations: result.maxIterations,
        forceAnswerAt: result.forceAnswerAt,
        profile: softRebindRepair ? 'soft' : 'full',
      })
      const designerTotal = {
        agent: 'designer',
        iterations: result.iterations,
        durationSec: sumSecs('designer'),
        usage: result.usage,
        detail: `htmlBytes=${run.htmlArtifact?.length ?? 0} freeArtifact=${Boolean(run.htmlArtifact?.includes('data-artifact="free"'))} softRepair=${softRebindRepair}`,
      }
      m.logReportV4AgentTotal(designerTotal)
      state.recordAgentCost(designerTotal)
      m.logger.info(
        {
          htmlBytes: run.htmlArtifact?.length ?? 0,
          freeArtifact: Boolean(run.htmlArtifact?.includes('data-artifact="free"')),
          iterations: result.iterations,
          softRebindRepair,
        },
        'report_v4.designer_done'
      )

      if (m.artifactHtmlLooksValid(run.htmlArtifact)) {
        if (run.htmlArtifact?.includes('data-artifact="free"')) {
          const hosted = m.countPresentChartHosts(run.htmlArtifact, charts)
          const injectedGuess = Math.max(0, chartCount - hosted)
          if (
            m.freeArtifactTooThinForCharts({
              chartCount,
              injectedCharts: injectedGuess,
              presentHosts: hosted,
            })
          ) {
            m.logger.warn(
              {
                reason: 'thin_free_artifact',
                charts: chartCount,
                presentHosts: hosted,
                injectedGuess,
              },
              'report_v4.designer_fallback_template'
            )
            await recoverTemplateArtifact('thin_free_artifact', state)
          }
        }
      } else {
        const tablesNow = m.collectArtifactTables(run.document).length
        if (chartCount > 0 || tablesNow > 0) {
          m.logger.warn(
            {
              reason: 'designer_ended_without_html',
              charts: chartCount,
              tables: tablesNow,
              softRebindRepair,
            },
            'report_v4.designer_fallback_template'
          )
          await recoverTemplateArtifact('designer_ended_without_html', state)
        }
      }
    }
  } else if (!m.artifactHtmlLooksValid(run.htmlArtifact)) {
    m.logger.warn(
      {
        reason: 'soft_rebind_invalid_html',
        preserveCanvas: true,
        charts: chartCount,
      },
      'report_v4.designer_soft_rebind_invalid'
    )
  }

  await runDesignerPostProcess(state)
}
