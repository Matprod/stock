import { Exception } from '@adonisjs/core/exceptions'
import logger from '@adonisjs/core/services/logger'
import Athlete from '#models_pg/athlete'
import Club from '#models_pg/club'
import {
  PREMIUM_BLOCK_TYPE,
  PREMIUM_REPORT_HISTORY_MAX,
  PREMIUM_REPORT_MAX_ITERATIONS,
  PREMIUM_REPORT_SQL_MAX_BYTES,
  PREMIUM_REPORT_SQL_MAX_ROWS,
} from '#constants/premium_report.constants'
import { schemaTitlesForDomains } from '#constants/premium_report_domains'
import { clubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import type {
  PremiumReportDocumentDraft,
  PremiumReportGenerateInput,
  PremiumReportGenerateResult,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import PremiumReportStore from '#services/premium_report_store'
import type { AgentContext } from '#contracts/agent'
import { createDbTool } from '#services/agent_db_tool'
import { formulaCatalogForLlm } from '#services/report_builder/chatbot/formula_llm'
import {
  clonePremiumDocument,
  compactPremiumDocument,
  emptyPremiumDocument,
  sanitizeIncomingDocument,
} from '#services/premium_report/premium_report_document'
import { runPremiumReportAgent, emptyUsage } from '#services/premium_report/premium_report_agent'
import { createPremiumDataTools, allowedFormulaIds } from '#services/premium_report/tools_data'
import { createPremiumMacroTools } from '#services/premium_report/tools_macros'
import { loadPremiumReportPrompt } from '#services/premium_report/premium_report_prompt'
import { buildPremiumReportPdf } from '#services/premium_report/premium_report_pdf'
import {
  wrapQueryTool,
  type PremiumReportState,
} from '#services/premium_report/premium_report_tools'
import { createPremiumDocumentTools } from '#services/premium_report/tools_document'
import { resolvePromptDateRange } from '#services/premium_report/prompt_date_range'
import { routePremiumReport } from '#services/premium_report/premium_report_router'
import {
  isSparseCoverage,
  probePremiumCoverage,
  sparseDataMessage,
} from '#services/premium_report/premium_report_coverage'
import {
  elapsedSec,
  logPremiumDone,
  logPremiumPretty,
  logPremiumSparse,
  logPremiumStart,
} from '#services/premium_report/premium_report_log'
import type { ReportPdfFile } from '#services/report_builder/pdf/pdf_renderer'
import type { AppLanguage } from '#utils/localize'

export default class PremiumReportService {
  private store = new PremiumReportStore()

  async generate(
    clubId: string,
    input: PremiumReportGenerateInput,
    language: AppLanguage
  ): Promise<PremiumReportGenerateResult> {
    const started = Date.now()
    const club = await Club.find(clubId)
    if (!club) throw new Exception('Club not found', { status: 404 })

    const saved = input.reportId ? await this.store.get(clubId, input.reportId) : null
    const incomingDocument = input.document ?? saved?.document
    const priorHistory = input.history ?? saved?.history ?? []

    const athleteIds = await resolveAthleteIds(
      clubId,
      input.athleteIds ?? incomingDocument?.athleteIds
    )
    const dateRange = resolvePromptDateRange(input.prompt, input.dateRange)
    const document = incomingDocument
      ? sanitizeIncomingDocument(incomingDocument, dateRange, language)
      : emptyPremiumDocument(dateRange, athleteIds)
    document.dateRange = { from: dateRange.from, to: dateRange.to }
    if (athleteIds.length) document.athleteIds = athleteIds

    const scopedAthleteIds = athleteIds.length > 0 ? athleteIds : await loadAllAthleteIds(clubId)

    const coverage = await probePremiumCoverage({
      clubId,
      dateRange,
      athleteIds: scopedAthleteIds,
    })
    if (isSparseCoverage(coverage)) {
      logPremiumSparse({ ...coverage, dateRange })
      logPremiumDone({
        iterations: 0,
        durationSec: elapsedSec(started),
        usage: emptyUsage(),
        blockCount: document.blocks.length,
        datasetCount: 0,
      })
      const sparseMessage = sparseDataMessage(language, coverage, dateRange)
      const reportId = await this.persistSaved(clubId, saved?.id, {
        document,
        prompt: input.prompt,
        message: sparseMessage,
        priorHistory,
      })
      return {
        document,
        message: sparseMessage,
        iterations: 0,
        ...(reportId ? { reportId } : {}),
      }
    }

    const athletes = await loadAthleteNames(clubId, scopedAthleteIds)

    const route = await routePremiumReport({
      prompt: input.prompt,
      hasExistingCanvas: document.blocks.length > 0,
    })
    logPremiumPretty('route', {
      domains: route.domains,
      correlation: route.correlation,
      canvasAsk: route.canvasAsk.kind,
      intent: route.intent,
      valdTestTypes: route.valdTestTypes,
      mustUseTools: route.mustUseTools,
      provider: route.provider,
      domainScores: route.domainScores,
    })
    const domains = route.domains
    const canvasAsk = route.canvasAsk
    const schemaTitles = schemaTitlesForDomains(domains)
    const formulaIds = domains.length ? [...allowedFormulaIds(domains)] : []
    const catalog = await clubMetricCatalog(clubId)
    const periodKpis = catalog.periodKpis
    const whitelistNote = `Period metrics: club catalogue (${periodKpis.length} pm.name). Macro columns: ${periodKpis.map((k) => k.alias).join(', ') || 'none'}. Use only these names — never invent pm.name.`

    const systemPrompt = `${await loadPremiumReportPrompt(clubId)}

Report for ${club.name} only (club_id '${club.id}'), ${dateRange.from} → ${dateRange.to}. Domains: ${domains.join(', ')}${route.correlation ? ' · correlation' : ''}.
${whitelistNote}
Prefer macros / aggregate_dataset over free SQL. Never Foster/ACWR/zscore in SQL. Follow injected \`route\` only.
${route.valdTestTypes?.length ? `VALD filter: testTypes=${JSON.stringify(route.valdTestTypes)} on fetch_vald_tests.` : ''}`

    const beforeSnap = JSON.stringify(document.blocks)
    const state: PremiumReportState = {
      document: clonePremiumDocument(document),
      datasets: new Map(),
      defaultAfter: route.intent.insertAtTop ? 'start' : 'end',
      dateRange: { from: dateRange.from, to: dateRange.to },
      clubId,
      athleteIds,
      language,
      sqlFailures: new Map(),
      blockSql: false,
      toolHistory: [],
      jevValidations: 0,
      jevBlocked: 0,
      requestPrompt: input.prompt,
      canvasAsk,
      intent: route.intent,
      ...(route.valdTestTypes?.length ? { valdTestTypes: route.valdTestTypes } : {}),
      mustUseTools: route.mustUseTools,
      explanationAsk: route.explanationAsk,
      templateMetaCache: new Map(),
    }

    const context: AgentContext = {
      mode: 'team',
      clubId,
      clubName: club.name,
      athleteIds: scopedAthleteIds,
      referenceDate: dateRange.to,
      language,
    }
    const dbTool = await createDbTool(input.prompt, context, undefined, {
      seriesOnly: false,
      reportSql: true,
      skipTeamPartition: true,
      maxResultRows: PREMIUM_REPORT_SQL_MAX_ROWS,
      maxResultBytes: PREMIUM_REPORT_SQL_MAX_BYTES,
      useVannaExamples: false,
      forceDomainTitles: schemaTitles,
    })
    const runSql = async (sql: string) => dbTool.execute({ sql })
    const tools = [
      wrapQueryTool(dbTool, state),
      ...createPremiumMacroTools({ state, runSql, domains }),
      ...createPremiumDataTools(state, { domains }),
      ...createPremiumDocumentTools(state),
    ]

    logPremiumStart({
      clubId,
      domains,
      athleteCount: scopedAthleteIds.length,
      toolCount: tools.length,
      promptPreview: input.prompt.slice(0, 160),
    })

    const userPrompt = JSON.stringify({
      language,
      club: { id: club.id, name: club.name },
      dateRange,
      athletes,
      domains,
      correlation: route.correlation,
      route: {
        canvasAsk: route.canvasAsk.kind,
        intent: route.intent,
        valdTestTypes: route.valdTestTypes,
        mustUseTools: route.mustUseTools,
        explanationAsk: route.explanationAsk,
        correlation: route.correlation,
      },
      periodMetricWhitelist: periodKpis.map((k) => k.name),
      gpsMacroColumns: periodKpis.map((k) => k.alias),
      playerLoadSources: [],
      athleteScope:
        athleteIds.length > 0
          ? `listed athletes only — a.id IN (...) AND a.club_id = '${club.id}'`
          : `whole club — a.club_id = '${club.id}'`,
      rosterNote: 'ONLY these athletes belong to this club.',
      formulas: formulaCatalogForLlm({ formulaIds }),
      current: compactPremiumDocument(state.document),
      insert: route.intent.insertAtTop
        ? 'Place NEW blocks at the top (after=start then chain).'
        : 'Append NEW blocks at the end unless after is set.',
      request: input.prompt,
    })

    try {
      const history = priorHistory.slice(-PREMIUM_REPORT_HISTORY_MAX)
      const result = await runPremiumReportAgent({
        systemPrompt,
        userPrompt,
        history,
        tools,
        state,
      })

      if (!state.document.title.trim()) {
        state.document.title = input.prompt.replace(/\s+/g, ' ').trim().slice(0, 80)
      }

      const nextDocument = sanitizeIncomingDocument(state.document, dateRange, language)
      const changed = JSON.stringify(nextDocument.blocks) !== beforeSnap
      const message = !changed
        ? state.mustUseTools
          ? canvasUnchangedMessage(language, state.toolHistory.length > 0)
          : result.message.trim() || canvasUnchangedMessage(language, false)
        : result.message

      let sqlErrors = 0
      for (const n of state.sqlFailures.values()) sqlErrors += n
      logPremiumDone({
        iterations: result.iterations,
        durationSec: elapsedSec(started),
        usage: result.usage,
        blockCount: nextDocument.blocks.length,
        chartCount: nextDocument.blocks.filter((b) => b.type === PREMIUM_BLOCK_TYPE.CHART).length,
        datasetCount: state.datasets.size,
        blockSql: state.blockSql,
        maxIterations: result.iterations >= PREMIUM_REPORT_MAX_ITERATIONS,
        sqlErrors,
        jevValidations: state.jevValidations,
        jevBlocked: state.jevBlocked,
      })

      const reportId = await this.persistSaved(clubId, saved?.id, {
        document: nextDocument,
        prompt: input.prompt,
        message,
        priorHistory,
      })

      return {
        document: nextDocument,
        message,
        iterations: result.iterations,
        ...(reportId ? { reportId } : {}),
      }
    } catch (error) {
      logger.error(
        {
          err: error,
          clubId,
          durationSec: Number(((Date.now() - started) / 1000).toFixed(3)),
        },
        'premium_report.generate_failed'
      )
      throw error
    }
  }

  async exportPdf(
    clubId: string,
    document: PremiumReportDocumentDraft,
    language: AppLanguage
  ): Promise<ReportPdfFile> {
    const club = await Club.find(clubId)
    if (!club) throw new Exception('Club not found', { status: 404 })
    const sanitized = sanitizeIncomingDocument(document, document.dateRange, language)
    return buildPremiumReportPdf({
      document: sanitized,
      clubName: club.name,
      language,
    })
  }

  private async persistSaved(
    clubId: string,
    reportId: string | undefined,
    args: {
      document: PremiumReportGenerateResult['document']
      prompt: string
      message: string
      priorHistory: PremiumReportHistoryTurn[]
    }
  ): Promise<string | undefined> {
    if (!reportId) return undefined
    const saved = await this.store.update(clubId, reportId, {
      document: args.document,
      history: [
        ...args.priorHistory,
        { role: 'user' as const, content: args.prompt },
        { role: 'assistant' as const, content: args.message },
      ].slice(-PREMIUM_REPORT_HISTORY_MAX),
    })
    return saved.id
  }
}

const clubAthleteIds = async (clubId: string, only?: string[]): Promise<string[]> => {
  const query = Athlete.query().where('clubId', clubId).select('id')
  if (only?.length) query.whereIn('id', only)
  return (await query).map((row) => row.id)
}

const resolveAthleteIds = async (clubId: string, requested?: string[]): Promise<string[]> =>
  requested?.length ? clubAthleteIds(clubId, requested) : []

const loadAllAthleteIds = async (clubId: string): Promise<string[]> => clubAthleteIds(clubId)

const loadAthleteNames = async (
  clubId: string,
  athleteIds: string[]
): Promise<Array<{ id: string; name: string }>> => {
  if (athleteIds.length === 0) return []
  const rows = await Athlete.query()
    .where('clubId', clubId)
    .whereIn('id', athleteIds)
    .select('id', 'firstName', 'lastName')
  return rows.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.replace(/\s+/g, ' ').trim(),
  }))
}

const canvasUnchangedMessage = (language: AppLanguage, hadTools: boolean): string => {
  if (language === 'fr') {
    return hadTools
      ? 'Aucun bloc ajouté au canvas (les outils n’ont pas modifié le rapport). Relance la demande.'
      : 'Aucun outil appelé : rien n’a été ajouté au canvas. Relance pour générer le graphique.'
  }
  return hadTools
    ? 'No canvas blocks were added (tools did not change the report). Retry the request.'
    : 'No tools were called, so nothing was added to the canvas. Retry to generate the chart.'
}
