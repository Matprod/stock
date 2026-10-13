import { randomUUID } from 'node:crypto'
import {
  REPORT_BLOC_SPLIT,
  REPORT_BLOC_TYPE,
  REPORT_MAX_COMPARE_VARIABLES,
  REPORT_STRUCTURE_MAX_BLOCS,
  maxCompareAthletesFor,
  type ReportBlocType,
} from '#constants/report_builder.constants'
import type { ReportBlocSpec, ReportDateRange } from '#contracts/report_builder'
import { isAllReduceSeries } from '#services/report_builder/formulas'

const WHOLE_TEAM_PROMOTE_TYPES = new Set<ReportBlocType>([
  REPORT_BLOC_TYPE.BAR_CHART,
  REPORT_BLOC_TYPE.LINE_CHART,
  REPORT_BLOC_TYPE.PIE_CHART,
])

export type ScopeAthlete = {
  id: string
  name: string
  position: string | null
}

export type PromptAthleteScopeMode = 'none' | 'named' | 'positions' | 'mixed' | 'team'

export type PromptAthleteScope = {
  mode: PromptAthleteScopeMode
  athleteIds: string[]
  forceCover: boolean
  preferAthleteSplit: boolean
}

type AthleteNameIndex = {
  byFull: Map<string, string[]>
  byLast: Map<string, string[]>
  byFirst: Map<string, string[]>
  byId: Map<string, ScopeAthlete>
}

export const chunkAthleteIds = (ids: string[], size: number): string[][] => {
  if (ids.length === 0 || size <= 0) return []
  if (!Number.isFinite(size) || size >= ids.length) {
    return ids.length >= 2 ? [ids] : []
  }
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks.filter((chunk) => chunk.length >= 2)
}

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const pushIndex = (map: Map<string, string[]>, key: string, id: string) => {
  if (!key) return
  const list = map.get(key)
  if (list) list.push(id)
  else map.set(key, [id])
}

const uniqueIds = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

const singleId = (ids: string[] | undefined): string | null =>
  ids && ids.length === 1 ? ids[0] : null

export const buildAthleteNameIndex = (athletes: ScopeAthlete[]): AthleteNameIndex => {
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
      pushIndex(byFirst, tokens[0], athlete.id)
      pushIndex(byLast, tokens[tokens.length - 1], athlete.id)
    }
  }

  return { byFull, byLast, byFirst, byId }
}

export const resolveAthleteName = (
  rawName: string,
  index: AthleteNameIndex
): string | null => {
  const needle = normalizeText(rawName)
  if (!needle) return null
  return (
    singleId(index.byFull.get(needle)) ??
    singleId(index.byLast.get(needle)) ??
    singleId(index.byFirst.get(needle)) ??
    null
  )
}

export const promptWantsWholeTeam = (prompt: string): boolean => {
  const text = normalizeText(prompt)
  return (
    /\btoute\b.{0,24}\bequipe\b/.test(text) ||
    /\bequipe\b.{0,16}\bentiere\b/.test(text) ||
    /\beffectif\b.{0,16}\bcomplet\b/.test(text) ||
    /\btous\b.{0,24}\b(joueurs|athletes)\b/.test(text) ||
    /\b(joueurs|athletes)\b.{0,24}\btous\b/.test(text) ||
    /\b(all|every|whole|entire|full)\b.{0,40}\b(players?|athletes?|team|squad|roster)\b/.test(
      text
    ) ||
    /\b(players?|athletes?|team|squad|roster)\b.{0,40}\b(all|every|whole|entire|full)\b/.test(
      text
    )
  )
}

const promptWantsCompare = (prompt: string): boolean =>
  /\b(compar(?:e|er|aison)?|vs|versus|side by side|cote a cote)\b/.test(normalizeText(prompt))

const positionMatchKeys = (position: string): string[] => {
  const label = normalizeText(position)
  const keys = new Set<string>()
  if (label.length >= 2) keys.add(label)
  const abbrev = position.match(/\(([^)]+)\)/)
  if (abbrev) {
    const short = normalizeText(abbrev[1])
    if (short.length >= 1) keys.add(short)
  }
  const withoutParen = normalizeText(position.replace(/\([^)]*\)/g, ' '))
  if (withoutParen.length >= 3) keys.add(withoutParen)
  for (const token of withoutParen.split(' ').filter((part) => part.length >= 4)) {
    keys.add(token)
  }
  return [...keys]
}

const hasPhraseOrPlural = (text: string, phrase: string): boolean =>
  new RegExp(`(?:^| )${escapeRegExp(phrase)}(?:e?s|x)?(?: |$)`).test(text)

const ROLE_SYNONYMS: Array<{ aliases: string[]; needles: string[] }> = [
  {
    aliases: ['gardien', 'goalkeeper', 'goalie', 'gk'],
    needles: ['goalkeeper'],
  },
  {
    aliases: ['defenseur', 'defender', 'defence', 'defense', 'arriere'],
    needles: [
      'defender',
      'centre back',
      'center back',
      'full back',
      'wing back',
      'left back',
      'right back',
      'sweeper',
    ],
  },
  {
    aliases: ['lateral', 'full back', 'fullback'],
    needles: ['full back', 'left back', 'right back', 'wing back'],
  },
  {
    aliases: ['milieu defensif', 'defensive midfielder'],
    needles: ['defensive midfielder', 'central defensive midfielder'],
  },
  {
    aliases: ['milieu offensif', 'attacking midfielder', 'meneur de jeu'],
    needles: ['attacking midfielder', 'centre attacking midfielder'],
  },
  {
    aliases: ['milieu central', 'central midfielder'],
    needles: ['central midfielder', 'central midfield', 'centre midfield'],
  },
  {
    aliases: ['milieu', 'midfielder', 'midfield', 'relayeur'],
    needles: ['midfield'],
  },
  {
    aliases: ['attaquant', 'forward', 'attacker'],
    needles: ['forward', 'striker', 'wing', 'attacker'],
  },
  {
    aliases: ['ailier', 'winger'],
    needles: ['wing'],
  },
  {
    aliases: ['buteur', 'striker', 'avant centre'],
    needles: ['striker', 'centre forward'],
  },
  {
    aliases: ['meneur', 'guard'],
    needles: ['guard'],
  },
  {
    aliases: ['pivot', 'center', 'centre'],
    needles: ['center (c)'],
  },
]

const SYNONYM_ALIAS_ENTRIES = ROLE_SYNONYMS.flatMap((role) =>
  role.aliases.map((alias) => ({
    alias: normalizeText(alias),
    needles: role.needles,
  }))
).sort((left, right) => right.alias.length - left.alias.length)

export const promptWantedPositions = (
  prompt: string,
  availablePositions: string[]
): string[] => {
  if (availablePositions.length === 0) return []
  const text = ` ${normalizeText(prompt)} `
  const wanted = new Set<string>()

  const catalog = availablePositions
    .flatMap((position) =>
      positionMatchKeys(position).map((key) => ({ position, key }))
    )
    .sort((left, right) => right.key.length - left.key.length)

  let rest = text
  for (const { position, key } of catalog) {
    if (key.length < 2 || !hasPhraseOrPlural(rest, key)) continue
    wanted.add(position)
    rest = rest.replace(
      new RegExp(`(?:^| )${escapeRegExp(key)}(?:e?s|x)?(?= |$)`, 'g'),
      ' '
    )
  }

  for (const entry of SYNONYM_ALIAS_ENTRIES) {
    if (!hasPhraseOrPlural(rest, entry.alias)) continue
    rest = rest.replace(
      new RegExp(`(?:^| )${escapeRegExp(entry.alias)}(?:e?s|x)?(?= |$)`, 'g'),
      ' '
    )
    for (const position of availablePositions) {
      const label = normalizeText(position)
      if (entry.needles.some((needle) => label.includes(normalizeText(needle)))) {
        wanted.add(position)
      }
    }
  }

  return [...wanted]
}

export const athleteIdsForPositions = (
  athletes: Array<{ id: string; position: string | null }>,
  positions: string[]
): string[] => {
  if (positions.length === 0) return []
  const allowed = new Set(positions)
  return athletes
    .filter((athlete) => athlete.position != null && allowed.has(athlete.position))
    .map((athlete) => athlete.id)
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
    if (last.length < 3 || lastIds.length !== 1 || seen.has(lastIds[0])) continue
    if (!new RegExp(`(?:^| )${last}(?: |$)`).test(text)) continue
    seen.add(lastIds[0])
    ids.push(lastIds[0])
  }

  return ids
}

export const resolvePromptAthleteScope = (
  prompt: string,
  athletes: ScopeAthlete[]
): PromptAthleteScope => {
  const rosterIds = athletes.map((athlete) => athlete.id)

  if (promptWantsWholeTeam(prompt)) {
    const availablePositions = [
      ...new Set(
        athletes
          .map((athlete) => athlete.position)
          .filter((position): position is string => position != null && position.length > 0)
      ),
    ]
    const hasPositionGroups = promptWantedPositions(prompt, availablePositions).length > 0
    return {
      mode: 'team',
      athleteIds: rosterIds,
      forceCover: !hasPositionGroups && rosterIds.length >= 2,
      preferAthleteSplit: rosterIds.length >= 2,
    }
  }

  const availablePositions = [
    ...new Set(
      athletes
        .map((athlete) => athlete.position)
        .filter((position): position is string => position != null && position.length > 0)
    ),
  ]
  const index = buildAthleteNameIndex(athletes)
  const wantedPositions = promptWantedPositions(prompt, availablePositions)
  const positionIds = athleteIdsForPositions(athletes, wantedPositions)
  const namedIds = athletesMentionedInPrompt(prompt, athletes, index)
  const athleteIds = uniqueIds([...namedIds, ...positionIds])

  if (athleteIds.length === 0) {
    return {
      mode: 'none',
      athleteIds: [],
      forceCover: false,
      preferAthleteSplit: false,
    }
  }

  let mode: PromptAthleteScopeMode = 'positions'
  if (namedIds.length > 0 && positionIds.length > 0) mode = 'mixed'
  else if (namedIds.length > 0) mode = 'named'

  const preferAthleteSplit =
    athleteIds.length >= 2 &&
    (mode !== 'named' || promptWantsCompare(prompt) || namedIds.length >= 2)

  return {
    mode,
    athleteIds,
    forceCover: athleteIds.length >= 2,
    preferAthleteSplit,
  }
}

const blocFingerprint = (bloc: ReportBlocSpec): string => {
  const seriesKey = (bloc.series ?? [])
    .map((spec) => `${spec.op}:${[...spec.variables].sort().join('+')}`)
    .sort()
    .join('|')
  const range = bloc.dateRange ? `${bloc.dateRange.from}:${bloc.dateRange.to}` : ''
  return `${bloc.type}|${range}|${seriesKey}`
}

const cloneAthleteSplitBloc = (template: ReportBlocSpec, athleteIds: string[]): ReportBlocSpec => {
  const series = (template.series ?? []).slice(0, REPORT_MAX_COMPARE_VARIABLES).map((spec) => ({
    id: spec.id,
    op: spec.op,
    variables: [...spec.variables],
    ...(spec.label ? { label: spec.label } : {}),
    ...(spec.convert ? { convert: spec.convert } : {}),
    ...(spec.color ? { color: spec.color } : {}),
    ...(spec.dash ? { dash: spec.dash } : {}),
    ...(spec.formula
      ? {
          formula: {
            id: spec.formula.id,
            ...(spec.formula.params ? { params: { ...spec.formula.params } } : {}),
          },
        }
      : {}),
  }))
  return {
    id: randomUUID(),
    type: template.type,
    split: REPORT_BLOC_SPLIT.ATHLETE,
    athleteIds: [...athleteIds],
    series,
    variables: [...new Set(series.flatMap((spec) => spec.variables))],
    ...(template.dateRange ? { dateRange: { ...template.dateRange } } : {}),
  }
}

export const coverAthleteScopeSplits = (
  blocs: ReportBlocSpec[],
  scopeAthleteIds: string[],
  reportDateRange: ReportDateRange,
  forceCover: boolean
): ReportBlocSpec[] => {
  if (!forceCover || scopeAthleteIds.length < 2) return blocs

  const hasAthleteSplit = blocs.some((bloc) => bloc.split === REPORT_BLOC_SPLIT.ATHLETE)
  const hasBar = blocs.some((bloc) => bloc.type === REPORT_BLOC_TYPE.BAR_CHART)
  const shouldCover = (bloc: ReportBlocSpec): boolean => {
    if (bloc.type === REPORT_BLOC_TYPE.TABLE || bloc.type === REPORT_BLOC_TYPE.TEXT) return false
    if (hasAthleteSplit) return bloc.split === REPORT_BLOC_SPLIT.ATHLETE
    if (hasBar) return bloc.type === REPORT_BLOC_TYPE.BAR_CHART
    return WHOLE_TEAM_PROMOTE_TYPES.has(bloc.type)
  }

  const seen = new Set<string>()
  return blocs
    .flatMap((bloc) => {
      if (!shouldCover(bloc)) return [bloc]
      const fingerprint = blocFingerprint(bloc)
      if (seen.has(fingerprint)) return []
      seen.add(fingerprint)
      const range = bloc.dateRange ?? reportDateRange
      const singleValue = isAllReduceSeries(bloc.series ?? [])
      const batches = chunkAthleteIds(
        scopeAthleteIds,
        maxCompareAthletesFor(bloc.type, range.from, range.to, { singleValue })
      )
      return batches.length === 0
        ? [bloc]
        : batches.map((athleteIds) => cloneAthleteSplitBloc(bloc, athleteIds))
    })
    .slice(0, REPORT_STRUCTURE_MAX_BLOCS)
}

export const applyAthleteIdsToBlocs = (
  blocs: ReportBlocSpec[],
  athleteIds: string[],
  preferAthleteSplit: boolean
): ReportBlocSpec[] => {
  if (athleteIds.length === 0 || blocs.length === 0) return blocs
  return blocs.map((bloc) => {
    if (bloc.type === REPORT_BLOC_TYPE.TABLE || bloc.type === REPORT_BLOC_TYPE.TEXT) return bloc
    const split =
      preferAthleteSplit || bloc.split === REPORT_BLOC_SPLIT.ATHLETE || athleteIds.length >= 2
        ? REPORT_BLOC_SPLIT.ATHLETE
        : bloc.split
    return {
      ...bloc,
      split,
      athleteIds: [...athleteIds],
    }
  })
}

export const collectBlocAthleteIds = (blocs: ReportBlocSpec[]): string[] =>
  uniqueIds(blocs.flatMap((bloc) => bloc.athleteIds ?? []))

