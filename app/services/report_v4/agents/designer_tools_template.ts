import { buildClubHtmlReport, prepareReportV4Document } from '#services/report_v4/club_html_report'
import {
  collectInsightAthleteNames,
  resolveInsightRosterPhotos,
} from '#services/report_v4/roster_macros'
import { stampDataBlockIdsInHtml } from '#services/report_v4/artifact_html'
import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import type { AppLanguage } from '#utils/localize'

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
  const html = buildClubHtmlReport({
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
  return stampDataBlockIdsInHtml(html, document, 'designer')
}
