import type Club from '#models_pg/club'
import type { PremiumDomain } from '#constants/premium_report_domains'
import type {
  PremiumReportDocument,
  PremiumReportDocumentDraft,
  PremiumReportHistoryTurn,
} from '#contracts/premium_report'
import type { SoftClarifyResult, SoftRunSummary } from '#services/report_v4/artifact_runtime/index'
import type { DomainCoverageReport } from '#services/report_v4/domain_coverage_probe'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ClubSeasonRef } from '#services/report_v4/club_seasons'
import type { SoftCanvasInventory } from '#services/report_v4/soft_canvas_inventory'
import type { PromptFetchSpec, PromptWindows } from '#services/report_v4/prompt_scope'
import type { RosterAthlete } from '#services/report_v4/roster_macros'
import type { ReportV4Route } from '#services/report_v4/report_v4_router'
import type { ReportV4SessionFocus } from '#services/report_v4/session_focus'
import type { ReportV4OrchestratorDeps } from '#services/report_v4/orchestrator/deps'
import type { PremiumReportTokenUsage } from '#services/premium_report/premium_report_log'
import type { PremiumDataset } from '#contracts/premium_report'
import type { ReportBrief } from '#services/report_v4/report_brief'
import type { ReportFact } from '#services/report_v4/report_facts'
import type {
  ReportRunAgentCost,
  ReportRunJournalEntry,
} from '#services/report_v4/run_journal'
import type { ReportV4RunFlags } from '#services/report_v4/run_flags'
import type { AppLanguage } from '#utils/localize'

export type ReportV4OrchestratorArgs = {
  clubId: string
  prompt: string
  language: AppLanguage
  history?: PremiumReportHistoryTurn[]
  sessionFocus?: ReportV4SessionFocus
  document?: PremiumReportDocumentDraft
  html?: string
  designPackId?: string
  onProgress?: (message: string) => void
  signal?: AbortSignal
}

export type ReportV4OrchestratorResult = {
  document: PremiumReportDocument
  message: string
  iterations: number
  usage: PremiumReportTokenUsage
  iterationSecs: number[]
  iterationCosts: number[]
  html: string
  designPack: ReportDesignPack
  route: ReportV4Route
  sessionFocus: ReportV4SessionFocus | null
  coverage: {
    displayRange: { from: string; to: string }
    fetchRange: { from: string; to: string }
    domainRanges: Partial<Record<PremiumDomain, { from: string; to: string }>>
    domains: DomainCoverageReport['domains']
    populatedDomains: string[]
    emptyDomains: string[]
  }
  clarify?: SoftClarifyResult | null
  summary?: SoftRunSummary | null
  pathCostClass?: string
  runId?: string
  flags?: ReportV4RunFlags
  brief?: ReportBrief | null
  facts?: ReportFact[]
  datasets?: PremiumDataset[]
  profile?: unknown
  agentCosts?: ReportRunAgentCost[]
  journal?: ReportRunJournalEntry[]
}

export type FramedAsk = {
  club: Club
  designPackFromPrompt: ReportDesignPack
  designPackExplicit: boolean
  clubSeasons: ClubSeasonRef[]
  clubSeasonsBrief: string
  askDomains: PremiumDomain[]
  periodFollowUp: boolean
  promptWindows: PromptWindows
  multiSectionAsk: boolean
  explicitPeriod: boolean
  earlyFetchDomains: PremiumDomain[]
  inheritedFocusDomains: PremiumDomain[]
  softInventory: SoftCanvasInventory | null
  edit: Awaited<ReturnType<ReportV4OrchestratorDeps['resolveReportEditPlan']>>
  preserveCanvas: boolean
  needsFetch: boolean
  isMicroSoft: boolean
  priorHtml: string | null
  needsFreshArtifact: boolean
  softRebindRepair: boolean
  softEditorialAppliedEarly: boolean
  priorChartCount: number
  displayRange: { from: string; to: string }
  domainRanges: Partial<Record<PremiumDomain, { from: string; to: string }>>
  fetchWindows: PromptFetchSpec[]
  coverRange: { from: string; to: string }
  fetchRange: { from: string; to: string }
  timeRangesBrief: string
  rosterAll: RosterAthlete[]
  clubPostes: string[]
  athleteIds: string[]
}

export type CoverageProbeResult =
  | {
      kind: 'continue'
      coverage: DomainCoverageReport
      framed: FramedAsk
    }
  | {
      kind: 'empty'
      result: ReportV4OrchestratorResult
    }

export type MainPipelineContext = {
  args: ReportV4OrchestratorArgs
  deps: ReportV4OrchestratorDeps
  framed: FramedAsk
  coverage: DomainCoverageReport
  progress: (fr: string, en: string) => void
  plan?: import('#services/report_v4/orchestrator/steps/resolve_domains').DomainPlan
}
