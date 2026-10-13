import type { PremiumReportDocument } from '#contracts/premium_report'
import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { chartOptionHasRenderableData } from '#services/premium_report/premium_report_document'
import { artifactChartHostId } from '#services/report_v4/artifact_html'
import { PREMIUM_DOMAINS } from '#constants/premium_report_domains'
import { escapeHtml, foldAscii, foldKey } from '#utils/html_text'
import type { AppLanguage } from '#utils/localize'

export type ArtifactSection = {
  id: string
  bandTitle: string
  chartHostIds: string[]
  tableIds: string[]
  start: number
  end: number
  html: string
}

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

const stripTags = (value: string): string =>
  decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )

const QUERY_STOPWORDS = new Set([
  'titre',
  'title',
  'heading',
  'section',
  'sections',
  'chapitre',
  'chapter',
  'page',
  'the',
  'les',
  'des',
  'une',
  'and',
  'with',
  'from',
  'that',
  'this',
  'vide',
  'empty',
  'blank',
])

const stemToken = (token: string): string => token.replace(/s$/i, '')

export const normalizeSoftTitleQuery = (query: string): string =>
  foldAscii(query)
    .replace(/&/g, ' and ')
    .replace(/[–—−]/g, ' ')
    .replace(/\b(titre|title|heading|sections?|chapitre|chapter)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const significantTokens = (folded: string): string[] =>
  folded
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !QUERY_STOPWORDS.has(t))

const tokenInTitle = (title: string, token: string): boolean => {
  if (title.includes(token)) return true
  const stemmed = stemToken(token)
  if (stemmed.length >= 4 && title.includes(stemmed)) return true
  return title.split(/[^a-z0-9]+/).some((part) => stemToken(part) === stemmed)
}

const titlesMatch = (titleRaw: string, queryRaw: string): boolean => {
  const title = normalizeSoftTitleQuery(titleRaw)
  const needle = normalizeSoftTitleQuery(queryRaw)
  if (!title || !needle) return false
  if (title === needle || title.includes(needle) || needle.includes(title)) return true
  if (stemToken(title) === stemToken(needle)) return true
  const tokens = significantTokens(needle)
  if (tokens.length === 0) return false
  if (tokens.length === 1) return tokenInTitle(title, tokens[0]!)
  const hit = tokens.filter((token) => tokenInTitle(title, token)).length
  return hit >= Math.min(2, tokens.length) && hit >= Math.ceil(tokens.length * 0.6)
}

const domainKeyPatternsForQuery = (query: string): RegExp[] => {
  const needle = normalizeSoftTitleQuery(query)
  const tokens = significantTokens(needle)
  const patterns: RegExp[] = []
  for (const domain of PREMIUM_DOMAINS) {
    const key = domain.replace(/_/g, ' ')
    const hit =
      new RegExp(String.raw`\b${domain}\b`, 'i').test(needle) ||
      tokens.some((token) => token === domain || stemToken(token) === domain)
    if (!hit) continue
    patterns.push(new RegExp(String.raw`\b${domain}\b`, 'i'))
    if (key !== domain) patterns.push(new RegExp(String.raw`\b${key}\b`, 'i'))
  }
  return patterns
}

const BAND_CLASS_RE = /class=["'][^"']*(?<![-\w])band(?![-\w])[^"']*["']/i
const BAND_TITLE_RE =
  /<(?:div|span)\b[^>]*class=["'][^"']*\bband-title\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i

const extractBandTitle = (sectionHtml: string): string => {
  const open = sectionHtml.match(new RegExp(`<div\\b[^>]*${BAND_CLASS_RE.source}[^>]*>`, 'i'))?.[0]
  const fromTitle = sectionHtml.match(BAND_TITLE_RE)?.[1] ?? ''
  if (fromTitle) return stripTags(fromTitle)
  const bandInner = open
    ? sectionHtml.slice(sectionHtml.indexOf(open) + open.length, sectionHtml.indexOf(open) + 800)
    : sectionHtml
  const fromBand =
    bandInner.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ??
    bandInner.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ??
    ''
  if (fromBand) return stripTags(fromBand)
  const heading =
    sectionHtml.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ??
    sectionHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ??
    ''
  return stripTags(heading)
}

const extractChartHostIds = (sectionHtml: string): string[] => {
  const ids = new Set<string>()
  for (const match of sectionHtml.matchAll(/\bid=["'](chart_[a-zA-Z0-9]+)["']/gi)) {
    if (match[1]) ids.add(match[1])
  }
  return [...ids]
}

const extractTableIds = (sectionHtml: string): string[] => {
  const ids = new Set<string>()
  for (const match of sectionHtml.matchAll(/<table\b[^>]*\bid=["']([^"']+)["']/gi)) {
    if (match[1]) ids.add(match[1])
  }
  return [...ids]
}

export const ensureSectionAnchorsInHtml = (html: string): { html: string; stamped: number } => {
  let next = html
  let stamped = 0

  if (!/\bid=["']cover["']/i.test(next)) {
    const withCover = next.replace(
      /<(div|section)\b([^>]*\bclass=["'][^"']*\b(?:cover-panel|page\s+cover|cover)\b[^"']*["'][^>]*)>/i,
      (open, tag: string, attrs: string) => {
        if (/\bid=["']/i.test(attrs)) return open
        stamped += 1
        return `<${tag}${attrs} id="cover">`
      }
    )
    next = withCover
  }

  let bandIndex = 0
  next = next.replace(/<div\b([^>]*)>/gi, (open, attrs: string) => {
    if (!BAND_CLASS_RE.test(attrs)) return open
    if (/\bid=["']/i.test(attrs)) return open
    bandIndex += 1
    stamped += 1
    return `<div${attrs} id="band-section-${bandIndex}">`
  })

  let sectionIndex = 0
  next = next.replace(
    /<(article|section)\b([^>]*\bclass=["'][^"']*\bsection-block\b[^"']*["'][^>]*)>/gi,
    (open, tag: string, attrs: string) => {
      if (/\bid=["']/i.test(attrs)) return open
      sectionIndex += 1
      stamped += 1
      return `<${tag}${attrs} id="section-${sectionIndex}">`
    }
  )

  return { html: next, stamped }
}

export const indexArtifactSections = (html: string): ArtifactSection[] => {
  const sections: ArtifactSection[] = []
  const blockRe =
    /<(article|section)\b([^>]*\bclass=["'][^"']*\bsection-block\b[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi
  for (const match of html.matchAll(blockRe)) {
    const full = match[0]
    const start = match.index ?? 0
    const attrs = match[2] ?? ''
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i)
    const bandTitle = extractBandTitle(full)
    const id = idMatch?.[1]?.trim() || `section-${sections.length + 1}`
    sections.push({
      id,
      bandTitle,
      chartHostIds: extractChartHostIds(full),
      tableIds: extractTableIds(full),
      start,
      end: start + full.length,
      html: full,
    })
  }
  if (sections.length > 0) return sections

  const bandStarts: number[] = []
  const bandRe = /<div\b[^>]*class=["'][^"']*(?<![-\w])band(?![-\w])[^"']*["'][^>]*>/gi
  for (const match of html.matchAll(bandRe)) {
    bandStarts.push(match.index ?? 0)
  }
  for (let i = 0; i < bandStarts.length; i += 1) {
    const start = bandStarts[i]!
    const end = i + 1 < bandStarts.length ? bandStarts[i + 1]! : html.length
    const slice = html.slice(start, end)
    const bandTitle = extractBandTitle(slice)
    if (!bandTitle) continue
    if (/^(cover|sommaire|contents|couverture)$/i.test(foldKey(bandTitle))) continue
    const open = slice.match(/^<div\b([^>]*)>/i)?.[1] ?? ''
    const existingId = open.match(/\bid=["']([^"']+)["']/i)?.[1]?.trim()
    sections.push({
      id: existingId || `band-section-${sections.length + 1}`,
      bandTitle,
      chartHostIds: extractChartHostIds(slice),
      tableIds: extractTableIds(slice),
      start,
      end,
      html: slice,
    })
  }
  return sections
}

const htmlHasElementId = (html: string, id: string): boolean => {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\bid=["']${esc}["']`, 'i').test(html)
}

const findSectionsByQuery = (sections: ArtifactSection[], query: string): ArtifactSection[] => {
  const normalized = normalizeSoftTitleQuery(query)
  if (!normalized) return []
  const tokens = significantTokens(normalized)
  const domainPatterns = domainKeyPatternsForQuery(query)
  const domainOnlyQuery = tokens.length <= 1 && domainPatterns.length > 0

  if (domainOnlyQuery) {
    return sections.filter((section) => {
      const title = normalizeSoftTitleQuery(section.bandTitle)
      if (!title) return false
      return domainPatterns.some((re) => re.test(title))
    })
  }

  return sections.filter((section) => titlesMatch(section.bandTitle, query))
}

const removeSectionsFromHtml = (
  html: string,
  sections: ArtifactSection[]
): { html: string; removed: ArtifactSection[] } => {
  if (sections.length === 0) return { html, removed: [] }
  const ordered = [...sections].sort((a, b) => b.start - a.start)
  let next = html
  for (const section of ordered) {
    next = `${next.slice(0, section.start)}${next.slice(section.end)}`
  }
  return { html: next, removed: sections }
}

const removeMatchedHeadingBands = (
  html: string,
  query: string
): { html: string; removed: ArtifactSection[] } => {
  const removed: ArtifactSection[] = []
  let next = html
  const headingRe = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi
  const matches = [...html.matchAll(headingRe)]
  for (const match of matches.reverse()) {
    const text = stripTags(match[2] ?? '')
    if (!titlesMatch(text, query)) continue
    const headingStart = match.index ?? 0
    const headingEnd = headingStart + match[0].length
    const before = next.slice(0, headingStart)
    const bandOpen = before.lastIndexOf('<div')
    const bandSlice = bandOpen >= 0 ? next.slice(bandOpen, headingStart) : ''
    const isBand =
      bandOpen >= 0 && /class=["'][^"']*\bband\b/i.test(bandSlice) && !bandSlice.includes('</div>')
    let start = headingStart
    let end = headingEnd
    if (isBand) {
      start = bandOpen
      const close = next.indexOf('</div>', headingEnd)
      if (close >= 0) end = close + '</div>'.length
    }
    const articleOpen = next.lastIndexOf('<article', start)
    const sectionOpen = next.lastIndexOf('<section', start)
    const openAt = Math.max(articleOpen, sectionOpen)
    if (openAt >= 0 && openAt > start - 800) {
      const openTag = next.slice(openAt, openAt + 80)
      if (/\bsection-block\b/i.test(openTag) || /\bclass=["'][^"']*\bpage\b/i.test(openTag)) {
        const tagName = articleOpen > sectionOpen ? 'article' : 'section'
        const closeRe = new RegExp(`</${tagName}>`, 'i')
        const closeMatch = closeRe.exec(next.slice(start))
        if (closeMatch) {
          start = openAt
          end = start + (closeMatch.index ?? 0) + closeMatch[0].length
        }
      }
    }
    const slice = next.slice(start, end)
    removed.push({
      id: `heading-remove-${removed.length + 1}`,
      bandTitle: text,
      chartHostIds: extractChartHostIds(slice),
      tableIds: extractTableIds(slice),
      start,
      end,
      html: slice,
    })
    next = `${next.slice(0, start)}${next.slice(end)}`
  }
  return { html: next, removed }
}

export const removeSectionsByQuery = (
  html: string,
  query: string
): { html: string; removed: ArtifactSection[] } => {
  const sections = indexArtifactSections(html)
  const hits = findSectionsByQuery(sections, query)
  if (hits.length > 0) return removeSectionsFromHtml(html, hits)
  return removeMatchedHeadingBands(html, query)
}

export const dropCanvasBlocksByTitleQuery = (
  document: PremiumReportDocument,
  query: string
): { document: PremiumReportDocument; droppedBlockIds: string[] } => {
  const droppedBlockIds: string[] = []
  const blocks = document.blocks.filter((block) => {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      if (titlesMatch(block.title ?? '', query)) {
        droppedBlockIds.push(block.id)
        return false
      }
      return true
    }
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING || block.type === PREMIUM_BLOCK_TYPE.TEXT) {
      if (titlesMatch(block.text ?? '', query)) {
        droppedBlockIds.push(block.id)
        return false
      }
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE && titlesMatch(block.title ?? '', query)) {
      droppedBlockIds.push(block.id)
      return false
    }
    return true
  })
  return { document: { ...document, blocks }, droppedBlockIds }
}

export const stripEmptyChartSections = (
  html: string,
  chartOptionsByHostId: Map<string, Record<string, unknown>>
): { html: string; removed: ArtifactSection[] } => {
  const sections = indexArtifactSections(html)
  const empty = sections.filter((section) => {
    if (section.chartHostIds.length === 0) return false
    return section.chartHostIds.every((hostId) => {
      const option = chartOptionsByHostId.get(hostId)
      if (!option) return true
      return !chartOptionHasRenderableData(option)
    })
  })
  return removeSectionsFromHtml(html, empty)
}

const hasTocPage = (html: string): boolean =>
  /id=["'](?:sommaire|toc)["']/i.test(html) ||
  /class=["'][^"']*\b(?:toc-page|toc)\b/i.test(html)

export const ensureTocInHtml = (
  html: string,
  args: {
    language?: AppLanguage
    clubName?: string
    reportTitle?: string
  } = {}
): { html: string; added: boolean } => {
  if (hasTocPage(html)) return { html, added: false }
  const anchored = ensureSectionAnchorsInHtml(html)
  let next = anchored.html
  const language = args.language ?? 'fr'
  const fr = language === 'fr'
  const sections = indexArtifactSections(next).filter(
    (section) =>
      section.bandTitle.trim().length > 0 && htmlHasElementId(next, section.id)
  )
  if (sections.length === 0) return { html: next, added: false }

  const club = escapeHtml(args.clubName?.trim() || 'Club')
  const title = escapeHtml(args.reportTitle?.trim() || (fr ? 'Rapport' : 'Report'))
  const tocTitle = fr ? 'Sommaire' : 'Contents'
  const items: string[] = []
  let n = 1
  if (htmlHasElementId(next, 'cover')) {
    items.push(
      `<li><a href="#cover"><span>${String(n).padStart(2, '0')} · ${fr ? 'Couverture' : 'Cover'}</span><span class="hint">cover</span></a></li>`
    )
    n += 1
  }
  for (const [index, section] of sections.entries()) {
    const label = escapeHtml(section.bandTitle)
    const href = escapeHtml(section.id)
    items.push(
      `<li><a href="#${href}"><span>${String(n).padStart(2, '0')} · ${label}</span><span class="hint">§${index + 1}</span></a></li>`
    )
    n += 1
  }
  if (items.length === 0) return { html: next, added: false }

  const tocPage = `<section class="page toc-page" id="sommaire" data-mauna-soft-toc="1">
  <div class="band">
    <h1>${tocTitle}</h1>
    <div class="meta">${club}</div>
  </div>
  <h2 class="toc-title">${title}</h2>
  <ol class="toc-list">
    ${items.join('\n')}
  </ol>
  <div class="footer-inline"><span>${club} · confidential</span><span>toc</span></div>
</section>`

  if (/<\/section>/i.test(next) && /class=["'][^"']*\bcover\b/i.test(next)) {
    const coverClose = next.search(
      /<\/section>\s*(?=<main\b|<article\b|<section\b[^>]*section-block|<section\b[^>]*toc-page)/i
    )
    if (coverClose >= 0) {
      const insertAt = next.indexOf('</section>', coverClose) + '</section>'.length
      return {
        html: `${next.slice(0, insertAt)}\n${tocPage}\n${next.slice(insertAt)}`,
        added: true,
      }
    }
  }
  if (/class=["'][^"']*\bcover-panel\b/i.test(next)) {
    const coverEnd = next.search(/<\/div>\s*(?=<div\b[^>]*class=["'][^"']*\bband\b|<main\b|<section\b|<article\b)/i)
    if (coverEnd >= 0) {
      const insertAt = next.indexOf('</div>', coverEnd) + '</div>'.length
      return {
        html: `${next.slice(0, insertAt)}\n${tocPage}\n${next.slice(insertAt)}`,
        added: true,
      }
    }
  }
  if (/<main\b/i.test(next)) {
    return {
      html: next.replace(/<main\b/i, `${tocPage}\n<main`),
      added: true,
    }
  }
  if (/<body\b[^>]*>/i.test(next)) {
    return {
      html: next.replace(/<body\b[^>]*>/i, (open) => `${open}\n${tocPage}`),
      added: true,
    }
  }
  return { html: `${tocPage}\n${next}`, added: true }
}

export const syncCanvasAfterSectionRemoval = (
  document: PremiumReportDocument,
  removed: ArtifactSection[]
): { document: PremiumReportDocument; droppedBlockIds: string[] } => {
  if (removed.length === 0) return { document, droppedBlockIds: [] }
  const hostIds = new Set(removed.flatMap((section) => section.chartHostIds))
  const titles = removed.map((section) => section.bandTitle).filter(Boolean)
  const droppedBlockIds: string[] = []
  const blocks = document.blocks.filter((block) => {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
      const host = artifactChartHostId(block.id)
      if (hostIds.has(host)) {
        droppedBlockIds.push(block.id)
        return false
      }
      if (titles.some((t) => titlesMatch(block.title ?? '', t))) {
        droppedBlockIds.push(block.id)
        return false
      }
      return true
    }
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING || block.type === PREMIUM_BLOCK_TYPE.TEXT) {
      if (titles.some((t) => titlesMatch(block.text ?? '', t))) {
        droppedBlockIds.push(block.id)
        return false
      }
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
      if (titles.some((t) => titlesMatch(block.title ?? '', t))) {
        droppedBlockIds.push(block.id)
        return false
      }
    }
    return true
  })
  return { document: { ...document, blocks }, droppedBlockIds }
}

export const buildChartOptionHostMap = (
  document: PremiumReportDocument
): Map<string, Record<string, unknown>> => {
  const map = new Map<string, Record<string, unknown>>()
  for (const block of document.blocks) {
    if (block.type !== PREMIUM_BLOCK_TYPE.CHART) continue
    map.set(artifactChartHostId(block.id), block.option)
  }
  return map
}

const sectionTitleStillPresent = (html: string, query: string): boolean => {
  const sections = indexArtifactSections(html)
  if (findSectionsByQuery(sections, query).length > 0) return true
  for (const match of html.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (titlesMatch(stripTags(match[2] ?? ''), query)) return true
  }
  return false
}

export const tocPresentInHtml = (html: string): boolean => hasTocPage(html)

export const assertSoftEditorialGates = (args: {
  html: string
  removeQueries: string[]
  ensureToc: boolean
  removedCountByQuery?: Record<string, number>
}): { ok: boolean; errors: string[] } => {
  const errors: string[] = []
  for (const query of args.removeQueries) {
    if (sectionTitleStillPresent(args.html, query)) {
      errors.push(`section_still_present:${query}`)
      continue
    }
    if (args.removedCountByQuery && (args.removedCountByQuery[query] ?? 0) === 0) {
      errors.push(`section_not_removed:${query}`)
    }
  }
  if (args.ensureToc && !tocPresentInHtml(args.html)) {
    errors.push('toc_missing')
  }
  return { ok: errors.length === 0, errors }
}

export const buildSoftArtifactOutline = (
  html: string
): Array<{ id: string; bandTitle: string; chartHostIds: string[] }> =>
  indexArtifactSections(html).map((section) => ({
    id: section.id,
    bandTitle: section.bandTitle,
    chartHostIds: section.chartHostIds,
  }))
