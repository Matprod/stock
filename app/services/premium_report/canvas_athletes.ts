import type { PremiumReportBlock } from '#contracts/premium_report'

const JOUEUR_COL_RE = /^(joueur|player|athlete|name|full_?name|athlete_?name)$/i
const NAME_TOKEN_RE =
  /\b([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’-]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’-]+)+)\b/g

type CaptionAthleteOptions = {
  excludeTokens?: string[]
}

export const canvasAthleteNames = (
  blocks: PremiumReportBlock[],
  roster: string[] = []
): string[] => {
  const names = new Set<string>()
  const rosterTokens = collectRosterTokens(roster)
  for (const block of blocks) {
    if (block.type === 'chart') collectChartAthletes(block.option, names, rosterTokens)
    if (block.type === 'table') collectTableAthletes(block, names)
  }
  return [...names]
}

const ROLE_PREFIX_RE =
  /^(?:point|shooting|power|small)?\s*(?:guard|forward|center|centre|goalkeeper|goalie|midfielder|defender|striker|winger|pivot|ailier|meneur|ailier\s+fort|ailier\s+faible|coach|staff)\s+/i

export const captionUnknownAthletes = (
  caption: string,
  allowed: string[],
  options?: CaptionAthleteOptions
): string[] => {
  if (allowed.length === 0) return []
  const allowNorm = allowed.map(normalizeName)
  const rosterTokens = collectRosterTokens(allowed)
  const exclude = new Set(
    (options?.excludeTokens ?? []).map(foldToken).filter((token) => token.length >= 3)
  )
  return extractNameLikeTokens(caption, rosterTokens, exclude).filter(
    (name) => !isGroundedAthleteMention(name, allowed, allowNorm, rosterTokens)
  )
}

const isGroundedAthleteMention = (
  candidate: string,
  allowed: string[],
  allowNorm: string[],
  rosterTokens: Set<string>
): boolean => {
  const stripped = candidate.replace(ROLE_PREFIX_RE, '').trim() || candidate
  const needle = normalizeName(stripped)
  if (
    allowNorm.some(
      (allowedName) =>
        allowedName === needle ||
        allowedName.includes(needle) ||
        needle.includes(allowedName)
    )
  ) {
    return true
  }
  const overlap = stripped
    .split(/\s+/)
    .map(foldToken)
    .filter((part) => part.length >= 3 && rosterTokens.has(part))
  if (overlap.length === 0) return false
  return allowed.some((athlete) => {
    const parts = new Set(
      athlete
        .split(/\s+/)
        .map(foldToken)
        .filter((part) => part.length >= 3)
    )
    return overlap.every((part) => parts.has(part))
  })
}

const collectRosterTokens = (allowed: string[]): Set<string> => {
  const tokens = new Set<string>()
  for (const name of allowed) {
    for (const part of name.split(/\s+/)) {
      const folded = foldToken(part)
      if (folded.length >= 3) tokens.add(folded)
    }
  }
  return tokens
}

const collectChartAthletes = (
  option: Record<string, unknown>,
  into: Set<string>,
  rosterTokens: Set<string>
): void => {
  const series = Array.isArray(option.series) ? option.series : []
  for (const item of series) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const name = (item as { name?: unknown }).name
    if (typeof name === 'string' && sharesRosterToken(name, rosterTokens)) into.add(name.trim())
  }
  const dataset = option.dataset
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) return
  const source = (dataset as { source?: unknown }).source
  if (!Array.isArray(source) || source.length < 2 || !Array.isArray(source[0])) return
  const header = (source[0] as unknown[]).map((cell) => String(cell ?? ''))
  const joueurIdx = header.findIndex((col) => JOUEUR_COL_RE.test(col))
  if (joueurIdx < 0) return
  for (const row of source.slice(1)) {
    if (!Array.isArray(row)) continue
    const cell = row[joueurIdx]
    if (typeof cell === 'string' && cell.trim()) into.add(cell.trim())
  }
}

const collectTableAthletes = (
  block: Extract<PremiumReportBlock, { type: 'table' }>,
  into: Set<string>
): void => {
  const joueurIdx = block.columns.findIndex((col) => JOUEUR_COL_RE.test(col))
  if (joueurIdx < 0) return
  for (const row of block.rows) {
    const cell = row[joueurIdx]
    if (typeof cell === 'string' && cell.trim()) into.add(cell.trim())
  }
}

const extractNameLikeTokens = (
  caption: string,
  rosterTokens: Set<string>,
  excludeTokens: Set<string>
): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  for (const match of caption.matchAll(NAME_TOKEN_RE)) {
    const token = match[1]?.trim()
    if (!token || !sharesRosterToken(token, rosterTokens, excludeTokens)) continue
    const key = normalizeName(token)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(token)
  }
  return out
}

const sharesRosterToken = (
  value: string,
  rosterTokens: Set<string>,
  excludeTokens: Set<string> = new Set()
): boolean => {
  const trimmed = value.trim()
  if (trimmed.length < 3 || trimmed.length > 80) return false
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 4) return false
  if (parts.some((part) => /^[A-ZÀ-ÖØ-Þ]'/u.test(part))) return false
  const folded = parts.map(foldToken).filter((part) => part.length >= 3)
  if (folded.some((part) => excludeTokens.has(part))) return false
  return folded.some((part) => rosterTokens.has(part))
}

const foldToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')

const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
