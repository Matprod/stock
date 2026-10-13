import {
  PREMIUM_CANVAS_ASK,
  PREMIUM_CANVAS_ASK_KINDS,
  type PremiumCanvasAsk,
  type PremiumCanvasAskKind,
} from '#constants/premium_report.constants'
import { choice } from '#services/jev_service'

export const CANVAS_ASK_CRITERIA: Record<PremiumCanvasAskKind, string> = {
  [PREMIUM_CANVAS_ASK.EXPLAIN]:
    'Coach asks why / how existing canvas values relate (math explanation only — no new data or edits).',
  [PREMIUM_CANVAS_ASK.MICRO_EDIT]:
    'Soft edit of existing blocks only: table design/layout, cell colours/heat, units (m↔km), scale, round, rename labels, chart type, series colors, titles, captions, polish, OR trim/rewrite prose inside a block (e.g. remove recommendations but keep risk level / primary concerns) — no new datasets, no whole-block delete.',
  [PREMIUM_CANVAS_ASK.RESHAPE]:
    'Filter / focus / keep series on an existing chart or table, OR add metrics/series INTO existing charts (enrich with energy/soreness/etc. via update_block + datasetId), OR team mean/sum overlay (charts_to_team) — without creating brand-new chart sections.',
  [PREMIUM_CANVAS_ASK.SPLIT]:
    'Split one wide table into several tables by partitioning columns (different metric sets, not a clone).',
  [PREMIUM_CANVAS_ASK.DUPLICATE]:
    'Duplicate/copy an existing chart or table (then optionally edit the copy).',
  [PREMIUM_CANVAS_ASK.REMOVE]:
    'Delete/remove one or more ENTIRE blocks/sections from the canvas. NOT for trimming sentences or subsections inside a fiche while keeping the rest — that is MICRO_EDIT.',
  [PREMIUM_CANVAS_ASK.NEW_VIZ]:
    'Add charts/tables, fetch new metrics, or append a new analysis section (including a scoped extra date window like "seulement du 15 au 22") while keeping the existing report — needs macros or new viz tools. Not a full wipe unless the coach asks to rebuild/replace the whole report.',
  [PREMIUM_CANVAS_ASK.NONE]: 'Greeting, acknowledgment, or no canvas action required.',
}

export const isCanvasAskKind = (value: string): value is PremiumCanvasAskKind =>
  (PREMIUM_CANVAS_ASK_KINDS as readonly string[]).includes(value)

export const mustUseToolsForCanvasAsk = (ask: PremiumCanvasAsk): boolean =>
  ask.kind !== PREMIUM_CANVAS_ASK.EXPLAIN && ask.kind !== PREMIUM_CANVAS_ASK.NONE

export const isCanvasExplain = (ask: PremiumCanvasAsk): boolean =>
  ask.kind === PREMIUM_CANVAS_ASK.EXPLAIN

export const resolveCanvasAskKind = (
  picked: string | undefined,
  fallback: PremiumCanvasAskKind
): PremiumCanvasAskKind => (picked && isCanvasAskKind(picked) ? picked : fallback)

export const canvasAskFromChoiceAnswer = (
  answer: { choice?: string; confidence?: number } | undefined,
  fallback: PremiumCanvasAskKind,
  provider: PremiumCanvasAsk['provider'] = 'jev'
): PremiumCanvasAsk => ({
  kind: resolveCanvasAskKind(answer?.choice, fallback),
  provider,
  score: answer?.confidence,
})

export const heuristicCanvasAsk = (
  hasExistingCanvas: boolean,
  existingKind: PremiumCanvasAskKind = PREMIUM_CANVAS_ASK.NONE
): PremiumCanvasAsk => ({
  kind: hasExistingCanvas ? existingKind : PREMIUM_CANVAS_ASK.NEW_VIZ,
  provider: 'heuristic',
})

export const buildCanvasAskChoice = (question: string) =>
  choice(
    {
      question,
      note: 'Pick exactly one option.',
    },
    CANVAS_ASK_CRITERIA
  )

export const resolveCanvasAsk = (
  answers: Record<string, unknown>,
  key: string,
  fallback: PremiumCanvasAskKind,
  provider: PremiumCanvasAsk['provider'] = 'jev'
): PremiumCanvasAsk =>
  canvasAskFromChoiceAnswer(
    answers[key] as { choice?: string; confidence?: number } | undefined,
    fallback,
    provider
  )
