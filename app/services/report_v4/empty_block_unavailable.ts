import type { AppLanguage } from '#utils/localize'

const EMPTY_CHART_HOST_RE =
  /<(div|figure)\b([^>]*\bclass=["'][^"']*\b(?:chart-box|chart|chart-host)\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi

const hasRenderableChartContent = (inner: string): boolean => {
  if (/<svg\b/i.test(inner) && !/data-chart-placeholder/i.test(inner)) return true
  if (/data-echarts-option=/i.test(inner)) return true
  if (/<canvas\b/i.test(inner)) return true
  const text = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length >= 8 && !/^(loading|…|\.\.\.)$/i.test(text)
}

export const unavailableLine = (args: {
  language: AppLanguage
  kind: 'chart' | 'table' | 'section' | 'domain'
  title?: string
  reason?: string
}): string => {
  const fr = args.language !== 'en'
  const title = (args.title ?? '').trim()
  if (args.reason?.trim()) {
    return fr
      ? `${title ? `${title} — ` : ''}${args.reason.trim()}`
      : `${title ? `${title} — ` : ''}${args.reason.trim()}`
  }
  if (args.kind === 'domain') {
    return fr
      ? `Domaine non collecté${title ? ` : ${title}` : ''} sur la période affichée.`
      : `Domain not collected${title ? `: ${title}` : ''} for the display period.`
  }
  if (args.kind === 'table') {
    return fr
      ? `Tableau non disponible${title ? ` : ${title}` : ''} (aucune donnée).`
      : `Table unavailable${title ? `: ${title}` : ''} (no data).`
  }
  if (args.kind === 'section') {
    return fr
      ? `Section non disponible${title ? ` : ${title}` : ''} (aucune donnée).`
      : `Section unavailable${title ? `: ${title}` : ''} (no data).`
  }
  return fr
    ? `Graphique non disponible${title ? ` : ${title}` : ''} (aucune donnée).`
    : `Chart unavailable${title ? `: ${title}` : ''} (no data).`
}

export const replaceEmptyChartHostsInHtml = (
  html: string,
  language: AppLanguage
): { html: string; replaced: number } => {
  let replaced = 0
  const next = html.replace(EMPTY_CHART_HOST_RE, (full, _tag: string, attrs: string, inner: string) => {
    if (hasRenderableChartContent(inner)) return full
    replaced += 1
    const titleMatch =
      /data-title=["']([^"']+)["']/i.exec(attrs) ??
      /aria-label=["']([^"']+)["']/i.exec(attrs) ??
      /data-chart-id=["']([^"']+)["']/i.exec(attrs)
    const title = titleMatch?.[1]
    const line = unavailableLine({ language, kind: 'chart', title })
    return `<p class="unavailable-line" data-unavailable="chart">${escapeHtml(line)}</p>`
  })
  return { html: next, replaced }
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
