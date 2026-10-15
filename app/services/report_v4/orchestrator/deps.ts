import Club from '#models_pg/club'
import { analyzeRequest } from '#services/report_v4/analyze_request'
import { loadClubSeasons } from '#services/report_v4/club_seasons'
import { resolveFullCoverage } from '#services/report_v4/domain_coverage_probe'
import { resolveReportEditPlan } from '#services/report_v4/edit_route'
import { finalizeMinimalEmptyArtifact } from '#services/report_v4/artifact_html'
import {
  resolveFreshClarify,
  resolveSoftClarify,
} from '#services/report_v4/artifact_runtime/clarify'
import { resolveArtifactEnvelopeAsync } from '#services/report_v4/artifact_runtime/resolve'
import { resolveCoachPromptPolicy } from '#services/report_v4/coach_prompt_policy'
import { loadClubRoster } from '#services/report_v4/roster_macros'
import { routeReportV4 } from '#services/report_v4/report_v4_router'
import { runSoftRebind } from '#services/report_v4/soft_rebind'
import { runPremiumReportAgent } from '#services/premium_report/premium_report_agent'

export type ReportV4OrchestratorDeps = {
  findClub: (clubId: string) => Promise<Club | null>
  analyzeRequest: typeof analyzeRequest
  loadClubSeasons: typeof loadClubSeasons
  loadClubRoster: typeof loadClubRoster
  resolveReportEditPlan: typeof resolveReportEditPlan
  resolveFullCoverage: typeof resolveFullCoverage
  finalizeMinimalEmptyArtifact: typeof finalizeMinimalEmptyArtifact
  resolveCoachPromptPolicy: typeof resolveCoachPromptPolicy
  routeReportV4: typeof routeReportV4
  resolveArtifactEnvelopeAsync: typeof resolveArtifactEnvelopeAsync
  resolveSoftClarify: typeof resolveSoftClarify
  resolveFreshClarify: typeof resolveFreshClarify
  runPremiumReportAgent: typeof runPremiumReportAgent
  runSoftRebind: typeof runSoftRebind
}

export const defaultOrchestratorDeps = (): ReportV4OrchestratorDeps => ({
  findClub: (clubId) => Club.find(clubId),
  analyzeRequest,
  loadClubSeasons,
  loadClubRoster,
  resolveReportEditPlan,
  resolveFullCoverage,
  finalizeMinimalEmptyArtifact,
  resolveCoachPromptPolicy,
  routeReportV4,
  resolveArtifactEnvelopeAsync,
  resolveSoftClarify,
  resolveFreshClarify,
  runPremiumReportAgent,
  runSoftRebind,
})
