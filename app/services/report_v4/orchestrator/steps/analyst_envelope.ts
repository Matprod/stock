import * as m from '#services/report_v4/orchestrator/main_pipeline_bindings'
import type { PipelineState } from '#services/report_v4/orchestrator/pipeline_state'
import { mapPresentPlayersByDataset } from '#services/report_v4/present_players'
import { projectFactsForDesign } from '#services/report_v4/report_facts'

export const buildAnalystSystemParts = (params: {
  state: PipelineState
  preserveCanvas: boolean
  layoutRepairSoft: boolean
  additiveSoft: boolean
  sheetsPrebuilt?: boolean
}): { systemStable: string; systemRun: string } => {
  const { state, preserveCanvas, layoutRepairSoft, additiveSoft, sheetsPrebuilt } = params
  const { ctx, subjectiveScalesLine, catalog, periodKpis, clubInsightScienceHint, dataProfileHint } =
    state
  const { args, framed, plan: planRaw } = ctx
  const { club, clubPostes, displayRange, multiSectionAsk } = framed
  const { policy, route, domains, softOps, softAllowBlockIds, namedAthletes } = planRaw
  if (preserveCanvas) {
    const softArgs = {
      clubName: club.name,
      language: args.language,
      clubPostes,
      displayRange,
      allowNutritionScope: policy.allowNutritionScope,
      additive: additiveSoft,
      restoreSheets: Boolean(softOps?.restoreSheets),
      addSectionProse: Boolean(softOps?.addSectionProse),
      layoutRepair: layoutRepairSoft,
      wantsTeamMean: Boolean(softOps?.wantsTeamMean),
      enrichExistingCharts: Boolean(softOps?.enrichExistingCharts),
      targetsUnresolved: Boolean(softAllowBlockIds && softAllowBlockIds.size === 0),
      subjectiveScalesLine: subjectiveScalesLine || undefined,
    }
    return {
      systemStable: m.buildSoftAnalystSystemStable(softArgs),
      systemRun: m.buildSoftAnalystSystemRun(softArgs),
    }
  }
  const runArgs = {
    clubId: args.clubId,
    clubName: club.name,
    displayRange,
    domains,
    route,
    language: args.language,
    policy,
    clubPostes,
    periodKpis,
    catalog,
    coachPrompt: args.prompt,
    multiSection: multiSectionAsk,
    dataProfileHint,
    clubInsightScienceHint,
    subjectiveScalesLine: subjectiveScalesLine || undefined,
    namedAthletes,
    sheetsPrebuilt: Boolean(sheetsPrebuilt),
  }
  return {
    systemStable: m.buildAnalystSystemStable({ sheetsPrebuilt: Boolean(sheetsPrebuilt) }),
    systemRun: m.buildAnalystSystemRun(runArgs),
  }
}

export const buildAnalystSystemPrompt = (params: {
  state: PipelineState
  preserveCanvas: boolean
  layoutRepairSoft: boolean
  additiveSoft: boolean
}): string => {
  const parts = buildAnalystSystemParts(params)
  return `${parts.systemStable}\n\n${parts.systemRun}`
}

export const buildAnalystUserPrompt = (params: {
  state: PipelineState
  envelope: string
  preserveCanvas: boolean
  isMicroSoft: boolean
  softContextPacket: Record<string, unknown> | null
}): string => {
  const { state, envelope, preserveCanvas, isMicroSoft, softContextPacket } = params
  const {
    ctx,
    agentState,
    wellnessCatalogue,
    subjectiveScalesLine,
    athletes,
    clubInsightScience,
    dataProfilePacket,
  } = state
  const { args, framed, plan: planRaw } = ctx
  const { clubPostes, displayRange, edit } = framed
  const { policy, route, domains, artifactEnvelope, namedAthletes, daySpan } = planRaw
  const presentPlayers = mapPresentPlayersByDataset(agentState.datasets.values())
  const askFacts = projectFactsForDesign(state.run.facts.values())
  return JSON.stringify(
    isMicroSoft
      ? {
          stage: 'analyst_soft_micro',
          coach: args.prompt.trim(),
          canvasAsk: edit.canvasAsk.kind,
          clubPostes,
          displayRange,
          allowNutritionScope: policy.allowNutritionScope,
          ...softContextPacket,
          current: m.compactPremiumDocument(agentState.document),
          presentPlayers,
          ...(askFacts.length ? { facts: askFacts } : {}),
          ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
          ...(clubInsightScience.length
            ? {
                clubInsightScience: clubInsightScience.slice(0, 5).map((row) => ({
                  name: row.name,
                  description: row.description.slice(0, 160),
                  meanAbsImportance: row.meanAbsImportance,
                })),
              }
            : {}),
          ...(namedAthletes.length ? { namedAthletes } : {}),
          ...(subjectiveScalesLine
            ? { subjectiveScales: m.projectWellnessScalesForDesigner(wellnessCatalogue) }
            : {}),
        }
      : {
          stage: preserveCanvas ? 'analyst_soft' : 'analyst',
          athletes,
          clubPostes,
          domains,
          excludedDomains: policy.excludedDomains,
          monitoringPlaybook: policy.monitoringPlaybook,
          datasets: m.catalogDatasets(agentState),
          presentPlayers,
          ...(askFacts.length ? { facts: askFacts } : {}),
          formulas: m.formulaCatalogForLlm({ formulaIds: state.formulaIds }),
          current: m.compactPremiumDocument(agentState.document),
          ...(softContextPacket ?? {}),
          ...(namedAthletes.length ? { namedAthletes } : {}),
          ...(clubInsightScience.length
            ? {
                clubInsightScience: clubInsightScience.slice(0, 5).map((row) => ({
                  name: row.name,
                  description: row.description.slice(0, 160),
                  meanAbsImportance: row.meanAbsImportance,
                })),
              }
            : {}),
          grain: route.grain,
          analysisDepth: route.analysisDepth,
          daySpan,
          softEdit: preserveCanvas,
          artifact: m.analystPacketFromEnvelope(artifactEnvelope),
          request: envelope,
          ...(dataProfilePacket ? { dataProfile: dataProfilePacket } : {}),
          ...(subjectiveScalesLine
            ? { subjectiveScales: m.projectWellnessScalesForDesigner(wellnessCatalogue) }
            : {}),
        }
  )
}
