import logger from '@adonisjs/core/services/logger'
import {
  PREMIUM_REPORT_SQL_MAX_BYTES,
  PREMIUM_REPORT_SQL_MAX_ROWS,
} from '#constants/premium_report.constants'
import {
  clubMetricCatalog,
  resolveClubMetricCatalogRange,
} from '#services/premium_report/club_metric_catalog'
import { allowedFormulaIds } from '#services/premium_report/tools_data'
import { schemaTitlesForDomains } from '#constants/premium_report_domains'
import type { AgentContext } from '#contracts/agent'
import { createDbTool } from '#services/agent_db_tool'
import { probeRpeSources } from '#services/premium_report/rpe_source_probe'
import {
  loadClubInsightScience,
  formatClubInsightScienceAnalystHint,
  type ClubInsightScience,
} from '#services/report_v4/club_insight_science'
import { logReportV4Banner } from '#services/premium_report/premium_report_log'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { DomainPlan } from '#services/report_v4/orchestrator/steps/resolve_domain_plan'
import type { MainPipelineContext } from '#services/report_v4/orchestrator/types'
import { resolveReportV4RunFlags } from '#services/report_v4/run_flags'

export type CatalogData = {
  catalog: Awaited<ReturnType<typeof clubMetricCatalog>>
  periodKpis: Awaited<ReturnType<typeof clubMetricCatalog>>['periodKpis']
  rpeProbe: Awaited<ReturnType<typeof probeRpeSources>>
  clubInsightScience: ClubInsightScience[]
  clubInsightScienceHint: string
  schemaTitles: string[]
  formulaIds: string[]
  makeDbTool: (envelope: string) => Promise<Awaited<ReturnType<typeof createDbTool>>>
}

export const loadPipelineCatalog = async (
  ctx: MainPipelineContext & { plan: DomainPlan },
  run: ReportV4RunState,
  opts?: { runId?: string }
): Promise<CatalogData> => {
  const { args, framed } = ctx
  const { displayRange, fetchRange, domainRanges, fetchWindows, athleteIds, club } = framed
  const { domains } = ctx.plan

  const schemaTitles = schemaTitlesForDomains(domains)
  const formulaIds = domains.length ? [...allowedFormulaIds(domains)] : []
  const catalogRange = resolveClubMetricCatalogRange({
    displayRange,
    fetchRange,
    domainRanges,
    fetches: fetchWindows,
  })
  const catalogStarted = Date.now()
  logger.info({ clubId: args.clubId, catalogRange }, 'report_v4.club_metric_catalog_start')

  const sqlReferenceDate = (() => {
    const now = new Date()
    const y = now.getUTCFullYear()
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${d}`
  })()
  const context: AgentContext = {
    mode: 'team',
    clubId: args.clubId,
    clubName: club.name,
    athleteIds,
    referenceDate: sqlReferenceDate,
    language: args.language,
  }

  const [catalog, rpeProbe, clubInsightScience] = await Promise.all([
    clubMetricCatalog(args.clubId, catalogRange),
    probeRpeSources({
      clubId: args.clubId,
      from: fetchRange.from,
      to: fetchRange.to,
      athleteIds,
    }),
    loadClubInsightScience({
      clubId: args.clubId,
      dateRange: displayRange,
      limit: 8,
    }).catch((error): ClubInsightScience[] => {
      logger.warn(
        { err: error instanceof Error ? error.message : String(error), clubId: args.clubId },
        'report_v4.club_insight_science_failed'
      )
      return []
    }),
  ])
  const clubInsightScienceHint = formatClubInsightScienceAnalystHint(clubInsightScience) ?? ''
  run.clubInsightScience = clubInsightScience
  logger.info(
    {
      clubId: args.clubId,
      catalogRange,
      durationMs: Date.now() - catalogStarted,
      periodKpis: catalog.periodKpis.length,
      matchKpis: catalog.matchKpis.length,
      rpeFetchTable: rpeProbe.fetchTable,
      rpeSession: rpeProbe.sessionPrimary?.source ?? null,
      rpeBody: rpeProbe.bodyPrimary?.source ?? null,
      clubInsightScience: clubInsightScience.length,
    },
    'report_v4.club_metric_catalog_done'
  )

  const makeDbTool = async (envelope: string) =>
    createDbTool(envelope, context, undefined, {
      seriesOnly: false,
      reportSql: true,
      skipTeamPartition: true,
      maxResultRows: PREMIUM_REPORT_SQL_MAX_ROWS,
      maxResultBytes: PREMIUM_REPORT_SQL_MAX_BYTES,
      useVannaExamples: false,
      forceDomainTitles: schemaTitles,
    })

  const flags = resolveReportV4RunFlags({ language: args.language })
  logReportV4Banner({
    clubName: club.name,
    promptPreview: args.prompt.slice(0, 180),
    displayRange,
    domains,
    freeDesigner: flags.freeDesigner,
    freeDesignerRefs: flags.freeDesignerRefs,
    lang: flags.lang,
    path: flags.freeDesigner ? 'free' : 'classic',
    runId: opts?.runId,
  })

  return {
    catalog,
    periodKpis: catalog.periodKpis,
    rpeProbe,
    clubInsightScience,
    clubInsightScienceHint,
    schemaTitles,
    formulaIds,
    makeDbTool,
  }
}
