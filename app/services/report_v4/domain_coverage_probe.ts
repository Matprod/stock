import db from '@adonisjs/lucid/services/db'
import {
  PREMIUM_DOMAIN,
  PREMIUM_DOMAINS,
  type PremiumDomain,
} from '#constants/premium_report_domains'
import { loadClubSeasons, type ClubSeasonRef } from '#services/report_v4/club_seasons'
import { buildFetchRange, type IsoDateRange } from '#services/report_v4/lookback_range'
import {
  resolvePromptWindows,
  type PromptFetchSpec,
  type PromptWindows,
} from '#services/report_v4/prompt_scope'
import {
  REPORT_V4_COVERAGE_MIN_ATHLETES,
  REPORT_V4_COVERAGE_MIN_DAYS,
} from '#services/report_v4/report_v4_constants'

export type DomainCoverageRow = {
  domain: PremiumDomain
  daysWithData: number
  athletesWithData: number
  populated: boolean
}

export type DomainCoverageReport = {
  dateRange: IsoDateRange
  domains: DomainCoverageRow[]
  populatedDomains: PremiumDomain[]
  emptyDomains: PremiumDomain[]
}

const probeDomainCoverage = async (args: {
  clubId: string
  dateRange: IsoDateRange
  athleteIds: string[]
}): Promise<DomainCoverageReport> => {
  if (args.athleteIds.length === 0) {
    return {
      dateRange: args.dateRange,
      domains: PREMIUM_DOMAINS.map((domain) => ({
        domain,
        daysWithData: 0,
        athletesWithData: 0,
        populated: false,
      })),
      populatedDomains: [],
      emptyDomains: [...PREMIUM_DOMAINS],
    }
  }

  const athletePlaceholders = args.athleteIds.map(() => '?').join(', ')
  const biomarkerBindings = [
    ...args.athleteIds,
    args.dateRange.from,
    args.dateRange.to,
    args.clubId,
  ]
  const injuryBindings = [
    args.clubId,
    ...args.athleteIds,
    args.dateRange.to,
    args.dateRange.from,
  ]
  const bindings: unknown[] = [
    args.clubId,
    args.dateRange.from,
    args.dateRange.to,
    ...args.athleteIds,
    ...injuryBindings,
    ...biomarkerBindings,
    ...biomarkerBindings,
  ]

  const result = await db.rawQuery(
    `
    WITH scoped AS (
      SELECT
        d.id AS day_id,
        d.date_of_day,
        d.athlete_id,
        d.performance_score,
        d.injury_risk_score
      FROM days d
      JOIN athletes a ON a.id = d.athlete_id
      WHERE a.club_id = ?
        AND d.date_of_day BETWEEN ? AND ?
        AND a.id IN (${athletePlaceholders})
    ),
    injury_overlap AS (
      SELECT i.date_of_injury, i.athlete_id
      FROM injuries i
      JOIN athletes a ON a.id = i.athlete_id
      WHERE a.club_id = ?
        AND a.id IN (${athletePlaceholders})
        AND i.date_of_injury IS NOT NULL
        AND i.date_of_injury <= ?
        AND (i.recovery_date IS NULL OR i.recovery_date >= ?)
    )
    SELECT
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          WHERE sa.day_id = s.day_id AND NULLIF(sa.rpe, 0) IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM health_ratings hr
          JOIN health_metric_values hmv ON hmv.health_id = hr.id
          JOIN health_metrics hm ON hm.id = hmv.metric_id
          WHERE hr.day_id = s.day_id
            AND (
              LOWER(hm.name) LIKE '%rpe%'
              OR LOWER(hm.name) LIKE '%exertion%'
              OR LOWER(hm.name) LIKE '%borg%'
              OR LOWER(REPLACE(hm.name, ' ', '_')) LIKE '%effort%'
            )
            AND NULLIF(TRIM(hmv.value), '') IS NOT NULL
        )
      ) AS load_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          WHERE sa.day_id = s.day_id AND NULLIF(sa.rpe, 0) IS NOT NULL
        )
        OR EXISTS (
          SELECT 1 FROM health_ratings hr
          JOIN health_metric_values hmv ON hmv.health_id = hr.id
          JOIN health_metrics hm ON hm.id = hmv.metric_id
          WHERE hr.day_id = s.day_id
            AND (
              LOWER(hm.name) LIKE '%rpe%'
              OR LOWER(hm.name) LIKE '%exertion%'
              OR LOWER(hm.name) LIKE '%borg%'
              OR LOWER(REPLACE(hm.name, ' ', '_')) LIKE '%effort%'
            )
            AND NULLIF(TRIM(hmv.value), '') IS NOT NULL
        )
      ) AS load_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE s.performance_score IS NOT NULL OR s.injury_risk_score IS NOT NULL
      ) AS scores_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE s.performance_score IS NOT NULL OR s.injury_risk_score IS NOT NULL
      ) AS scores_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          JOIN periods p ON p.sport_activity_id = sa.id
          JOIN period_metric_values pmv ON pmv.period_id = p.id
          JOIN period_metrics pm ON pm.id = pmv.metric_id
          WHERE sa.day_id = s.day_id
            AND NULLIF(TRIM(pmv.value::text), '') IS NOT NULL
            AND LOWER(pm.name) NOT LIKE '%accel%'
            AND LOWER(pm.name) NOT LIKE '%decel%'
            AND (
              COALESCE(pm.unit, '') ~* '^(m|km|metre|meter|meters|metres|yd|yard|yards)\\b'
              OR LOWER(pm.name) LIKE '%distance%'
            )
        )
      ) AS gps_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          JOIN periods p ON p.sport_activity_id = sa.id
          JOIN period_metric_values pmv ON pmv.period_id = p.id
          JOIN period_metrics pm ON pm.id = pmv.metric_id
          WHERE sa.day_id = s.day_id
            AND NULLIF(TRIM(pmv.value::text), '') IS NOT NULL
            AND LOWER(pm.name) NOT LIKE '%accel%'
            AND LOWER(pm.name) NOT LIKE '%decel%'
            AND (
              COALESCE(pm.unit, '') ~* '^(m|km|metre|meter|meters|metres|yd|yard|yards)\\b'
              OR LOWER(pm.name) LIKE '%distance%'
            )
        )
      ) AS gps_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          JOIN sport_activity_metric_values samv ON samv.sport_activity_id = sa.id
          WHERE sa.day_id = s.day_id
            AND sa.game_activity = true
            AND NULLIF(TRIM(samv.value::text), '') IS NOT NULL
        )
      ) AS match_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM sport_activities sa
          JOIN sport_activity_metric_values samv ON samv.sport_activity_id = sa.id
          WHERE sa.day_id = s.day_id
            AND sa.game_activity = true
            AND NULLIF(TRIM(samv.value::text), '') IS NOT NULL
        )
      ) AS match_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          WHERE hr.day_id = s.day_id
            AND (
              hr.mood_rating IS NOT NULL
              OR hr.energy_rating IS NOT NULL
              OR hr.stress_rating IS NOT NULL
              OR hr.body_soreness_rating IS NOT NULL
              OR hr.wellbeing_rating IS NOT NULL
            )
        )
      ) AS wellness_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (
          SELECT 1 FROM health_ratings hr
          WHERE hr.day_id = s.day_id
            AND (
              hr.mood_rating IS NOT NULL
              OR hr.energy_rating IS NOT NULL
              OR hr.stress_rating IS NOT NULL
              OR hr.body_soreness_rating IS NOT NULL
              OR hr.wellbeing_rating IS NOT NULL
            )
        )
      ) AS wellness_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM sleeps sl WHERE sl.day_id = s.day_id)
      ) AS sleep_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM sleeps sl WHERE sl.day_id = s.day_id)
      ) AS sleep_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM vald_tests vt WHERE vt.day_id = s.day_id)
      ) AS vald_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM vald_tests vt WHERE vt.day_id = s.day_id)
      ) AS vald_athletes,
      (
        SELECT COUNT(DISTINCT (b.measured_at AT TIME ZONE 'UTC')::date)::int
        FROM biomarkers b
        JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
        WHERE b.athlete_id IN (${athletePlaceholders})
          AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN ? AND ?
          AND (
            NOT EXISTS (
              SELECT 1 FROM biomarker_type_clubs scoped
              WHERE scoped.biomarker_type_id = bt.id
            )
            OR EXISTS (
              SELECT 1 FROM biomarker_type_clubs scoped
              WHERE scoped.biomarker_type_id = bt.id AND scoped.club_id = ?
            )
          )
      ) AS biomarkers_days,
      (
        SELECT COUNT(DISTINCT b.athlete_id)::int
        FROM biomarkers b
        JOIN biomarker_types bt ON bt.id = b.biomarker_type_id
        WHERE b.athlete_id IN (${athletePlaceholders})
          AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN ? AND ?
          AND (
            NOT EXISTS (
              SELECT 1 FROM biomarker_type_clubs scoped
              WHERE scoped.biomarker_type_id = bt.id
            )
            OR EXISTS (
              SELECT 1 FROM biomarker_type_clubs scoped
              WHERE scoped.biomarker_type_id = bt.id AND scoped.club_id = ?
            )
          )
      ) AS biomarkers_athletes,
      (SELECT COUNT(DISTINCT s.date_of_day)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM bodymetrics_histories bh WHERE bh.day_id = s.day_id)
      ) AS body_days,
      (SELECT COUNT(DISTINCT s.athlete_id)::int FROM scoped s
        WHERE EXISTS (SELECT 1 FROM bodymetrics_histories bh WHERE bh.day_id = s.day_id)
      ) AS body_athletes,
      (SELECT COUNT(DISTINCT date_of_injury)::int FROM injury_overlap) AS injury_days,
      (SELECT COUNT(DISTINCT athlete_id)::int FROM injury_overlap) AS injury_athletes
    `,
    bindings
  )

  const row = (result.rows?.[0] ?? result[0] ?? {}) as Record<string, number | string | undefined>

  const read = (key: string): number => Number(row[key] ?? 0) || 0

  const pairs: Array<[PremiumDomain, string, string]> = [
    [PREMIUM_DOMAIN.LOAD, 'load_days', 'load_athletes'],
    [PREMIUM_DOMAIN.GPS, 'gps_days', 'gps_athletes'],
    [PREMIUM_DOMAIN.MATCH, 'match_days', 'match_athletes'],
    [PREMIUM_DOMAIN.WELLNESS, 'wellness_days', 'wellness_athletes'],
    [PREMIUM_DOMAIN.SLEEP, 'sleep_days', 'sleep_athletes'],
    [PREMIUM_DOMAIN.VALD, 'vald_days', 'vald_athletes'],
    [PREMIUM_DOMAIN.BIOMARKERS, 'biomarkers_days', 'biomarkers_athletes'],
    [PREMIUM_DOMAIN.BODY, 'body_days', 'body_athletes'],
    [PREMIUM_DOMAIN.SCORES, 'scores_days', 'scores_athletes'],
    [PREMIUM_DOMAIN.INJURY, 'injury_days', 'injury_athletes'],
  ]

  const domains: DomainCoverageRow[] = pairs.map(([domain, daysKey, athletesKey]) => {
    const daysWithData = read(daysKey)
    const athletesWithData = read(athletesKey)
    return {
      domain,
      daysWithData,
      athletesWithData,
      populated:
        daysWithData >= REPORT_V4_COVERAGE_MIN_DAYS &&
        athletesWithData >= REPORT_V4_COVERAGE_MIN_ATHLETES,
    }
  })

  const populatedDomains = domains.filter((d) => d.populated).map((d) => d.domain)
  const emptyDomains = domains.filter((d) => !d.populated).map((d) => d.domain)

  return {
    dateRange: args.dateRange,
    domains,
    populatedDomains,
    emptyDomains,
  }
}

const overlayScopedDomainWindows = async (args: {
  clubId: string
  athleteIds: string[]
  displayRange: IsoDateRange
  domainRanges: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
  coverage: DomainCoverageReport
}): Promise<DomainCoverageReport> => {
  let coverage = args.coverage
  const scopedJobs: Array<{ domain: string; range: IsoDateRange }> = []
  if (args.fetches?.length) {
    for (const fetch of args.fetches) {
      if (fetch.from === args.displayRange.from && fetch.to === args.displayRange.to) continue
      const dup = scopedJobs.some(
        (job) =>
          job.domain === fetch.domain && job.range.from === fetch.from && job.range.to === fetch.to
      )
      if (!dup) scopedJobs.push({ domain: fetch.domain, range: { from: fetch.from, to: fetch.to } })
    }
  } else {
    for (const [domain, range] of Object.entries(args.domainRanges)) {
      if (!range || (range.from === args.displayRange.from && range.to === args.displayRange.to)) {
        continue
      }
      scopedJobs.push({ domain, range })
    }
  }

  for (const job of scopedJobs) {
    const scoped = await probeDomainCoverage({
      clubId: args.clubId,
      dateRange: job.range,
      athleteIds: args.athleteIds,
    })
    const scopedRow = scoped.domains.find((row) => row.domain === job.domain)
    if (!scopedRow) continue
    const domains = coverage.domains.map((row) => {
      if (row.domain !== job.domain) return row
      if (!row.populated && scopedRow.populated) return scopedRow
      if (row.populated && scopedRow.populated) {
        return {
          ...row,
          daysWithData: Math.max(row.daysWithData, scopedRow.daysWithData),
          athletesWithData: Math.max(row.athletesWithData, scopedRow.athletesWithData),
          populated: true,
        }
      }
      return row
    })
    coverage = {
      ...coverage,
      domains,
      populatedDomains: domains.filter((row) => row.populated).map((row) => row.domain),
      emptyDomains: domains.filter((row) => !row.populated).map((row) => row.domain),
    }
  }
  return coverage
}

export type ReportV4CoverageView = {
  displayRange: IsoDateRange
  fetchRange: IsoDateRange
  domainRanges: PromptWindows['byDomain']
  fetches?: PromptFetchSpec[]
  domains: DomainCoverageRow[]
  populatedDomains: PremiumDomain[]
  emptyDomains: PremiumDomain[]
}

const probeCoverageForWindows = async (args: {
  clubId: string
  athleteIds: string[]
  displayRange: IsoDateRange
  domainRanges: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
}): Promise<DomainCoverageReport> =>
  overlayScopedDomainWindows({
    clubId: args.clubId,
    athleteIds: args.athleteIds,
    displayRange: args.displayRange,
    domainRanges: args.domainRanges,
    fetches: args.fetches,
    coverage: await probeDomainCoverage({
      clubId: args.clubId,
      dateRange: args.displayRange,
      athleteIds: args.athleteIds,
    }),
  })

/**
 * Coverage probe for windows already resolved by generate (no Haiku).
 * When windows are omitted (standalone /coverage API), uses the sync regex parser — never Haiku.
 */
export const resolveFullCoverage = async (args: {
  clubId: string
  prompt: string
  athleteIds: string[]
  displayRange?: IsoDateRange
  domainRanges?: Partial<Record<string, IsoDateRange | undefined>>
  fetches?: PromptFetchSpec[]
  seasons?: ClubSeasonRef[]
}): Promise<ReportV4CoverageView> => {
  const needSyncWindows = !(args.displayRange && args.domainRanges != null)
  const seasons = needSyncWindows ? (args.seasons ?? (await loadClubSeasons(args.clubId))) : []
  const windows = needSyncWindows ? resolvePromptWindows(args.prompt, undefined, seasons) : null
  const displayRange = args.displayRange ?? windows?.display
  if (!displayRange) throw new Error('resolveFullCoverage: missing displayRange')
  const domainRanges = args.domainRanges ?? windows?.byDomain ?? {}
  const fetches = args.fetches ?? windows?.fetches
  const fetchRange = buildFetchRange(domainRanges.load ?? displayRange)
  const coverage = await probeCoverageForWindows({
    clubId: args.clubId,
    athleteIds: args.athleteIds,
    displayRange,
    domainRanges,
    fetches,
  })
  return {
    displayRange,
    fetchRange,
    domainRanges,
    fetches,
    domains: coverage.domains,
    populatedDomains: coverage.populatedDomains,
    emptyDomains: coverage.emptyDomains,
  }
}
