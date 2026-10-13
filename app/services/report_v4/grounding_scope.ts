export type GroundingScopeMode = 'full' | 'soft_delta'

export type GroundingScope = {
  mode: GroundingScopeMode
  allowHostIds?: string[]
}

const SOFT_DELTA_FRAGMENT_RE =
  /<(article|section|div|aside)\b[^>]*(?:data-mauna-soft-injected|data-mauna-soft-delta)=["'][^"']*["'][^>]*>[\s\S]*?<\/\1>/gi

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const extractSoftDeltaHtmlFragments = (html: string): string[] => {
  const fragments: string[] = []
  const re = new RegExp(SOFT_DELTA_FRAGMENT_RE.source, 'gi')
  for (const match of html.matchAll(re)) {
    const chunk = match[0]?.trim()
    if (chunk) fragments.push(chunk)
  }
  return fragments
}

export const extractHostScopedHtmlFragments = (html: string, allowHostIds: string[]): string[] => {
  const fragments: string[] = []
  for (const hostId of allowHostIds) {
    const id = escapeRegExp(hostId.trim())
    if (!id) continue
    const re = new RegExp(
      `<(article|section|div)\\b[^>]*>[\\s\\S]*?\\bid=["']${id}["'][\\s\\S]*?<\\/\\1>`,
      'gi'
    )
    for (const match of html.matchAll(re)) {
      const chunk = match[0]?.trim()
      if (chunk) fragments.push(chunk)
    }
  }
  return fragments
}

export const resolveGroundingAuditHtml = (
  html: string,
  scope?: GroundingScope | null
): { html: string; scoped: boolean } => {
  if (!scope || scope.mode === 'full') {
    return { html, scoped: false }
  }

  const fragments = [
    ...extractSoftDeltaHtmlFragments(html),
    ...(scope.allowHostIds?.length ? extractHostScopedHtmlFragments(html, scope.allowHostIds) : []),
  ]
  const unique = [...new Set(fragments.filter((row) => row.length > 0))]
  if (unique.length === 0) {
    return { html, scoped: false }
  }
  return { html: unique.join('\n'), scoped: true }
}

export const detectSoftDeltaGroundingScope = (html: string): GroundingScope | null => {
  if (!/(?:data-mauna-soft-injected|data-mauna-soft-delta)=/i.test(html)) return null
  return { mode: 'soft_delta' }
}
