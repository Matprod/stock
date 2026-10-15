import Season from '#models_pg/season'
import { dateToIsoDay, todayUtcIso, type IsoDateRange } from '#services/report_v4/lookback_range'
import { foldAscii } from '#utils/html_text'

export type ClubSeasonRef = {
  id: string
  name: string
  from: string
  to: string
  active: boolean
}

type SeasonLocatedRange = IsoDateRange & {
  index: number
  end: number
}

const clampSeasonRangeToToday = (range: IsoDateRange, today: string): IsoDateRange => {
  const to = range.to > today ? today : range.to
  const from = range.from > to ? to : range.from
  return { from, to }
}

export const loadClubSeasons = async (
  clubId: string,
  today = todayUtcIso()
): Promise<ClubSeasonRef[]> => {
  const rows = await Season.query().where('clubId', clubId).orderBy('startDate', 'desc')
  return rows.map((row) => {
    const from = dateToIsoDay(row.startDate)
    const to = dateToIsoDay(row.endDate)
    return {
      id: row.id,
      name: row.name?.trim() || `${from} → ${to}`,
      from,
      to,
      active: from <= today && to >= today,
    }
  })
}

export const formatClubSeasonsBrief = (seasons: ClubSeasonRef[], today = todayUtcIso()): string => {
  if (seasons.length === 0) {
    return 'Club seasons: none configured — resolve season phrases from calendar only.'
  }
  const lines = seasons.map((season) => {
    const marker = season.active ? ' [active]' : ''
    return `- ${season.name}: ${season.from} → ${season.to}${marker}`
  })
  return [
    'Club seasons (authoritative for season / campaign asks):',
    ...lines,
    `Today (UTC): ${today}.`,
    'Map "this/current season" → active row; "last/previous season" → most recent ended row; named season or year span (e.g. 2024-25) → matching row.',
    'When a season end is after today, clamp Display/fetches `to` to today.',
  ].join('\n')
}

const yearTokensForSeason = (season: ClubSeasonRef): string[] => {
  const y0 = season.from.slice(0, 4)
  const y1 = season.to.slice(0, 4)
  const short0 = y0.slice(2)
  const short1 = y1.slice(2)
  return [
    ...new Set([
      `${y0}-${y1}`,
      `${y0}/${y1}`,
      `${y0}-${short1}`,
      `${y0}/${short1}`,
      `${short0}-${short1}`,
      `${short0}/${short1}`,
    ]),
  ]
}

const pushSeasonMatch = (
  into: SeasonLocatedRange[],
  match: RegExpMatchArray,
  season: ClubSeasonRef,
  today: string
) => {
  const range = clampSeasonRangeToToday({ from: season.from, to: season.to }, today)
  const index = match.index ?? 0
  if (into.some((row) => row.index === index && row.from === range.from && row.to === range.to)) {
    return
  }
  into.push({ ...range, index, end: index + match[0].length })
}

const previousSeason = (seasons: ClubSeasonRef[], today: string): ClubSeasonRef | null => {
  const past = seasons
    .filter((season) => season.to < today)
    .sort((a, b) => b.to.localeCompare(a.to))
  return past[0] ?? null
}

export const collectSeasonRanges = (
  prompt: string,
  seasons: ClubSeasonRef[],
  today = todayUtcIso()
): SeasonLocatedRange[] => {
  if (seasons.length === 0) return []
  const text = foldAscii(prompt)
  const out: SeasonLocatedRange[] = []
  const active = seasons.find((season) => season.active) ?? null
  const previous = previousSeason(seasons, today)

  for (const match of text.matchAll(/\b(?:this|current)\s+season\b/g)) {
    if (active) pushSeasonMatch(out, match, active, today)
  }
  for (const match of text.matchAll(/\b(?:last|previous|prior)\s+season\b/g)) {
    if (previous) pushSeasonMatch(out, match, previous, today)
  }

  const byName = [...seasons].sort((a, b) => foldAscii(b.name).length - foldAscii(a.name).length)
  for (const season of byName) {
    const name = foldAscii(season.name)
    if (name.length < 3) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(String.raw`(?:^|[^a-z0-9_])${escaped}(?:[^a-z0-9_]|$)`, 'g')
    for (const match of text.matchAll(re)) pushSeasonMatch(out, match, season, today)
  }

  for (const season of seasons) {
    for (const token of yearTokensForSeason(season)) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(String.raw`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'g')
      for (const match of text.matchAll(re)) pushSeasonMatch(out, match, season, today)
    }
  }

  return out.sort((a, b) => a.index - b.index)
}
