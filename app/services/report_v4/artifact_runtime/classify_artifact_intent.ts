import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import { choice, noul, type TypeSafeClient } from '#services/jev_service'
import { invokeHaikuJson } from '#services/report_v4/haiku_json'
import { runIntentClassifier, type IntentProvider } from '#services/report_v4/jev_guard'
import { choiceValue, noulScore } from '#utils/jev_answers'
import type { AppLanguage } from '#utils/localize'
import type {
  ArtifactContracts,
  ArtifactDesignOp,
  ArtifactEnvelope,
  ArtifactMode,
  ArtifactVizOp,
  AthleteCoverageKind,
} from '#services/report_v4/artifact_runtime/types'
import { SOFT_ARTIFACT_VIZ_KINDS } from '#services/report_v4/artifact_runtime/types'

export type ArtifactIntentFlags = {
  allAthletes: boolean
  dropEmptyDays: boolean
  wantsThresholds: boolean
  stripVisualMap: boolean
  remapEncode: boolean
  chartAcwr: boolean
  mentionAcwr: boolean
  strengthenTitle: boolean
  accentBand: boolean
  tightenSpacing: boolean
  emphasizeCaptions: boolean
}

const NOUL_TRUE = 0.55

const MARK_LINE_PAIR_RE =
  /\b(?:thresholds?|ref(?:erence)?\s*lines?|mark\s*lines?)[\s:]*((?:\d+[.,]\d+|\d+)(?:\s*(?:and|,|\/|&)\s*(?:\d+[.,]\d+|\d+))+)/i

const LOOSE_PAIR_RE = /\b((?:\d+[.,]\d+|\d+)\s*(?:and|,|\/|&)\s*(?:\d+[.,]\d+|\d+))\b/i

const HAIKU_SYSTEM = [
  'Classify a coach soft-edit ask for a staff sports report canvas.',
  'Respond ONLY with valid JSON matching this schema (all booleans):',
  '{"all_athletes":false,"drop_empty_days":false,"wants_thresholds":false,"strip_visual_map":false,"remap_encode":false,"chart_acwr":false,"mention_acwr":false,"strengthen_title":false,"accent_band":false,"tighten_spacing":false,"emphasize_captions":false}',
  'all_athletes: individual sheets/charts for every roster athlete.',
  'drop_empty_days: remove blank/missing days from curves.',
  'wants_thresholds: add reference/threshold/mark lines (often ACWR 0.6/1.3).',
  'strip_visual_map: hide color scale / visualMap legend.',
  'remap_encode: swap/flip chart axes.',
  'chart_acwr: build/plot a NEW ACWR chart (false if only patching thresholds on existing).',
  'mention_acwr: prompt mentions ACWR / acute:chronic load.',
  'strengthen_title / accent_band / tighten_spacing / emphasize_captions: design polish only.',
].join(' ')

export const parseThresholdNumbers = (prompt: string, wantsThresholds: boolean): number[] => {
  if (!wantsThresholds) return []
  if (/\b0\s*[.,]\s*6\b|\b0\.6\b/.test(prompt) && /\b1\s*[.,]\s*3\b|\b1\.3\b/.test(prompt)) {
    return [0.6, 1.3]
  }
  const hit = prompt.match(MARK_LINE_PAIR_RE)?.[1] ?? prompt.match(LOOSE_PAIR_RE)?.[1] ?? ''
  const nums = [...hit.matchAll(/(\d+[.,]\d+|\d+)/g)]
    .map((m) => Number(String(m[1]).replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100)
  return [...new Set(nums)].slice(0, 4)
}

const boolFromUnknown = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  if (typeof value === 'number') return value >= NOUL_TRUE
  return false
}

export const flagsFromHaikuJson = (raw: Record<string, unknown>): ArtifactIntentFlags => ({
  allAthletes: boolFromUnknown(raw.all_athletes),
  dropEmptyDays: boolFromUnknown(raw.drop_empty_days),
  wantsThresholds: boolFromUnknown(raw.wants_thresholds),
  stripVisualMap: boolFromUnknown(raw.strip_visual_map),
  remapEncode: boolFromUnknown(raw.remap_encode),
  chartAcwr: boolFromUnknown(raw.chart_acwr),
  mentionAcwr: boolFromUnknown(raw.mention_acwr),
  strengthenTitle: boolFromUnknown(raw.strengthen_title),
  accentBand: boolFromUnknown(raw.accent_band),
  tightenSpacing: boolFromUnknown(raw.tighten_spacing),
  emphasizeCaptions: boolFromUnknown(raw.emphasize_captions),
})

const classifyFlagsWithJev = async (
  client: TypeSafeClient,
  prompt: string
): Promise<ArtifactIntentFlags> => {
  const response = await client.systemOne({
    model: JEV_ROUTER_MODEL,
    state: {
      prompt: prompt.slice(0, 3500),
      note: [
        'Soft-edit intent on an existing staff report. Prefer soft patches over rebuild.',
        'chart_acwr true only for a new ACWR chart/plot — false when only thresholds/mark lines on existing ACWR.',
      ].join(' '),
    },
    questions: {
      all_athletes: noul(
        'Does the coach want individual sheets or charts for every athlete on the roster?',
        {
          true: 'All players / each athlete / individually',
          false: 'Team aggregate or named subset only',
        }
      ),
      drop_empty_days: noul('Should empty/blank/missing days be dropped from curves?', {
        true: 'Drop empty days / smoother curves without gaps',
        false: 'Keep calendar days as-is',
      }),
      wants_thresholds: noul('Does the coach ask to add threshold / reference / mark lines?', {
        true: 'Thresholds or mark lines (e.g. 0.6 and 1.3)',
        false: 'No threshold lines',
      }),
      strip_visual_map: noul('Should the color scale / visualMap legend be removed?', {
        true: 'Hide visualMap / color scale',
        false: 'Keep visualMap',
      }),
      remap_encode: noul('Should chart axes be swapped / remapped?', {
        true: 'Swap or flip axes / remap encode',
        false: 'Keep current axes',
      }),
      chart_acwr: noul(
        'Does the coach ask to build or plot a brand-new ACWR chart (not only patch existing)?',
        {
          true: 'New ACWR chart/graph required',
          false: 'No new ACWR chart (soft patch only or unrelated)',
        }
      ),
      mention_acwr: noul('Does the prompt mention ACWR or acute:chronic workload?', {
        true: 'ACWR / acute chronic mentioned',
        false: 'No ACWR mention',
      }),
      design: choice(
        {
          question: 'Which design polish ops apply? Prefer none unless clearly asked.',
          note: 'Pick the single closest design intent; use none when the ask is data/viz only.',
        },
        {
          none: 'No design polish',
          strengthen_title: 'Stronger / bolder titles',
          accent_band: 'Accent or highlight section bands/headers',
          tighten_spacing: 'Tighter spacing / denser layout',
          emphasize_captions: 'Stronger captions / legend text',
          titles_and_spacing: 'Stronger titles AND tighter spacing',
        }
      ),
    },
  })

  const answers = response.answers as Record<string, unknown>
  const design = choiceValue(answers, 'design') ?? 'none'
  return {
    allAthletes: noulScore(answers, 'all_athletes') >= NOUL_TRUE,
    dropEmptyDays: noulScore(answers, 'drop_empty_days') >= NOUL_TRUE,
    wantsThresholds: noulScore(answers, 'wants_thresholds') >= NOUL_TRUE,
    stripVisualMap: noulScore(answers, 'strip_visual_map') >= NOUL_TRUE,
    remapEncode: noulScore(answers, 'remap_encode') >= NOUL_TRUE,
    chartAcwr: noulScore(answers, 'chart_acwr') >= NOUL_TRUE,
    mentionAcwr: noulScore(answers, 'mention_acwr') >= NOUL_TRUE,
    strengthenTitle: design === 'strengthen_title' || design === 'titles_and_spacing',
    accentBand: design === 'accent_band',
    tightenSpacing: design === 'tighten_spacing' || design === 'titles_and_spacing',
    emphasizeCaptions: design === 'emphasize_captions',
  }
}

const classifyFlagsWithHaiku = async (prompt: string): Promise<ArtifactIntentFlags> => {
  const raw = await invokeHaikuJson<Record<string, unknown>>({
    system: HAIKU_SYSTEM,
    user: `Coach ask:\n${prompt.slice(0, 3500)}`,
  })
  return flagsFromHaikuJson(raw)
}

export const classifyArtifactIntentFlags = async (args: {
  prompt: string
  language?: AppLanguage
}): Promise<{ flags: ArtifactIntentFlags; provider: IntentProvider }> => {
  const { value, provider } = await runIntentClassifier({
    context: 'artifact_envelope',
    language: args.language,
    jev: (client) => classifyFlagsWithJev(client, args.prompt),
    haiku: () => classifyFlagsWithHaiku(args.prompt),
  })
  return { flags: value, provider }
}

export const artifactContractsFromIntent = (args: {
  flags: ArtifactIntentFlags
  prompt: string
  rosterNames?: string[]
  namedAthletes?: string[]
  reportShape?: string
}): ArtifactContracts => {
  const { flags, prompt } = args
  const individualFocus = args.reportShape === 'individual_focus'
  const individualSheets = flags.allAthletes || individualFocus
  let athleteCoverage: AthleteCoverageKind = 'team'
  if (flags.allAthletes) athleteCoverage = 'all'
  else if ((args.namedAthletes?.length ?? 0) > 0 || individualFocus) athleteCoverage = 'named'
  const requiredAthletes =
    athleteCoverage === 'all'
      ? [...(args.rosterNames ?? [])]
      : athleteCoverage === 'named'
        ? [...(args.namedAthletes ?? [])]
        : []

  const vizOps: ArtifactVizOp[] = []
  if (flags.dropEmptyDays) vizOps.push({ kind: 'drop_empty_days' })

  const markValues = parseThresholdNumbers(prompt, flags.wantsThresholds)
  const wantsThresholds = flags.wantsThresholds && markValues.length >= 1
  if (wantsThresholds) {
    vizOps.push({
      kind: 'mark_lines',
      values: markValues,
      metricHint: flags.mentionAcwr ? 'acwr' : undefined,
    })
  }
  if (flags.stripVisualMap) vizOps.push({ kind: 'strip_visualMap' })
  if (flags.remapEncode) vizOps.push({ kind: 'remap_encode', mode: 'swap_axes' })

  const designOps: ArtifactDesignOp[] = []
  if (flags.strengthenTitle) designOps.push({ kind: 'strengthen_title' })
  if (flags.accentBand) designOps.push({ kind: 'accent_band' })
  if (flags.tightenSpacing) designOps.push({ kind: 'tighten_spacing' })
  if (flags.emphasizeCaptions) designOps.push({ kind: 'emphasize_captions' })

  const requiredMetrics: string[] = []
  if (flags.mentionAcwr || flags.chartAcwr || (wantsThresholds && flags.mentionAcwr)) {
    requiredMetrics.push('acwr_ewma')
  }

  const thresholdSoftAsk = wantsThresholds && !flags.chartAcwr
  const softPatchAsk =
    !wantsThresholds &&
    vizOps.length > 0 &&
    vizOps.every((op) => SOFT_ARTIFACT_VIZ_KINDS.has(op.kind))
  if (flags.chartAcwr || (flags.mentionAcwr && !thresholdSoftAsk && !softPatchAsk && !wantsThresholds)) {
    if (!vizOps.some((op) => op.kind === 'chart_metric')) {
      vizOps.push({ kind: 'chart_metric', metric: 'acwr_ewma' })
    }
    if (!requiredMetrics.includes('acwr_ewma')) requiredMetrics.push('acwr_ewma')
  }

  const softVizOk =
    vizOps.length === 0 || vizOps.every((op) => SOFT_ARTIFACT_VIZ_KINDS.has(op.kind))
  const softAllowed =
    !individualSheets && !vizOps.some((op) => op.kind === 'chart_metric') && softVizOk

  return {
    athleteCoverage,
    requiredAthletes,
    vizOps,
    designOps,
    requiredMetrics,
    softAllowed,
    individualSheets,
  }
}

const resolveArtifactMode = (contracts: ArtifactContracts): ArtifactMode => {
  if (!contracts.softAllowed) return 'gated_rebuild'
  if (
    contracts.vizOps.some((op) => SOFT_ARTIFACT_VIZ_KINDS.has(op.kind)) ||
    contracts.designOps.length > 0
  ) {
    return 'soft_ops'
  }
  return 'free'
}

export const markLineValuesFromContracts = (contracts: ArtifactContracts): number[] => {
  for (const op of contracts.vizOps) {
    if (op.kind === 'mark_lines') return op.values
  }
  return []
}

export const wantsDropEmptyDays = (contracts: ArtifactContracts): boolean =>
  contracts.vizOps.some((op) => op.kind === 'drop_empty_days')

export const envelopeFromContracts = (contracts: ArtifactContracts): ArtifactEnvelope => ({
  mode: resolveArtifactMode(contracts),
  contracts,
  chartDefaults: {
    dropEmptyDays: wantsDropEmptyDays(contracts),
    markLineValues: markLineValuesFromContracts(contracts),
  },
  coverage: {
    requiredNames: contracts.requiredAthletes,
    individualSheets: contracts.individualSheets,
  },
  harvest: {
    requiredMetrics: contracts.requiredMetrics,
    requireLoadDomain: contracts.requiredMetrics.includes('acwr_ewma'),
  },
})

export const resolveArtifactEnvelopeAsync = async (args: {
  prompt: string
  rosterNames?: string[]
  namedAthletes?: string[]
  language?: AppLanguage
  reportShape?: string
}): Promise<ArtifactEnvelope & { intentProvider: IntentProvider }> => {
  const { flags, provider } = await classifyArtifactIntentFlags({
    prompt: args.prompt,
    language: args.language,
  })
  const contracts = artifactContractsFromIntent({
    flags,
    prompt: args.prompt,
    rosterNames: args.rosterNames,
    namedAthletes: args.namedAthletes,
    reportShape: args.reportShape,
  })
  return { ...envelopeFromContracts(contracts), intentProvider: provider }
}
