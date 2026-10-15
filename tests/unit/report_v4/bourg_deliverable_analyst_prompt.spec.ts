import { test } from '@japa/runner'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { PREMIUM_DOMAIN } from '#constants/premium_report_domains'
import { defaultPremiumIntent } from '#constants/premium_report_intent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { createPremiumDocumentTools } from '#services/premium_report/tools_document'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import {
  buildAnalystSystemRun,
  buildAnalystSystemStable,
} from '#services/report_v4/agents/agent_prompts'
import {
  COACH_LOAD_FLAG,
  COACH_REPORT_SHAPE,
  type CoachPromptPolicy,
} from '#services/report_v4/coach_policy_heuristic'
import { createAthleteSheetsTools } from '#services/report_v4/athlete_sheets'
import { skippedReportV4Route } from '#services/report_v4/report_v4_router'
import type { RosterAthlete } from '#services/report_v4/roster_macros'

const SHEETS_PREBUILT_STRIP_TOOL_NAMES = new Set([
  'add_chart',
  'add_heading',
  'add_table',
  'remove_block',
])

const stubState = (): PremiumReportState => ({
  document: emptyPremiumDocument({ from: '2026-10-07', to: '2026-10-14' }, []),
  datasets: new Map(),
  defaultAfter: 'end',
  dateRange: { from: '2026-10-07', to: '2026-10-14' },
  clubId: 'club-bourg',
  athleteIds: [],
  language: 'fr',
  sqlFailures: new Map(),
  blockSql: false,
  toolHistory: [],
  harvestTried: [],
  jevValidations: 0,
  jevBlocked: 0,
  requestPrompt: 'fiches individuelles',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
})

const roster: RosterAthlete[] = [
  { id: 'a1', name: 'Ada', position: 'CM', photoUrl: null, photoKey: null },
]

const individualPolicy = (): CoachPromptPolicy => ({
  excludedDomains: [],
  preferredDomains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.WELLNESS],
  reportShape: COACH_REPORT_SHAPE.INDIVIDUAL_FOCUS,
  loadFlag: COACH_LOAD_FLAG.NONE,
  wantsVald: false,
  wantsMatch: false,
  wantsAvailability: false,
  allowWellnessInference: true,
  allowNutritionScope: false,
  flagsAreDescriptiveOnly: true,
  sectionOrder: [],
  monitoringPlaybook: false,
  acwrWatchlist: false,
  provider: 'haiku',
  monitoringPlaybookReason: 'bourg-test',
})

const toolNamesForPrebuiltSheets = (state: PremiumReportState): Set<string> => {
  const docTools = createPremiumDocumentTools(state).filter(
    (tool) => !SHEETS_PREBUILT_STRIP_TOOL_NAMES.has(tool.schema.name)
  )
  const sheetTools = createAthleteSheetsTools({
    state,
    roster,
    requiredAthletes: ['Ada'],
    domains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.WELLNESS],
    metrics: [],
  })
  return new Set([...docTools, ...sheetTools].map((tool) => tool.schema.name))
}

test.group('Bourg deliverable A — analyst prompt vs tools (prebuilt sheets)', () => {
  test('prebuilt sheets profile: tool mentions match actual tool list', ({ assert }) => {
    const state = stubState()
    const tools = toolNamesForPrebuiltSheets(state)
    const prompt = [
      buildAnalystSystemStable({ sheetsPrebuilt: true }),
      buildAnalystSystemRun({
        clubId: 'club-bourg',
        clubName: 'Bourg-En-Bresse',
        displayRange: { from: '2026-10-07', to: '2026-10-14' },
        domains: [PREMIUM_DOMAIN.GPS, PREMIUM_DOMAIN.WELLNESS],
        route: skippedReportV4Route(),
        language: 'fr',
        policy: individualPolicy(),
        clubPostes: ['CM'],
        namedAthletes: ['Ada'],
        coachPrompt: 'Fiches individuelles pour chaque joueur',
        sheetsPrebuilt: true,
      }),
    ].join('\n')

    assert.isTrue(tools.has('add_sheet_comments'))
    assert.isTrue(tools.has('commit_report_brief') || /commit_report_brief/.test(prompt))

    assert.isFalse(
      tools.has('remove_block'),
      'prebuilt sheets: canvas blocks locked — remove_block must not be exposed'
    )
    assert.isFalse(tools.has('add_heading'))
    assert.isFalse(tools.has('add_chart'))

    assert.notMatch(
      prompt,
      /\badd_heading\b|\badd_chart\b/,
      'prompt must not mention tools absent from the prebuilt-sheets tool list'
    )
    assert.match(prompt, /add_sheet_comments/)
    assert.notMatch(
      prompt,
      /\bremove_block\b/,
      'prompt must not invite remove_block when sheets are prebuilt and blocks are locked'
    )
  })
})
