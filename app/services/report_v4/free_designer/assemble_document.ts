import { readFileSync, readdirSync } from 'node:fs'
import { designKitPath } from '#services/report_v4/free_designer/kit_paths'

export type AssembleFreeDesignerHtmlArgs = {
  pagesHtml: string
  layoutStyle?: string
  language?: string
}

const loadThemeCss = (): string => readFileSync(designKitPath('theme.css'), 'utf8')

const loadFontDataUrls = (): Map<string, string> => {
  const fontsDir = designKitPath('fonts')
  const map = new Map<string, string>()
  for (const name of readdirSync(fontsDir)) {
    if (!name.endsWith('.woff2')) continue
    const buf = readFileSync(designKitPath('fonts', name))
    map.set(name, `data:font/woff2;base64,${buf.toString('base64')}`)
  }
  return map
}

const rewriteThemeFontUrls = (themeCss: string, fonts: Map<string, string>): string =>
  themeCss.replace(/url\(['"]fonts\/([^'"]+)['"]\)/g, (_full, filename: string) => {
    const data = fonts.get(filename)
    if (!data) return `url('fonts/${filename}')`
    return `url('${data}')`
  })

const stampMissingBlockIds = (html: string): string => {
  let pageN = 0
  let figN = 0
  let next = html.replace(
    /<div\b([^>]*\bclass=["'][^"']*\bpage\b[^"']*["'][^>]*)>/gi,
    (full, attrs: string) => {
      if (/\bdata-block-id=/i.test(attrs)) return full
      pageN += 1
      return `<div${attrs} data-block-id="page_${pageN}">`
    }
  )
  next = next.replace(/<figure\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\bdata-block-id=/i.test(attrs)) return full
    figN += 1
    return `<figure${attrs} data-block-id="fig_${figN}">`
  })
  next = next.replace(
    /<div\b([^>]*\bclass=["'][^"']*\bchart\b[^"']*["'][^>]*)>/gi,
    (full, attrs: string) => {
      if (/\bdata-block-id=/i.test(attrs)) return full
      figN += 1
      return `<div${attrs} data-block-id="fig_${figN}">`
    }
  )
  next = next.replace(/<svg\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\bdata-block-id=/i.test(attrs)) return full
    if (!/\bdata-chart=/i.test(attrs)) return full
    figN += 1
    return `<svg${attrs} data-block-id="fig_${figN}">`
  })
  return next
}

export const stripEmptyFreeDesignerChartHosts = (html: string): string =>
  html
    .replace(/<div\b[^>]*\bchart-box\b[^>]*>\s*<\/div>/gi, '')
    .replace(
      /<(article|section|div)\b([^>]*\bchart-card\b[^>]*)>\s*<h[1-4]\b[^>]*>[\s\S]*?<\/h[1-4]>\s*<\/\1>/gi,
      ''
    )

export const assembleFreeDesignerHtml = (args: AssembleFreeDesignerHtmlArgs): string => {
  const lang = args.language === 'fr' ? 'fr' : 'en'
  const fonts = loadFontDataUrls()
  const themeCss = rewriteThemeFontUrls(loadThemeCss(), fonts)
  const layout = args.layoutStyle?.trim()
    ? `<style id="mauna-layout">${args.layoutStyle.trim()}</style>`
    : ''
  const body = stripEmptyFreeDesignerChartHosts(stampMissingBlockIds(args.pagesHtml.trim()))
  return [
    '<!DOCTYPE html>',
    `<html lang="${lang}" data-artifact="free-designer">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style id="mauna-theme">${themeCss}</style>`,
    layout,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('')
}

export const freeDesignerHtmlLooksValid = (html: string | null | undefined): boolean => {
  if (!html || html.length < 400) return false
  if (!/<html[\s>]/i.test(html)) return false
  if (!/\bclass=["'][^"']*\bpage\b/i.test(html)) return false
  return /data-artifact=["']free-designer["']/i.test(html) || /id=["']mauna-theme["']/i.test(html)
}

export const extractFreeDesignerPagesBody = (html: string | null | undefined): string => {
  if (!html) return ''
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)
  if (body?.[1]) return body[1].trim()
  return html.trim()
}

export const countFreeDesignerPages = (pagesHtml: string): number => {
  const matches = pagesHtml.match(/<div\b[^>]*\bclass=["'][^"']*\bpage\b/gi)
  return matches?.length ?? 0
}

export const mergeFreeDesignerPagesHtml = (args: {
  existingArtifact: string | null | undefined
  incomingPagesHtml: string
  mode: 'replace' | 'append'
}): string => {
  const incoming = args.incomingPagesHtml.trim()
  if (args.mode === 'replace' || !args.existingArtifact) return incoming
  const prior = extractFreeDesignerPagesBody(args.existingArtifact)
  if (!prior) return incoming
  return `${prior}\n${incoming}`
}
