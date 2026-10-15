import { formatReportV4RunFlagsLine, type ReportV4RunFlags } from '#services/report_v4/run_flags'

const BANNER_STYLE = [
  '.report-v4-run-banner{',
  'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;',
  'color:#334155;background:#f1f5f9;border-bottom:1px solid #cbd5e1;',
  'padding:6px 12px;margin:0;',
  '}',
  '@media print{.report-v4-run-banner{display:none!important}}',
].join('')

export const injectReportV4RunBanner = (
  html: string,
  args: { runId: string; flags: ReportV4RunFlags }
): string => {
  if (!html.trim()) return html
  if (/class=["'][^"']*\breport-v4-run-banner\b/i.test(html)) return html

  const line = formatReportV4RunFlagsLine(args.flags)
  const banner = [
    `<style id="report-v4-run-banner-style">${BANNER_STYLE}</style>`,
    `<div class="report-v4-run-banner"`,
    ` data-run-id="${escapeAttr(args.runId)}"`,
    ` data-free-designer="${args.flags.freeDesigner ? '1' : '0'}"`,
    ` data-free-designer-refs="${args.flags.freeDesignerRefs ? '1' : '0'}"`,
    ` data-lang="${escapeAttr(args.flags.lang)}"`,
    ` data-path="${escapeAttr(args.flags.path)}"`,
    `>${escapeText(line)} · run=${escapeText(args.runId)}</div>`,
  ].join('')

  let next = stampHtmlFlags(html, args)
  if (/<body\b[^>]*>/i.test(next)) {
    return next.replace(/<body\b[^>]*>/i, (open) => `${open}${banner}`)
  }
  return `${banner}${next}`
}

const stampHtmlFlags = (html: string, args: { runId: string; flags: ReportV4RunFlags }): string => {
  if (!/<html\b/i.test(html)) return html
  return html.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    let nextAttrs = attrs
    nextAttrs = upsertAttr(nextAttrs, 'data-run-id', args.runId)
    nextAttrs = upsertAttr(nextAttrs, 'data-free-designer', args.flags.freeDesigner ? '1' : '0')
    nextAttrs = upsertAttr(
      nextAttrs,
      'data-free-designer-refs',
      args.flags.freeDesignerRefs ? '1' : '0'
    )
    nextAttrs = upsertAttr(nextAttrs, 'data-lang', args.flags.lang)
    nextAttrs = upsertAttr(nextAttrs, 'data-path', args.flags.path)
    return `<html${nextAttrs}>`
  })
}

const upsertAttr = (attrs: string, name: string, value: string): string => {
  const re = new RegExp(`\\s${name}=["'][^"']*["']`, 'i')
  if (re.test(attrs)) return attrs.replace(re, ` ${name}="${escapeAttr(value)}"`)
  return `${attrs} ${name}="${escapeAttr(value)}"`
}

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
