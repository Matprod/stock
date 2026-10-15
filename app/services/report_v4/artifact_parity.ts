import { parseHTML } from 'linkedom'
import type { PremiumReportDocument } from '#contracts/premium_report'

export type BlockOrigin = 'generate' | 'soft_edit' | 'designer' | 'template'

type ArtifactParityIssue = {
  kind: 'missing_block' | 'order' | 'text_mismatch' | 'missing_chart_host' | 'missing_origin'
  blockId?: string
  detail: string
}

type ArtifactParityResult = {
  ok: boolean
  issues: ArtifactParityIssue[]
  documentBlockCount: number
  htmlBlockCount: number
}

const norm = (value: string): string => value.replace(/\s+/g, ' ').trim()

const cssAttrEscape = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const chartHostId = (blockId: string): string => `chart_${blockId.replace(/-/g, '')}`

const wrap = (html: string): string =>
  /<html[\s>]/i.test(html) ? html : `<!DOCTYPE html><html><body>${html}</body></html>`

export const evaluateArtifactParity = (
  document: PremiumReportDocument,
  html: string
): ArtifactParityResult => {
  const issues: ArtifactParityIssue[] = []
  if (!html.trim()) {
    return {
      ok: false,
      issues: [{ kind: 'missing_block', detail: 'empty_html' }],
      documentBlockCount: document.blocks.length,
      htmlBlockCount: 0,
    }
  }

  const { document: dom } = parseHTML(wrap(html))
  const stamped = Array.from(dom.querySelectorAll('[data-block-id]'))
  const seen = new Set<string>()
  const htmlOrder: string[] = []
  for (const el of stamped) {
    const id = el.getAttribute('data-block-id')?.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    htmlOrder.push(id)
  }

  const docOrder = document.blocks.map((block) => block.id)
  if (htmlOrder.join('\0') !== docOrder.join('\0')) {
    const missing = docOrder.filter((id) => !seen.has(id))
    for (const blockId of missing) {
      issues.push({ kind: 'missing_block', blockId, detail: 'data-block-id absent from html' })
    }
    if (missing.length === 0 || htmlOrder.some((id) => !docOrder.includes(id))) {
      issues.push({
        kind: 'order',
        detail: `html=[${htmlOrder.slice(0, 12).join(',')}] doc=[${docOrder.slice(0, 12).join(',')}]`,
      })
    }
  }

  for (const block of document.blocks) {
    const el = dom.querySelector(`[data-block-id="${cssAttrEscape(block.id)}"]`)
    if (!el) continue
    if (!el.getAttribute('data-block-origin')) {
      issues.push({
        kind: 'missing_origin',
        blockId: block.id,
        detail: 'data-block-origin absent',
      })
    }
    if (block.type === 'heading' || block.type === 'text') {
      const text = norm(el.textContent ?? '')
      if (text !== norm(block.text)) {
        issues.push({
          kind: 'text_mismatch',
          blockId: block.id,
          detail: `html="${text.slice(0, 80)}" doc="${norm(block.text).slice(0, 80)}"`,
        })
      }
    }
    if (block.type === 'chart') {
      const hostId = chartHostId(block.id)
      const host =
        dom.querySelector(`#${cssAttrEscape(hostId)}`) ??
        dom.querySelector(`[data-mauna-soft-chart="${cssAttrEscape(hostId)}"]`)
      if (!host) {
        issues.push({
          kind: 'missing_chart_host',
          blockId: block.id,
          detail: `host ${hostId} missing`,
        })
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    documentBlockCount: document.blocks.length,
    htmlBlockCount: htmlOrder.length,
  }
}
