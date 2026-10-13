import db from '@adonisjs/lucid/services/db'
import type { AppLanguage } from '#utils/localize'
import { escapeHtml } from '#services/report_v4/report_v4_constants'

export type ClubInsightScience = {
  insightId: string
  variableName: string
  name: string
  description: string
  meanAbsImportance: number | null
  sampleDays: number
}

type InsightScienceRow = {
  id: string
  variable_name: string
  name: string
  description: string | null
  mean_abs: string | number | null
  sample_days: string | number | null
}

const STAFF_DRIVER_LIMIT = 5
const ANALYST_DRIVER_LIMIT = 8
const STAFF_DESC_MAX = 120
const ANALYST_DESC_MAX = 160

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export const truncateInsightScience = (text: string, max: number): string => {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, Math.max(0, max - 1))
  const at = cut.lastIndexOf(' ')
  const base = (at > Math.floor(max * 0.55) ? cut.slice(0, at) : cut).trim()
  return `${base}…`
}

export const loadClubInsightScience = async (args: {
  clubId: string
  dateRange?: { from: string; to: string }
  limit?: number
}): Promise<ClubInsightScience[]> => {
  const limit = Math.min(Math.max(args.limit ?? 12, 1), 24)

  const linkedInsightIds = (
    (await db.from('club_insights').where('club_id', args.clubId).select('insight_id')) as Array<{
      insight_id: string
    }>
  ).map((row) => row.insight_id)

  const query = db
    .from('insights as i')
    .leftJoin('feature_importances as fi', 'fi.insight_id', 'i.id')
    .leftJoin('days as d', 'd.id', 'fi.day_id')
    .leftJoin('athletes as a', 'a.id', 'd.athlete_id')
    .where((builder) => {
      if (linkedInsightIds.length > 0) {
        builder.whereIn('i.id', linkedInsightIds)
      } else {
        builder.where('a.club_id', args.clubId)
      }
    })
    .groupBy('i.id', 'i.variable_name', 'i.name', 'i.description')
    .orderByRaw('avg(abs(fi.value)) desc nulls last')
    .orderBy('i.name')
    .limit(limit)
    .select(
      'i.id',
      'i.variable_name',
      'i.name',
      'i.description',
      db.raw('avg(abs(fi.value)) as mean_abs'),
      db.raw('count(distinct fi.day_id) as sample_days')
    )

  if (args.dateRange) {
    query.where((builder) => {
      builder.whereNull('d.date_of_day').orWhereBetween('d.date_of_day', [
        args.dateRange!.from,
        args.dateRange!.to,
      ])
    })
  }

  if (linkedInsightIds.length === 0) {
    query.whereNotNull('fi.value')
  }

  const rows = (await query) as InsightScienceRow[]

  return rows
    .map((row) => ({
      insightId: row.id,
      variableName: row.variable_name,
      name: row.name?.trim() || row.variable_name,
      description: (row.description ?? '').trim(),
      meanAbsImportance: toNumber(row.mean_abs),
      sampleDays: Math.max(0, Math.round(toNumber(row.sample_days) ?? 0)),
    }))
    .filter((row) => row.name.length > 0)
}

export const formatClubInsightScienceAnalystHint = (
  insights: ClubInsightScience[]
): string | undefined => {
  if (!insights.length) return undefined
  const lines = insights.slice(0, ANALYST_DRIVER_LIMIT).map((row) => {
    const science = truncateInsightScience(
      row.description || 'No science text stored for this insight.',
      ANALYST_DESC_MAX
    )
    const weight =
      row.meanAbsImportance !== null
        ? ` mean_|importance|=${row.meanAbsImportance.toFixed(3)} over ${row.sampleDays} day(s)`
        : ''
    return `- ${row.name} (${row.variableName})${weight}: ${science}`
  })
  return [
    '## Club insight science (dynamic — this club only)',
    'Authoritative mechanism notes ranked by recent feature importance when available.',
    'Ground load / wellness / injury-risk interpretation with these drivers. Never invent alternate physiology.',
    'Staff prose: ONE short drivers panel (top 3–5 one-liners). FORBIDDEN: multi-section walls that paste full science paragraphs, duplicate staff-panel text, or invent separate "Top drivers / Subjective drivers / Explosive drivers / Linking drivers" chapters.',
    'Never expose variable_name / internal ids in staff-facing prose — use the human name only.',
    ...lines,
  ].join('\n')
}

export const renderClubInsightScienceStaffPanel = (
  insights: ClubInsightScience[],
  language: AppLanguage
): string => {
  if (!insights.length) return ''
  const fr = language === 'fr'
  const title = fr ? 'Leviers & science club' : 'Club drivers & science'
  const items = insights
    .filter((row) => row.description.length > 0)
    .slice(0, STAFF_DRIVER_LIMIT)
    .map((row) => {
      const weight =
        row.meanAbsImportance !== null && row.sampleDays > 0
          ? `<span class="kind">${fr ? 'poids récent' : 'recent weight'} ${row.meanAbsImportance.toFixed(2)}</span>`
          : ''
      const blurb = truncateInsightScience(row.description, STAFF_DESC_MAX)
      return `<li><div class="insight-science-head"><span>${escapeHtml(row.name)}</span>${weight}</div><p>${escapeHtml(blurb)}</p></li>`
    })
    .join('')
  if (!items) return ''
  return `<div class="staff-read-panel staff-insight-science"><h3>${title}</h3><ul class="insight-science-list">${items}</ul></div>`
}
