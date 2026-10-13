import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatStaffNumber } from '#services/report_v4/staff_render/format'
import { mean, seriesTrend } from '#services/report_v4/staff_render/svg_scale'

export type HambourgFixture = {
  window: { start: string; end: string }
  days: string[]
  scores: {
    performance: Record<string, number[]>
    injury_risk: Record<string, number[]>
  }
  gps_by_position: Array<{
    position: string
    n: number
    total_distance_m: number | null
    hmld_m: number | null
    hsr: number | null
    explosive: number | null
    excluded?: string
  }>
  gps_sessions: Record<
    string,
    {
      position: string
      sessions: Array<{
        date: string
        distance: number
        hmld: number
        hsr: number
        explosive: number
      }>
    }
  >
  kpi_reported: {
    mean_performance: number
    mean_injury_risk: number
    mean_total_distance_m: number
  }
  wellness: {
    window: [string, string]
    body_soreness_mean: number
    mood_mean: number
    scale_max: number
    lower_is_better: boolean
    missing: string[]
  }
  sleep: {
    window: [string, string]
    available: string[]
    missing: string[]
  }
  biomarkers: {
    cmj: { date: string; measurements: number }
    vald: null
    ck: { measurements: number; month: string; outside_requested_window: boolean }
  }
  feature_importances_order: string[]
  injuries_clinical: { count: number; status: string }
  players_gps: number
  players_scored: number
}

const fixturePath = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), '../../../../hambourg-fixture.json')

export const loadHambourgFixture = (): HambourgFixture =>
  JSON.parse(readFileSync(fixturePath(), 'utf8')) as HambourgFixture

export const athleteMean = (values: number[]): number => mean(values) ?? 0

export const dayLabelsShort = (days: string[]): string[] =>
  days.map((iso) => {
    const day = iso.slice(8, 10)
    const month = iso.slice(5, 7)
    return `${Number(day)}/${month}`
  })

export const topRiskAthletes = (
  fixture: HambourgFixture,
  limit = 2
): Array<{ name: string; values: number[]; mean: number; trend: ReturnType<typeof seriesTrend> }> =>
  Object.entries(fixture.scores.injury_risk)
    .map(([name, values]) => ({
      name,
      values,
      mean: athleteMean(values),
      trend: seriesTrend(values),
    }))
    .sort((a, b) => b.mean - a.mean)
    .slice(0, limit)

export const teamDailyMeans = (
  byAthlete: Record<string, number[]>
): Array<number | null> => {
  const length = Object.values(byAthlete)[0]?.length ?? 0
  return Array.from({ length }, (_, dayIndex) => {
    const nums = Object.values(byAthlete)
      .map((series) => series[dayIndex])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    return mean(nums)
  })
}

export const formatKpi = (value: number, digits = 1): string =>
  formatStaffNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? 0 : 0 })
