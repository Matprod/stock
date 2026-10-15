type ScopeAthlete = {
  id: string
  name: string
  position: string | null
}

type AthleteNameIndex = {
  byFull: Map<string, string[]>
  byLast: Map<string, string[]>
  byFirst: Map<string, string[]>
  byId: Map<string, ScopeAthlete>
}

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const pushIndex = (map: Map<string, string[]>, key: string, id: string) => {
  if (!key) return
  const existing = map.get(key)
  if (existing) {
    if (!existing.includes(id)) existing.push(id)
    return
  }
  map.set(key, [id])
}

const buildAthleteNameIndex = (athletes: ScopeAthlete[]): AthleteNameIndex => {
  const byFull = new Map<string, string[]>()
  const byLast = new Map<string, string[]>()
  const byFirst = new Map<string, string[]>()
  const byId = new Map<string, ScopeAthlete>()

  for (const athlete of athletes) {
    byId.set(athlete.id, athlete)
    const full = normalizeText(athlete.name)
    const tokens = full.split(' ').filter(Boolean)
    pushIndex(byFull, full, athlete.id)
    if (tokens.length >= 2) {
      pushIndex(byFull, [...tokens].reverse().join(' '), athlete.id)
    }
    if (tokens.length > 0) {
      pushIndex(byFirst, tokens[0]!, athlete.id)
      pushIndex(byLast, tokens[tokens.length - 1]!, athlete.id)
    }
  }

  return { byFull, byLast, byFirst, byId }
}

export const athletesMentionedInPrompt = (
  prompt: string,
  athletes: ScopeAthlete[],
  index = buildAthleteNameIndex(athletes)
): string[] => {
  const text = normalizeText(prompt)
  if (!text) return []
  const ids: string[] = []
  const seen = new Set<string>()

  const sorted = [...athletes].sort(
    (left, right) => normalizeText(right.name).length - normalizeText(left.name).length
  )

  for (const athlete of sorted) {
    const full = normalizeText(athlete.name)
    if (full.length < 3 || !text.includes(full) || seen.has(athlete.id)) continue
    seen.add(athlete.id)
    ids.push(athlete.id)
  }

  for (const [last, lastIds] of index.byLast) {
    if (last.length < 3 || lastIds.length !== 1 || seen.has(lastIds[0]!)) continue
    if (!new RegExp(`(?:^| )${last}(?: |$)`).test(text)) continue
    seen.add(lastIds[0]!)
    ids.push(lastIds[0]!)
  }

  return ids
}
