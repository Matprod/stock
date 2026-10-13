import type { ArtifactDesignOp } from '#services/report_v4/artifact_runtime/types'

const DESIGN_STYLE_MARK = 'data-mauna-soft-design="1"'

const DESIGN_CSS = `<style ${DESIGN_STYLE_MARK}>
.mauna-title-strong h1,.mauna-title-strong h2,.mauna-title-strong .chart-title,.mauna-title-strong .band h1,.mauna-title-strong .band h2{font-weight:800!important;letter-spacing:.01em}
.mauna-band-accent .band{box-shadow:inset 0 -3px 0 color-mix(in srgb, var(--primary, #38BDF8) 85%, transparent)}
.mauna-spacing-tight .section-block{margin-bottom:10px!important}
.mauna-spacing-tight .section-body{padding-top:8px!important;padding-bottom:8px!important}
.mauna-caption-emphasis figcaption,.mauna-caption-emphasis .caption,.mauna-caption-emphasis .chart-caption{font-weight:600!important;color:var(--ink, #0f172a)!important}
</style>`

const ensureRootClass = (html: string, className: string): { html: string; changed: boolean } => {
  const bodyOpen = html.match(/<body\b([^>]*)>/i)
  if (bodyOpen) {
    const attrs = bodyOpen[1] ?? ''
    const classMatch = attrs.match(/\bclass=["']([^"']*)["']/i)
    if (classMatch) {
      const classes = classMatch[1]!.split(/\s+/).filter(Boolean)
      if (classes.includes(className)) return { html, changed: false }
      const nextAttrs = attrs.replace(
        /\bclass=["']([^"']*)["']/i,
        `class="${[...classes, className].join(' ')}"`
      )
      return {
        html: html.replace(bodyOpen[0], `<body${nextAttrs}>`),
        changed: true,
      }
    }
    return {
      html: html.replace(bodyOpen[0], `<body class="${className}"${attrs}>`),
      changed: true,
    }
  }
  const rootOpen = html.match(/<(?:div|main|article)\b[^>]*class=["'][^"']*\breport-flow\b[^"']*["'][^>]*>/i)
  if (rootOpen) {
    const tag = rootOpen[0]
    if (new RegExp(`\\b${className}\\b`).test(tag)) return { html, changed: false }
    const next = tag.replace(/\bclass=["']([^"']*)["']/i, (_m, raw: string) => {
      const classes = String(raw).split(/\s+/).filter(Boolean)
      return `class="${[...classes, className].join(' ')}"`
    })
    return { html: html.replace(tag, next), changed: true }
  }
  return {
    html: `<div class="report-flow ${className}">${html}</div>`,
    changed: true,
  }
}

const ensureDesignCss = (html: string): { html: string; changed: boolean } => {
  if (html.includes(DESIGN_STYLE_MARK)) return { html, changed: false }
  if (/<\/head>/i.test(html)) {
    return { html: html.replace(/<\/head>/i, `${DESIGN_CSS}</head>`), changed: true }
  }
  return { html: `${DESIGN_CSS}${html}`, changed: true }
}

const CLASS_FOR_OP: Record<ArtifactDesignOp['kind'], string> = {
  strengthen_title: 'mauna-title-strong',
  accent_band: 'mauna-band-accent',
  tighten_spacing: 'mauna-spacing-tight',
  emphasize_captions: 'mauna-caption-emphasis',
}

export const applyDesignOpsToHtml = (
  html: string,
  ops: ArtifactDesignOp[]
): { html: string; applied: string[]; changed: boolean } => {
  if (!ops.length) return { html, applied: [], changed: false }
  let next = html
  const applied: string[] = []
  let changed = false
  for (const op of ops) {
    const className = CLASS_FOR_OP[op.kind]
    const patched = ensureRootClass(next, className)
    next = patched.html
    if (patched.changed) {
      changed = true
      applied.push(op.kind)
    }
  }
  if (applied.length) {
    const css = ensureDesignCss(next)
    next = css.html
    if (css.changed) changed = true
  }
  return { html: next, applied, changed }
}
