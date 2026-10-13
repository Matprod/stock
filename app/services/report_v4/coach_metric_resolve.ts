import type { ClubMetricCatalog } from '#services/premium_report/club_metric_catalog'
import type { GpsIntensityKpi } from '#constants/premium_report_metrics'

export type ResolvedCoachMetric = {
  phrase: string
  source: 'gps' | 'load' | 'match'
  name: string
  alias: string
  score: number
}

const fold = (value: string): string => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const tokenize = (value: string): string[] => {
  const folded = fold(value)
  const tokens = folded
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
  for (const match of folded.matchAll(/\bz\s*(\d+)\b/g)) {
    tokens.push(`z${match[1]}`)
  }
  return tokens
}

const uniquePhrases = (phrases: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const phrase of phrases) {
    const cleaned = phrase.replace(/\s+/g, ' ').trim()
    if (cleaned.length < 2 || cleaned.length > 80) continue
    const key = fold(cleaned)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
  }
  return out
}

const extractCoachMetricPhrases = (prompt: string): string[] => {
  const out: string[] = []
  const listRe =
    /(?:looking at|focus(?:ing)? on|metrics?(?:\s*:)?|including|report\s+(?:on|for)|examine|track(?:ing)?)\s+([^.!?\n]+)/gi
  for (const match of prompt.matchAll(listRe)) {
    const chunk = match[1] ?? ''
    const cut = chunk.split(/\b(?:using|report|start(?:ing)?|from|daily|with)\b/i)[0] ?? chunk
    for (const part of cut.split(/\s*(?:,|&|\/|\band\b)\s*/i)) {
      const cleaned = part.replace(/[.]+$/, '').trim()
      if (cleaned) out.push(cleaned)
    }
  }
  for (const match of prompt.matchAll(/\bz\s*(\d+)\s*hsr\b/gi)) {
    out.push(`Z${match[1]} HSR`)
  }
  for (const match of prompt.matchAll(/\b(?:total|meaningful|explosive)\s+distance\b/gi)) {
    out.push(match[0])
  }
  for (const match of prompt.matchAll(
    /\b(?:minutes?\s+played|playing\s+time|tackles?\s+won|tackles?\s+contested|max\s+speed|top\s+speed|match\s+distance|intensive\s+run)\b/gi
  )) {
    out.push(match[0])
  }
  if (/\bacwr\b|\bacute\s*[:=-]?\s*chronic\b/i.test(prompt)) {
    out.push(/\bewma\b/i.test(prompt) ? 'ACWR EWMA' : 'ACWR')
  }
  for (const match of prompt.matchAll(
    /\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z0-9]+){0,3}|Z\d+\s+[A-Z]{2,})\b/g
  )) {
    const phrase = match[0]
    if (/^(Start|Provide|Report|Daily|Using|Looking|Group)\b/.test(phrase)) continue
    out.push(phrase)
  }
  return uniquePhrases(out)
}

type ScoreHint = {
  ask: RegExp
  boost: RegExp
  penalize?: RegExp
}

const GPS_HINTS: ScoreHint[] = [
  {
    ask: /\bhsr\b|high\s*speed/,
    boost: /hsr|highspeed|speedintensity|distancez\d|velocity.?band|distance_?\d/,
    penalize: /accel|decel|explosive|entriesz/,
  },
  {
    ask: /\bmeaningful\b|hmld|metabolic/,
    boost: /hmld|meaningful|metabolic|high.?metabolic/,
    penalize: /accel|decel|explosive/,
  },
  {
    ask: /\bexplosive\b/,
    boost: /explosive/,
    penalize: /hsr|highspeed|hmld/,
  },
  {
    ask: /\btotal\s*distance\b|\bdistance\s*total\b/,
    boost: /distancetotal|total_?distance|(?:^|_)distance(?:$|_)/,
    penalize: /z\d|band|accel|decel|hmld|hsr|explosive|meaningful|speedintensity|entries/,
  },
]

const MATCH_HINTS: ScoreHint[] = [
  {
    ask: /\bminutes?\b|playing\s*time|time\s*on\s*pitch/,
    boost: /minutes_?played|playing.?time|mins_?played/,
  },
  {
    ask: /\btackles?\b/,
    boost: /tackles?/,
  },
  {
    ask: /\bsprint\b/,
    boost: /sprint/,
  },
  {
    ask: /\bintensive\s*run\b|\bhsr\b/,
    boost: /intensive_?run|sprint/,
  },
  {
    ask: /\bmax\s*speed\b|\btop\s*speed\b/,
    boost: /max_?speed|top_?speed/,
  },
  {
    ask: /\btotal\s*distance\b|\bmatch\s*distance\b/,
    boost: /total_?distance/,
  },
]

const scoreGpsMatch = (phrase: string, kpi: GpsIntensityKpi, label: string | undefined): number => {
  const phraseFold = fold(phrase)
  const hay = fold(`${kpi.name} ${kpi.alias} ${label ?? ''}`)
  const phraseTokens = tokenize(phrase)
  const hayTokens = new Set(tokenize(hay))
  let score = 0
  for (const token of phraseTokens) {
    if (hay.includes(token)) score += 3
    else if (hayTokens.has(token)) score += 2
  }
  for (const hint of GPS_HINTS) {
    if (!hint.ask.test(phraseFold)) continue
    if (hint.boost.test(hay)) score += 8
    if (hint.penalize?.test(hay)) score -= 10
  }
  const zone = phraseFold.match(/\bz\s*(\d+)\b/)
  if (zone) {
    const z = zone[1]!
    if (new RegExp(`(?:z|band)${z}\\b|_${z}(?:_|$)`).test(hay)) score += 6
    else if (/z\d|band\d/.test(hay)) score -= 4
  }
  if (/abs\b/.test(hay) && !/rel\b/.test(phraseFold)) score += 4
  if (/rel\b/.test(hay) && !/\brel\b|relative|%/.test(phraseFold)) score -= 6
  return score
}

const resolveLoadPhrase = (phrase: string): ResolvedCoachMetric | null => {
  const folded = fold(phrase)
  if (!/\bacwr\b|\bacute\s*[:=-]?\s*chronic\b|\bewma\b/.test(folded)) return null
  if (!/\bacwr\b|\bacute/.test(folded) && /\bewma\b/.test(folded)) {
    return { phrase, source: 'load', name: 'ewma_7', alias: 'ewma_7', score: 6 }
  }
  return { phrase, source: 'load', name: 'acwr_ewma', alias: 'acwr_ewma', score: 12 }
}

const scoreMatchKpi = (
  phrase: string,
  kpi: { name: string; alias: string },
  label: string | undefined
): number => {
  const phraseFold = fold(phrase)
  const hay = fold(`${kpi.name} ${kpi.alias} ${label ?? ''}`)
  const phraseTokens = tokenize(phrase)
  const hayTokens = new Set(tokenize(hay))
  let score = 0
  for (const token of phraseTokens) {
    if (hay.includes(token)) score += 3
    else if (hayTokens.has(token)) score += 2
  }
  for (const hint of MATCH_HINTS) {
    if (!hint.ask.test(phraseFold)) continue
    if (hint.boost.test(hay)) score += 8
    if (hint.penalize?.test(hay)) score -= 6
  }
  if (/\bmatch\b|\bgame\b|\bcompetition\b/.test(phraseFold) && /minutes|tackles|sprint|distance|speed/i.test(hay)) {
    score += 2
  }
  return score
}

export const resolveCoachMetricsFromCatalog = (args: {
  prompt: string
  catalog: ClubMetricCatalog
  labels?: Record<string, string>
  minScore?: number
}): ResolvedCoachMetric[] => {
  const minScore = args.minScore ?? 6
  const phrases = extractCoachMetricPhrases(args.prompt)
  const resolved: ResolvedCoachMetric[] = []
  const usedGps = new Set<string>()
  const usedMatch = new Set<string>()
  const askMatch =
    /\b(match(?:es)?|competition|game[-\s]?day|skillcorner|minutes?\s+played|tackles?)\b/i.test(
      args.prompt
    )

  for (const phrase of phrases) {
    const loadHit = resolveLoadPhrase(phrase)
    if (loadHit) {
      resolved.push(loadHit)
      continue
    }

    let bestMatch: ResolvedCoachMetric | null = null
    if (askMatch || args.catalog.matchKpis.length > 0) {
      for (const kpi of args.catalog.matchKpis) {
        const score = scoreMatchKpi(phrase, kpi, args.labels?.[kpi.name])
        if (score < minScore) continue
        if (bestMatch && score <= bestMatch.score) continue
        bestMatch = {
          phrase,
          source: 'match',
          name: kpi.name,
          alias: kpi.alias,
          score,
        }
      }
    }

    let bestGps: ResolvedCoachMetric | null = null
    for (const kpi of args.catalog.periodKpis) {
      const score = scoreGpsMatch(phrase, kpi, args.labels?.[kpi.name])
      if (score < minScore) continue
      if (bestGps && score <= bestGps.score) continue
      bestGps = {
        phrase,
        source: 'gps',
        name: kpi.name,
        alias: kpi.alias,
        score,
      }
    }
    if (!bestGps) {
      for (const name of args.catalog.periodNames) {
        const alias = args.catalog.periodKpis.find((k) => k.name === name)?.alias ?? name
        const score = scoreGpsMatch(
          phrase,
          { name, alias, agg: 'SUM', digits: 0 },
          args.labels?.[name]
        )
        if (score < minScore) continue
        if (bestGps && score <= bestGps.score) continue
        bestGps = { phrase, source: 'gps', name, alias, score }
      }
    }

    const preferMatch =
      askMatch &&
      bestMatch &&
      (!bestGps || bestMatch.score >= bestGps.score - 1)
    const pick = preferMatch ? bestMatch : bestGps ?? bestMatch
    if (!pick) continue
    if (pick.source === 'gps') {
      if (usedGps.has(pick.name)) continue
      usedGps.add(pick.name)
    } else if (pick.source === 'match') {
      if (usedMatch.has(pick.name)) continue
      usedMatch.add(pick.name)
    }
    resolved.push(pick)
  }

  return resolved.sort((a, b) => b.score - a.score)
}

export const preferredGpsMetricNames = (resolved: ResolvedCoachMetric[]): string[] => [
  ...new Set(resolved.filter((row) => row.source === 'gps').map((row) => row.name)),
]

export const preferredMatchMetricNames = (resolved: ResolvedCoachMetric[]): string[] => [
  ...new Set(resolved.filter((row) => row.source === 'match').map((row) => row.name)),
]

const MATCH_SOURCE_RE =
  /\b(skillcorner|dfl|statsports|catapult|manual)\b/i

export const preferredMatchSourceFromPrompt = (prompt: string): string | undefined => {
  const hit = MATCH_SOURCE_RE.exec(prompt)
  return hit?.[1]?.toLowerCase()
}

export const formatCoachMetricBindings = (resolved: ResolvedCoachMetric[]): string => {
  if (resolved.length === 0) return ''
  return resolved
    .map((row) => `${row.phrase} → ${row.source}:${row.alias} (${row.name})`)
    .join(' | ')
}

const GPS_FAMILY_RES: Array<{ id: string; re: RegExp }> = [
  {
    id: 'distance',
    re: /distancetotal|total_?distance|(?:^|_)distance(?:$|_)/i,
  },
  { id: 'hmld', re: /hmld|meaningful|metabolic|high.?metabolic/i },
  { id: 'hsr', re: /hsr|highspeed|speedintensity|distancez\d|velocity.?band/i },
  { id: 'explosive', re: /explosive|accel|decel|\bima\b/i },
  { id: 'load', re: /player.?load|pl_?total|bodily/i },
]

const diversifyGpsCatalogKpis = (catalog: ClubMetricCatalog, max = 4): GpsIntensityKpi[] => {
  const picked: GpsIntensityKpi[] = []
  const usedNames = new Set<string>()
  for (const family of GPS_FAMILY_RES) {
    if (picked.length >= max) break
    const hit = catalog.periodKpis.find((kpi) => {
      if (usedNames.has(kpi.name)) return false
      return family.re.test(fold(`${kpi.name} ${kpi.alias}`))
    })
    if (!hit) continue
    usedNames.add(hit.name)
    picked.push(hit)
  }
  for (const kpi of catalog.periodKpis) {
    if (picked.length >= max) break
    if (usedNames.has(kpi.name)) continue
    usedNames.add(kpi.name)
    picked.push(kpi)
  }
  return picked
}

export const gpsKpisForAnalystAsk = (args: {
  prompt: string
  catalog: ClubMetricCatalog
  labels?: Record<string, string>
  minCount?: number
  maxCount?: number
}): ResolvedCoachMetric[] => {
  const minCount = args.minCount ?? 2
  const maxCount = args.maxCount ?? 4
  const resolved = resolveCoachMetricsFromCatalog(args).filter((row) => row.source === 'gps')
  const out = resolved.slice(0, maxCount)
  const used = new Set(out.map((row) => row.name))
  if (out.length >= minCount) return out
  for (const kpi of diversifyGpsCatalogKpis(args.catalog, maxCount)) {
    if (out.length >= maxCount) break
    if (used.has(kpi.name)) continue
    used.add(kpi.name)
    out.push({
      phrase: kpi.alias,
      source: 'gps',
      name: kpi.name,
      alias: kpi.alias,
      score: 1,
    })
  }
  return out
}

export const formatPeriodKpisBrief = (kpis: GpsIntensityKpi[]): string => {
  if (kpis.length === 0) return 'none'
  return kpis.map((kpi) => `${kpi.alias} (${kpi.name})`).join(', ')
}
