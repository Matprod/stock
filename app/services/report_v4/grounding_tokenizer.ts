import { parseHTML } from 'linkedom'
import {
  REPORT_V4_GROUNDING_COUNT_NOUNS,
  REPORT_V4_GROUNDING_TOKENIZER_ENABLED,
  REPORT_V4_GROUNDING_YEAR_MAX,
  REPORT_V4_GROUNDING_YEAR_MIN,
} from '#services/report_v4/report_v4_constants'

export type NumberToken = {
  raw: string
  value: number
  unit?: string
  kind: 'digits' | 'word'
  blockPath: string
  start: number
  end: number
}

export type GroundingScan = {
  ungrounded: NumberToken[]
  matched: Array<{ token: NumberToken; factId: string }>
  ignored: Array<{ raw: string; reason: string }>
}

export type ScanFact = {
  id: string
  value: number
  unit?: string
  precision?: number
  thresholds?: number[]
}

export type ScanContext = {
  facts?: ScanFact[]
  language?: 'fr' | 'en'
  displayRange?: { from: string; to: string }
  wellnessScales?: Array<{ min: number; max: number }>
  factThresholds?: number[]
  properNames?: string[]
  countNouns?: string[]
  jerseyNumbers?: number[]
}

const PROSE_TAGS = new Set([
  'P',
  'LI',
  'FIGCAPTION',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'DD',
  'DT',
  'SUMMARY',
  'SPAN',
  'STRONG',
  'EM',
  'B',
  'I',
  'SMALL',
  'LABEL',
  'DIV',
  'ASIDE',
  'SECTION',
  'ARTICLE',
])

const EXCLUDE_TAGS = new Set(['SCRIPT', 'STYLE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH'])

const EXCLUDE_CLASS_RE = /\b(chart-box|running|foot)\b/i

const FR_WORD_VALUES: Record<string, number> = {
  zero: 0,
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  dixsept: 17,
  'dix-sept': 17,
  dixhuit: 18,
  'dix-huit': 18,
  dixneuf: 19,
  'dix-neuf': 19,
  vingt: 20,
  dizaine: 10,
  douzaine: 12,
}

const EN_WORD_VALUES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  dozen: 12,
}

const ARTICLE_WORDS = new Set(['un', 'une', 'a', 'an'])

const NBSP_RE = /[\u00a0\u202f\u2009]/g

export const isReportV4GroundingTokenizerEnabled = (): boolean => {
  const raw = process.env.REPORT_V4_GROUNDING_TOKENIZER?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  if (raw === '1' || raw === 'true' || raw === 'on') return true
  return REPORT_V4_GROUNDING_TOKENIZER_ENABLED
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeSpaces = (text: string): string => text.replace(NBSP_RE, ' ')

const resolveCountNouns = (ctx: ScanContext): string[] =>
  (ctx.countNouns?.length ? ctx.countNouns : REPORT_V4_GROUNDING_COUNT_NOUNS).map((n) =>
    n.toLowerCase()
  )

const hasExcludedAncestor = (node: Element | null): boolean => {
  let cur: Element | null = node
  while (cur) {
    const tag = cur.tagName?.toUpperCase?.() ?? ''
    if (EXCLUDE_TAGS.has(tag)) return true
    if (cur.hasAttribute?.('data-fact')) return true
    const className = typeof cur.className === 'string' ? cur.className : ''
    if (EXCLUDE_CLASS_RE.test(className)) return true
    cur = cur.parentElement
  }
  return false
}

const isProseContainer = (el: Element): boolean => {
  const tag = el.tagName?.toUpperCase?.() ?? ''
  if (!PROSE_TAGS.has(tag)) return false
  if (hasExcludedAncestor(el.parentElement)) return false
  if (el.hasAttribute('data-fact')) return false
  const className = typeof el.className === 'string' ? el.className : ''
  if (EXCLUDE_CLASS_RE.test(className)) return false
  return true
}

const closestBlockPath = (node: Node): string => {
  let cur: Element | null =
    node.nodeType === 1 ? (node as Element) : (node.parentElement as Element | null)
  while (cur) {
    const block = cur.getAttribute?.('data-block')
    if (block) return block
    cur = cur.parentElement
  }
  let path = ''
  let el: Element | null =
    node.nodeType === 1 ? (node as Element) : (node.parentElement as Element | null)
  let depth = 0
  while (el && depth < 6) {
    const tag = (el.tagName ?? 'node').toLowerCase()
    path = path ? `${tag}/${path}` : tag
    el = el.parentElement
    depth += 1
  }
  return path || 'prose'
}

type MaskHit = { start: number; end: number; raw: string; reason: string }

const pushMatches = (text: string, re: RegExp, reason: string, out: MaskHit[]): void => {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const global = new RegExp(re.source, flags)
  let match: RegExpExecArray | null
  while ((match = global.exec(text)) !== null) {
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      reason,
    })
  }
}

const collectMaskHits = (text: string, ctx: ScanContext): MaskHit[] => {
  const hits: MaskHit[] = []
  const lang = ctx.language ?? 'fr'

  pushMatches(
    text,
    /\b\d{4}-\d{2}-\d{2}\s*(?:→|->|–|—|-|to|au|à)\s*\d{4}-\d{2}-\d{2}\b/gi,
    'date_range_iso',
    hits
  )
  pushMatches(text, /\b\d{4}-\d{2}-\d{2}\b/g, 'date_iso', hits)
  pushMatches(
    text,
    /\b(?:du|de|from)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:au|à|to|->|→|–|—)\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi,
    'date_range_slash',
    hits
  )
  pushMatches(text, /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, 'date_slash', hits)
  pushMatches(
    text,
    /\b(?:le\s+)?\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/gi,
    'date_letters',
    hits
  )
  pushMatches(
    text,
    /\b(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/gi,
    'month_year',
    hits
  )
  pushMatches(
    text,
    /\b(?:entre\s+le|du|from)\s+\d{1,2}\s+(?:et\s+le|au|to|->|→)\s+\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    'date_range_letters',
    hits
  )
  pushMatches(text, /\bJ\s*[+-]\s*\d{1,2}\b/gi, 'day_marker', hits)
  pushMatches(text, /\b(?:semaine|week|S)\s*\d{1,2}\b/gi, 'week_marker', hits)
  pushMatches(text, /\b\d{1,2}\s*h\s*\d{0,2}\b/gi, 'time_h', hits)
  pushMatches(text, /\b\d{1,2}:\d{2}(?::\d{2})?\b/g, 'time_colon', hits)
  pushMatches(
    text,
    /\b\d{1,2}(?:er|ère|ere|e|ème|eme|st|nd|rd|th)\b/gi,
    'ordinal',
    hits
  )
  pushMatches(text, /(?:^|[\s>·•])\d{1,2}[.)]\s/g, 'list_numbering', hits)
  pushMatches(text, /\b\d{1,2}\s*[·•]\s+/g, 'section_numbering', hits)
  pushMatches(text, /\b\d{1,3}\s*\/\s*\d{1,3}\b/g, 'pagination', hits)
  pushMatches(text, /\(\s*0\s*[-–—to]+\s*100\s*\)/gi, 'scale_or_threshold', hits)
  pushMatches(text, /\b(?:sur|out of)\s+\d+\b/gi, 'out_of_n', hits)
  pushMatches(text, /\bn[°ºo]\s*\d+\b/gi, 'jersey_marker', hits)
  pushMatches(text, /\bid\s*=\s*["'][^"']+["']/gi, 'attribute', hits)
  pushMatches(text, /\bdata-block\s*=\s*["'][^"']+["']/gi, 'attribute', hits)

  const yearMin = REPORT_V4_GROUNDING_YEAR_MIN
  const yearMax = REPORT_V4_GROUNDING_YEAR_MAX
  pushMatches(text, /\b(19|20)\d{2}\b/g, 'year', hits)
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i]
    if (hit?.reason !== 'year') continue
    const year = Number(hit.raw)
    if (!Number.isFinite(year) || year < yearMin || year > yearMax) {
      hits.splice(i, 1)
    }
  }

  const scaleBounds = new Set<number>()
  for (const scale of ctx.wellnessScales ?? []) {
    scaleBounds.add(scale.min)
    scaleBounds.add(scale.max)
  }
  for (const threshold of [
    ...(ctx.factThresholds ?? []),
    ...(ctx.facts ?? []).flatMap((f) => f.thresholds ?? []),
  ]) {
    scaleBounds.add(threshold)
  }

  if (scaleBounds.size > 0) {
    const digitRe =
      lang === 'en'
        ? /(?<![A-Za-z0-9_])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?![A-Za-z0-9_])/g
        : /(?<![A-Za-z0-9_])(-?\d+(?:[ \u00a0\u202f\u2009]\d{3})*(?:[.,]\d+)?|-?\d+[.,]\d+)(?![A-Za-z0-9_])/g
    let match: RegExpExecArray | null
    while ((match = digitRe.exec(text)) !== null) {
      const raw = match[1] ?? match[0]
      const value = parseLocalizedNumber(raw, lang)
      if (value === null) continue
      if (!scaleBounds.has(value) && !scaleBounds.has(Math.round(value))) continue
      const unit = unitAfter(text, match.index + match[0].length)
      const space = unit ? (text.slice(match.index + match[0].length).match(/^\s*/)?.[0] ?? '') : ''
      const end = unit
        ? match.index + match[0].length + space.length + unit.length
        : match.index + match[0].length
      hits.push({
        start: match.index,
        end,
        raw: text.slice(match.index, end),
        reason: 'scale_or_threshold',
      })
    }
  }

  for (const name of ctx.properNames ?? []) {
    const trimmed = name.trim()
    if (!trimmed || !/\d/.test(trimmed)) continue
    pushMatches(text, new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, 'gi'), 'proper_name', hits)
  }
  pushMatches(text, /\bU\d{1,2}\b/g, 'proper_name', hits)
  pushMatches(text, /\bLigue\s+\d\b/gi, 'proper_name', hits)

  for (const jersey of ctx.jerseyNumbers ?? []) {
    pushMatches(
      text,
      new RegExp(`\\bn[°ºo]?\\s*${jersey}\\b|\\b#${jersey}\\b`, 'gi'),
      'jersey',
      hits
    )
  }

  const articles = lang === 'en' ? 'a|an|one' : 'un|une'
  const nouns = resolveCountNouns(ctx).map(escapeRegExp).join('|')
  if (nouns) {
    pushMatches(
      text,
      new RegExp(`\\b(?:${articles})\\s+(?:${nouns})\\b`, 'gi'),
      'article',
      hits
    )
  }

  pushMatches(
    text,
    /\b(?:deux|trois|quatre|cinq|six|sept|huit|neuf|dix|two|three|four|five|six|seven|eight|nine|ten)\s+fois\b/gi,
    'times_adverb',
    hits
  )

  return hits
}

const buildIgnoredMask = (
  text: string,
  hits: MaskHit[]
): { mask: boolean[]; ignored: Array<{ raw: string; reason: string }> } => {
  const mask = Array.from({ length: text.length }, () => false)
  const ignored: Array<{ raw: string; reason: string }> = []
  for (const hit of hits) {
    const start = Math.max(0, hit.start)
    const end = Math.min(text.length, hit.end)
    if (end <= start) continue
    for (let i = start; i < end; i += 1) mask[i] = true
    ignored.push({ raw: hit.raw, reason: hit.reason })
  }
  return { mask, ignored }
}

export const parseLocalizedNumber = (raw: string, language: 'fr' | 'en' = 'fr'): number | null => {
  let cleaned = normalizeSpaces(raw).trim()
  if (!cleaned) return null
  cleaned = cleaned.replace(/^[^\d+-]+|[^\d]+$/g, '')
  if (!cleaned) return null
  if (language === 'en') {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else {
    if (/^\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(cleaned)) {
      cleaned = cleaned.replace(/\s/g, '').replace(',', '.')
    } else if (/^\d+,\d+$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.')
    } else {
      cleaned = cleaned.replace(/\s/g, '').replace(',', '.')
    }
  }
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

const unitAfter = (text: string, end: number): string | undefined => {
  const slice = text.slice(end, end + 12)
  const match = slice.match(/^\s*(%|U\/L|u\/l|kg|cm|km|m|ms|bpm|AU|au)(?=$|[\s,.;:!?)\]])/i)
  return match?.[1]
}

const extractDigitTokens = (
  text: string,
  mask: boolean[],
  blockPath: string,
  language: 'fr' | 'en'
): NumberToken[] => {
  const tokens: NumberToken[] = []
  const re =
    language === 'en'
      ? /(?<![A-Za-z0-9_])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?![A-Za-z0-9_])/g
      : /(?<![A-Za-z0-9_])(-?\d+(?:[ \u00a0\u202f\u2009]\d{3})*(?:[.,]\d+)?|-?\d+[.,]\d+)(?![A-Za-z0-9_])/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    let blocked = false
    for (let i = start; i < end; i += 1) {
      if (mask[i]) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    const rawDigits = match[0]
    const value = parseLocalizedNumber(rawDigits, language)
    if (value === null) continue
    const unit = unitAfter(text, end)
    const space = unit ? (text.slice(end).match(/^\s*/)?.[0] ?? '') : ''
    const tokenEnd = unit ? end + space.length + unit.length : end
    const raw = unit ? `${rawDigits}${space}${unit}` : rawDigits
    tokens.push({
      raw,
      value,
      unit: unit || undefined,
      kind: 'digits',
      blockPath,
      start,
      end: tokenEnd,
    })
  }
  return tokens
}

const extractWordTokens = (
  text: string,
  mask: boolean[],
  blockPath: string,
  ctx: ScanContext
): NumberToken[] => {
  const tokens: NumberToken[] = []
  const nouns = resolveCountNouns(ctx)
  if (nouns.length === 0) return tokens
  const wordMap = { ...FR_WORD_VALUES, ...(ctx.language === 'en' ? EN_WORD_VALUES : {}) }
  const wordAlt = Object.keys(wordMap)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  const nounAlt = nouns.map(escapeRegExp).join('|')
  const re = new RegExp(`\\b(${wordAlt})\\s+(${nounAlt})\\b`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    let blocked = false
    for (let i = start; i < end; i += 1) {
      if (mask[i]) {
        blocked = true
        break
      }
    }
    if (blocked) continue
    const word = (match[1] ?? '').toLowerCase()
    if (ARTICLE_WORDS.has(word)) continue
    const value = wordMap[word]
    if (value === undefined) continue
    tokens.push({
      raw: match[0],
      value,
      kind: 'word',
      blockPath,
      start,
      end,
    })
  }
  return tokens
}

const valuesMatch = (token: NumberToken, fact: ScanFact, language: 'fr' | 'en'): boolean => {
  const precision = fact.precision ?? (Math.abs(fact.value) >= 100 ? 0 : Math.abs(fact.value) >= 10 ? 1 : 2)
  const tol = precision === 0 ? 0.51 : 0.5 * 10 ** -precision
  const candidates = [fact.value]
  const unit = (token.unit ?? fact.unit ?? '').toLowerCase()
  if (unit === '%' || unit === 'pct') {
    candidates.push(fact.value * 100, fact.value / 100)
  }
  return candidates.some((candidate) => Math.abs(candidate - token.value) <= tol)
}

const matchFacts = (
  tokens: NumberToken[],
  ctx: ScanContext
): { ungrounded: NumberToken[]; matched: Array<{ token: NumberToken; factId: string }> } => {
  const facts = ctx.facts ?? []
  const language = ctx.language ?? 'fr'
  const matched: Array<{ token: NumberToken; factId: string }> = []
  const ungrounded: NumberToken[] = []
  const usedFacts = new Set<string>()
  for (const token of tokens) {
    const fact = facts.find((f) => !usedFacts.has(f.id) && valuesMatch(token, f, language))
    if (fact) {
      usedFacts.add(fact.id)
      matched.push({ token, factId: fact.id })
    } else if (facts.some((f) => valuesMatch(token, f, language))) {
      const any = facts.find((f) => valuesMatch(token, f, language))!
      matched.push({ token, factId: any.id })
    } else {
      ungrounded.push(token)
    }
  }
  return { ungrounded, matched }
}

const collectProseTextNodes = (root: ParentNode): Array<{ node: Text; blockPath: string }> => {
  const out: Array<{ node: Text; blockPath: string }> = []
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      const parent = node.parentElement
      if (!parent) return
      if (hasExcludedAncestor(parent)) return
      if (!isProseContainer(parent) && parent.tagName?.toUpperCase() !== 'BODY') {
        const proseAncestor = (() => {
          let cur: Element | null = parent
          while (cur) {
            if (isProseContainer(cur)) return cur
            if (EXCLUDE_TAGS.has(cur.tagName?.toUpperCase?.() ?? '')) return null
            cur = cur.parentElement
          }
          return null
        })()
        if (!proseAncestor) return
      }
      const text = node.textContent ?? ''
      if (!text.trim()) return
      out.push({ node: node as Text, blockPath: closestBlockPath(node) })
      return
    }
    if (node.nodeType !== 1) return
    const el = node as Element
    const tag = el.tagName?.toUpperCase?.() ?? ''
    if (EXCLUDE_TAGS.has(tag)) return
    if (el.hasAttribute?.('data-fact')) return
    const className = typeof el.className === 'string' ? el.className : ''
    if (EXCLUDE_CLASS_RE.test(className)) return
    for (const child of Array.from(el.childNodes)) walk(child)
  }
  if (root.nodeType === 1 || root.nodeType === 9) {
    for (const child of Array.from((root as ParentNode).childNodes)) walk(child)
  } else {
    walk(root as unknown as Node)
  }
  return out
}

export const scanNumbers = (html: string, ctx: ScanContext = {}): GroundingScan => {
  const wrapped = /<html[\s>]/i.test(html)
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`
  const { document } = parseHTML(wrapped)
  const language = ctx.language ?? 'fr'
  const ignored: Array<{ raw: string; reason: string }> = []
  const tokens: NumberToken[] = []
  const root = document.body ?? document.documentElement ?? document

  for (const { node, blockPath } of collectProseTextNodes(root)) {
    const original = node.textContent ?? ''
    const text = normalizeSpaces(original)
    const hits = collectMaskHits(text, ctx)
    const { mask, ignored: localIgnored } = buildIgnoredMask(text, hits)
    ignored.push(...localIgnored)
    tokens.push(...extractDigitTokens(text, mask, blockPath, language))
    tokens.push(...extractWordTokens(text, mask, blockPath, ctx))
  }

  const { ungrounded, matched } = matchFacts(tokens, ctx)
  return { ungrounded, matched, ignored }
}

export const scanToLiteralViolations = (
  scan: GroundingScan
): Array<{ code: 'literal_number'; message: string; evidence: string }> =>
  scan.ungrounded.map((token) => ({
    code: 'literal_number' as const,
    message: 'Literal number in prose outside data-fact span',
    evidence: token.raw,
  }))
