import logger from '@adonisjs/core/services/logger'
import { PREMIUM_DOMAIN_NOUL_THRESHOLD } from '#constants/premium_report_domains'
import { JEV_ROUTER_MODEL } from '#constants/question_router.constants'
import type { PremiumReportBlock } from '#contracts/premium_report'
import {
  canvasAthleteNames,
  captionUnknownAthletes,
} from '#services/premium_report/canvas_athletes'
import { elapsedSec, logPremiumJev } from '#services/premium_report/premium_report_log'
import JevService, { noul } from '#services/jev_service'

const CAPTION_ANSWER_KEY = 'needsCaption'

const PREMIUM_TEXT_CAPTION_JEV = {
  question:
    'Does `caption` add useful staff insight for `request` given `nearbyTitle`, `nearbyMetrics`, and `canvasAthletes`? Reject filler, title restatements, markdown, athletes not in `canvasAthletes`, and metrics not in `nearbyMetrics`.',
  trueLabel: 'Useful grounded caption',
  falseLabel: 'Skip — filler or ungrounded',
} as const

export type JevTextCaptionJudgment = {
  allow: boolean
  score: number
}

const nearbyLabel = (block: PremiumReportBlock | undefined): string => {
  if (!block) return ''
  if (block.type === 'heading' || block.type === 'text') return block.text.slice(0, 120)
  if (block.type === 'chart') return block.title.slice(0, 120)
  if (block.type === 'table') return (block.title ?? '').slice(0, 120)
  return ''
}

const nearbyMetrics = (block: PremiumReportBlock | undefined): string => {
  if (!block) return ''
  if (block.type === 'table') return block.columns.join(', ').slice(0, 300)
  if (block.type !== 'chart') return ''
  const parts: string[] = []
  const series = Array.isArray(block.option.series) ? block.option.series : []
  for (const item of series) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const name = (item as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) parts.push(name.trim())
  }
  const dataset = block.option.dataset
  if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
    const source = (dataset as { source?: unknown }).source
    if (Array.isArray(source) && Array.isArray(source[0])) {
      for (const cell of source[0] as unknown[]) {
        const name = String(cell ?? '').trim()
        if (name) parts.push(name)
      }
    }
  }
  return [...new Set(parts)].join(', ').slice(0, 300)
}

export const jevTextCaption = async (args: {
  request: string
  caption: string
  blocks: PremiumReportBlock[]
  afterId?: string
  lastInsertedId?: string
}): Promise<JevTextCaptionJudgment> => {
  const started = Date.now()
  const caption = args.caption.trim()
  const detail = `caption="${caption.slice(0, 80).replace(/\s+/g, ' ')}"`

  if (caption.length < 12) {
    logPremiumJev({
      kind: 'text_caption',
      durationSec: elapsedSec(started),
      ok: false,
      decision: 'reject',
      score: 0,
      provider: 'heuristic',
      detail: `${detail} too-short`,
    })
    return { allow: false, score: 0 }
  }

  const athletes = canvasAthleteNames(args.blocks)
  const unknown = captionUnknownAthletes(caption, athletes)
  if (unknown.length > 0) {
    logPremiumJev({
      kind: 'text_caption',
      durationSec: elapsedSec(started),
      ok: false,
      decision: 'reject',
      score: 0,
      provider: 'heuristic',
      detail: `${detail} unknown-athletes=${unknown.join(',')}`,
    })
    return { allow: false, score: 0 }
  }

  const anchorId = args.afterId || args.lastInsertedId
  const nearby = anchorId
    ? args.blocks.find((block) => block.id === anchorId)
    : args.blocks[args.blocks.length - 1]
  const metrics = nearbyMetrics(nearby)

  const client = JevService.getClient()
  if (!client) {
    logPremiumJev({
      kind: 'text_caption',
      durationSec: elapsedSec(started),
      ok: true,
      decision: 'allow',
      score: 1,
      provider: 'skip',
      detail: `${detail} no-client`,
    })
    return { allow: true, score: 1 }
  }

  try {
    const response = await client.systemOne({
      model: JEV_ROUTER_MODEL,
      state: {
        request: args.request.slice(0, 500),
        caption: caption.slice(0, 800),
        nearbyTitle: nearbyLabel(nearby),
        nearbyMetrics: metrics || '(none)',
        canvasAthletes: athletes.slice(0, 40).join(', ').slice(0, 500) || '(none on canvas)',
      },
      questions: {
        [CAPTION_ANSWER_KEY]: noul(PREMIUM_TEXT_CAPTION_JEV.question, {
          true: PREMIUM_TEXT_CAPTION_JEV.trueLabel,
          false: PREMIUM_TEXT_CAPTION_JEV.falseLabel,
        }),
      },
    })
    const score =
      (response.answers[CAPTION_ANSWER_KEY] as { noul?: number } | undefined)?.noul ?? 0
    const allow = score >= PREMIUM_DOMAIN_NOUL_THRESHOLD
    logPremiumJev({
      kind: 'text_caption',
      durationSec: elapsedSec(started),
      ok: allow,
      decision: allow ? 'allow' : 'reject',
      score,
      provider: 'jev',
      detail: `${detail} near="${nearbyLabel(nearby).slice(0, 40)}" athletes=${athletes.length}`,
    })
    return { allow, score }
  } catch (error) {
    logger.warn({ err: error }, 'premium_report.text_caption_jev_failed')
    logPremiumJev({
      kind: 'text_caption',
      durationSec: elapsedSec(started),
      ok: true,
      decision: 'allow',
      score: 1,
      provider: 'fallback',
      detail: `${detail} error`,
    })
    return { allow: true, score: 1 }
  }
}
