import { parseHTML } from 'linkedom'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import type {
  PremiumReportDocument,
  PremiumTextBlock,
  PremiumHeadingBlock,
  PremiumChartBlock,
} from '#contracts/premium_report'

const wrap = (html: string): string =>
  /<html[\s>]/i.test(html) ? html : `<!DOCTYPE html><html><body>${html}</body></html>`

const norm = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const syncDocumentFromFreeDesignerHtml = (
  document: PremiumReportDocument,
  html: string
): PremiumReportDocument => {
  if (!html.trim() || !/data-artifact=["']free-designer["']/i.test(html)) return document
  const { document: dom } = parseHTML(wrap(html))
  const stamped = Array.from(dom.querySelectorAll('[data-block-id]'))
  const seen = new Set<string>()
  const blocks: PremiumReportDocument['blocks'] = []
  for (const el of stamped) {
    const id = el.getAttribute('data-block-id')?.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const tag = el.tagName.toLowerCase()
    const className = el.getAttribute('class') ?? ''
    const text = norm(el.textContent ?? '').slice(0, 400)
    if (tag === 'svg' || /\bchart\b/i.test(className) || el.getAttribute('data-chart')) {
      const chart: PremiumChartBlock = {
        id,
        type: PREMIUM_BLOCK_TYPE.CHART,
        title: text.slice(0, 120) || id,
        option: {},
      }
      blocks.push(chart)
      continue
    }
    if (tag === 'h1' || tag === 'h2' || /\bheadline\b|\bh2\b|\bh3\b/i.test(className)) {
      const heading: PremiumHeadingBlock = {
        id,
        type: PREMIUM_BLOCK_TYPE.HEADING,
        text: text || id,
        level: tag === 'h1' ? 1 : 2,
      }
      blocks.push(heading)
      continue
    }
    if (/\bpage\b/i.test(className)) {
      const heading: PremiumHeadingBlock = {
        id,
        type: PREMIUM_BLOCK_TYPE.HEADING,
        text: text.slice(0, 160) || id,
        level: 2,
      }
      blocks.push(heading)
      continue
    }
    const textBlock: PremiumTextBlock = {
      id,
      type: PREMIUM_BLOCK_TYPE.TEXT,
      text: text || id,
    }
    blocks.push(textBlock)
  }
  if (!blocks.length) return document
  return {
    ...document,
    blocks,
  }
}
