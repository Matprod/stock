import Athlete from '#models_pg/athlete'
import S3Service from '#services/s3_service'
import { storeDataset } from '#services/premium_report/dataset_ops'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log'
import {
  REPORT_V4_MAX_INLINE_PHOTOS,
  REPORT_V4_PRESIGN_CONCURRENCY,
} from '#services/report_v4/report_v4_constants'
import type { ReportBrief } from '#services/report_v4/report_brief'

export type RosterAthlete = {
  id: string
  name: string
  position: string
  photoUrl: string | null
  photoKey: string | null
  startDate?: string
  endDate?: string | null
}

export type RosterActiveRange = { from: string; to: string }

const isoDay = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim().slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
  }
  if (typeof value === 'object' && value !== null && 'toISODate' in value) {
    const iso = (value as { toISODate: () => string | null }).toISODate()
    return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
  }
  return null
}

const athleteOverlapsRange = (
  athlete: { startDate?: string | null; endDate?: string | null },
  range: RosterActiveRange
): boolean => {
  const start = athlete.startDate?.trim() || '1970-01-01'
  const end = athlete.endDate?.trim() || null
  if (start > range.to) return false
  if (end && end < range.from) return false
  return true
}

const athleteOverlapsAnyRange = (
  athlete: { startDate?: string | null; endDate?: string | null },
  ranges: RosterActiveRange[]
): boolean => {
  if (ranges.length === 0) return true
  return ranges.some((range) => athleteOverlapsRange(athlete, range))
}

const foldName = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

const mapPool = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

export const collectInsightAthleteNames = (brief: ReportBrief | null | undefined): string[] => {
  if (!brief) return []
  const names: string[] = []
  for (const signal of brief.signals) {
    if (signal.athlete?.trim()) names.push(signal.athlete.trim())
  }
  for (const section of brief.sections) {
    if (section.athleteName?.trim()) names.push(section.athleteName.trim())
  }
  return [...new Set(names)]
}

const matchRosterByNames = (
  roster: RosterAthlete[],
  athleteNames: string[]
): RosterAthlete[] => {
  if (!athleteNames.length) return []
  const wanted = new Set(athleteNames.map(foldName).filter(Boolean))
  const hits: RosterAthlete[] = []
  for (const row of roster) {
    if (!row.photoKey) continue
    if (!wanted.has(foldName(row.name))) continue
    hits.push(row)
    if (hits.length >= REPORT_V4_MAX_INLINE_PHOTOS) break
  }
  return hits
}

export const resolveInsightRosterPhotos = async (args: {
  roster: RosterAthlete[]
  athleteNames: string[]
}): Promise<RosterAthlete[]> => {
  const targets = matchRosterByNames(args.roster, args.athleteNames)
  if (targets.length === 0) {
    return args.roster.map((row) => ({ ...row, photoUrl: null }))
  }
  const s3 = new S3Service()
  const urlById = new Map<string, string | null>()
  await mapPool(targets, REPORT_V4_PRESIGN_CONCURRENCY, async (row) => {
    const key = row.photoKey
    if (!key) {
      urlById.set(row.id, null)
      return
    }
    try {
      urlById.set(row.id, await s3.getPresignedReadUrl(key, 3600))
    } catch {
      urlById.set(row.id, null)
    }
  })
  const allowed = new Set(targets.map((row) => row.id))
  return args.roster.map((row) => ({
    ...row,
    photoUrl: allowed.has(row.id) ? (urlById.get(row.id) ?? null) : null,
    photoKey: allowed.has(row.id) ? row.photoKey : null,
  }))
}

export const applySignedPhotosInHtml = (
  html: string,
  roster: RosterAthlete[]
): { html: string; applied: number } => {
  if (!html.trim()) return { html, applied: 0 }
  const s3 = new S3Service()
  let next = html
  let applied = 0
  for (const row of roster) {
    const signed = row.photoUrl?.startsWith('http') ? row.photoUrl : null
    if (!signed || !row.photoKey) continue
    const originals = [s3.publicUrl(row.photoKey)].filter(Boolean)
    let touched = false
    for (const src of originals) {
      if (!next.includes(src)) continue
      next = next.split(src).join(signed)
      touched = true
    }
    if (touched) applied += 1
  }
  return { html: next, applied }
}

export const loadClubRoster = async (
  clubId: string,
  opts?: { activeRanges?: RosterActiveRange[] }
): Promise<RosterAthlete[]> => {
  const rows = await Athlete.query()
    .where('clubId', clubId)
    .preload('playerPosition')
    .preload('profilePicture')
    .select('id', 'firstName', 'lastName', 'playerPositionId', 'startDate', 'endDate')
    .orderBy('lastName', 'asc')

  const mapped = rows.map((row) => {
    const name = `${row.firstName} ${row.lastName}`.replace(/\s+/g, ' ').trim()
    const key = row.profilePicture?.key ?? null
    return {
      id: row.id,
      name,
      position: row.playerPosition?.name?.trim() || '—',
      photoUrl: null,
      photoKey: key,
      startDate: isoDay(row.startDate) ?? undefined,
      endDate: isoDay(row.endDate),
    }
  })

  const ranges = opts?.activeRanges?.filter((range) => range.from && range.to) ?? []
  if (ranges.length === 0) return mapped
  return mapped.filter((row) => athleteOverlapsAnyRange(row, ranges))
}

export const createRosterMacroTool = (args: {
  state: PremiumReportState
  roster: RosterAthlete[]
}): PremiumTool => ({
  schema: {
    name: 'fetch_club_roster',
    description:
      'Club roster active in the report windows: athlete id, name, position (startDate/endDate filtered server-side). Prefer this over inventing SQL for athletes/positions. Photos are not exposed here.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  execute: async () => {
    const started = Date.now()
    const rows = args.roster.map((row) => ({
      athlete_id: row.id,
      joueur: row.name,
      poste: row.position,
    }))
    const dataset = storeDataset(args.state, {
      id: 'roster',
      columns: ['athlete_id', 'joueur', 'poste'],
      rows,
    })
    logPremiumTool({
      tool: 'fetch_club_roster',
      ok: true,
      durationSec: elapsedSec(started),
      detail: `n=${rows.length}`,
    })
    return JSON.stringify({
      ok: true,
      datasetId: dataset.id,
      columns: dataset.columns,
      rowCount: rows.length,
      sample: rows.slice(0, 5),
    })
  },
})
