import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier, type IntentProvider } from '#services/report_v4/jev_guard'
import { noulScore } from '#utils/jev_answers'
import type { AppLanguage } from '#utils/localize'

export type SoftEditIntentFlags = {
  wantsToc: boolean
  wantsRemove: boolean
  stripEmpty: boolean
  wantsTeamMean: boolean
  enrichExistingCharts: boolean
  restoreSheets: boolean
  addSectionProse: boolean
  layoutRepair: boolean
  residualNeedsAnalyst: boolean
}

const NOUL_TRUE = 0.55

const HAIKU_SYSTEM = [
  'Classify a coach soft-edit ask on an existing staff report canvas.',
  'Respond ONLY with valid JSON (all booleans):',
  '{"wants_toc":false,"wants_remove":false,"strip_empty":false,"wants_team_mean":false,"enrich_existing_charts":false,"restore_sheets":false,"add_section_prose":false,"layout_repair":false,"residual_needs_analyst":false}',
  'wants_toc: add a table of contents / summary page.',
  'wants_remove: delete/remove a section, title, or block from the report.',
  'strip_empty: remove empty/blank charts or sections.',
  'wants_team_mean: overlay team/squad mean on charts.',
  'enrich_existing_charts: add metrics/series INTO existing charts (not brand-new sections).',
  'restore_sheets: restore missing individual athlete sheets/cards.',
  'add_section_prose: add descriptive captions/prose under sections.',
  'layout_repair: fix broken pairing/linking of athletes to charts.',
  'residual_needs_analyst: ask still needs analyst rewrite beyond pure editorial HTML ops.',
].join(' ')

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= NOUL_TRUE
  return false
}

const softEditFlagsFromHaikuJson = (
  raw: Record<string, unknown>
): SoftEditIntentFlags => ({
  wantsToc: boolFromUnknown(raw.wants_toc),
  wantsRemove: boolFromUnknown(raw.wants_remove),
  stripEmpty: boolFromUnknown(raw.strip_empty),
  wantsTeamMean: boolFromUnknown(raw.wants_team_mean),
  enrichExistingCharts: boolFromUnknown(raw.enrich_existing_charts),
  restoreSheets: boolFromUnknown(raw.restore_sheets),
  addSectionProse: boolFromUnknown(raw.add_section_prose),
  layoutRepair: boolFromUnknown(raw.layout_repair),
  residualNeedsAnalyst: boolFromUnknown(raw.residual_needs_analyst),
})

const classifyWithJev = async (
  client: TypeSafeClient,
  prompt: string
): Promise<SoftEditIntentFlags> => {
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      prompt: prompt.slice(0, 3500),
      note: 'Soft-edit flags only. Prefer editorial HTML ops when possible.',
    },
    questions: {
      wants_toc: noul('Does the coach ask to add a table of contents / TOC / summary page?', {
        true: 'Add TOC or contents page',
        false: 'No TOC ask',
      }),
      wants_remove: noul('Does the coach ask to delete or remove a section/block/title?', {
        true: 'Remove/delete a named or empty section',
        false: 'No remove ask',
      }),
      strip_empty: noul('Should empty/blank charts or sections be stripped?', {
        true: 'Strip empty blocks',
        false: 'Keep empty blocks',
      }),
      wants_team_mean: noul('Does the coach want a team/squad mean overlay on charts?', {
        true: 'Team mean overlay',
        false: 'No team mean',
      }),
      enrich_existing_charts: noul(
        'Does the coach ask to add metrics/series INTO existing charts (enrich), not new sections?',
        {
          true: 'Enrich existing charts',
          false: 'Not an enrich-into-existing ask',
        }
      ),
      restore_sheets: noul('Does the coach ask to restore missing individual athlete sheets/cards?', {
        true: 'Restore individual sheets',
        false: 'No restore sheets',
      }),
      add_section_prose: noul('Does the coach ask for descriptive captions/prose under sections?', {
        true: 'Add section prose/captions',
        false: 'No prose ask',
      }),
      layout_repair: noul('Does the coach ask to fix broken athlete↔chart pairing/layout?', {
        true: 'Layout/pairing repair',
        false: 'No layout repair',
      }),
      residual_needs_analyst: noul(
        'Beyond pure HTML editorial ops, does this still need analyst rewrite?',
        {
          true: 'Needs analyst residual work',
          false: 'Editorial/data soft ops suffice',
        }
      ),
    },
  })
  const answers = response.answers as Record<string, unknown>
  return {
    wantsToc: noulScore(answers, 'wants_toc') >= NOUL_TRUE,
    wantsRemove: noulScore(answers, 'wants_remove') >= NOUL_TRUE,
    stripEmpty: noulScore(answers, 'strip_empty') >= NOUL_TRUE,
    wantsTeamMean: noulScore(answers, 'wants_team_mean') >= NOUL_TRUE,
    enrichExistingCharts: noulScore(answers, 'enrich_existing_charts') >= NOUL_TRUE,
    restoreSheets: noulScore(answers, 'restore_sheets') >= NOUL_TRUE,
    addSectionProse: noulScore(answers, 'add_section_prose') >= NOUL_TRUE,
    layoutRepair: noulScore(answers, 'layout_repair') >= NOUL_TRUE,
    residualNeedsAnalyst: noulScore(answers, 'residual_needs_analyst') >= NOUL_TRUE,
  }
}

const classifyWithHaiku = async (prompt: string): Promise<SoftEditIntentFlags> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: HAIKU_SYSTEM,
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return softEditFlagsFromHaikuJson(raw)
}

export const classifySoftEditIntentFlags = async (args: {
  prompt: string
  language?: AppLanguage
}): Promise<{ flags: SoftEditIntentFlags; provider: IntentProvider }> => {
  const { value, provider } = await runIntentClassifier({
    context: 'soft_edit_ops',
    language: args.language,
    jev: (client) => classifyWithJev(client, args.prompt),
    haiku: () => classifyWithHaiku(args.prompt),
  })
  
  return { flags: value, provider }
}
