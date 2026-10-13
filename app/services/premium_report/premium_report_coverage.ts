import db from '@adonisjs/lucid/services/db'
import {
  PREMIUM_REPORT_MIN_ATHLETES_WITH_DATA,
  PREMIUM_REPORT_MIN_DAYS_WITH_DATA,
} from '#constants/premium_report.constants'
import type { PremiumReportDateRange } from '#contracts/premium_report'
import type { AppLanguage } from '#utils/localize'

export type PremiumCoverage = {
  daysWithData: number
  athletesWithData: number
  minDays: number
  minAthletes: number
}

export const probePremiumCoverage = async (args: {
  clubId: string
  dateRange: PremiumReportDateRange
  athleteIds: string[]
}): Promise<PremiumCoverage> => {
  const minAthletes = Math.min(
    PREMIUM_REPORT_MIN_ATHLETES_WITH_DATA,
    Math.max(1, args.athleteIds.length)
  )
  if (args.athleteIds.length === 0) {
    return {
      daysWithData: 0,
      athletesWithData: 0,
      minDays: PREMIUM_REPORT_MIN_DAYS_WITH_DATA,
      minAthletes,
    }
  }

  const bindings: unknown[] = [args.clubId, args.dateRange.from, args.dateRange.to]
  const athletePlaceholders = args.athleteIds.map(() => '?').join(', ')
  bindings.push(...args.athleteIds)

  const result = await db.rawQuery(
    `
    SELECT
      COUNT(DISTINCT d.date_of_day)::int AS days_with_data,
      COUNT(DISTINCT d.athlete_id)::int AS athletes_with_data
    FROM days d
    JOIN athletes a ON a.id = d.athlete_id
    WHERE a.club_id = ?
      AND d.date_of_day BETWEEN ? AND ?
      AND a.id IN (${athletePlaceholders})
      AND (
        EXISTS (SELECT 1 FROM sport_activities sa WHERE sa.day_id = d.id)
        OR EXISTS (SELECT 1 FROM health_ratings hr WHERE hr.day_id = d.id)
        OR EXISTS (SELECT 1 FROM sleeps s WHERE s.day_id = d.id)
        OR EXISTS (SELECT 1 FROM vald_tests vt WHERE vt.day_id = d.id)
        OR EXISTS (SELECT 1 FROM bodymetrics_histories bh WHERE bh.day_id = d.id)
        OR EXISTS (
          SELECT 1 FROM biomarkers b
          WHERE b.athlete_id = d.athlete_id
            AND (b.measured_at AT TIME ZONE 'UTC')::date = d.date_of_day
        )
      )
    `,
    bindings
  )

  const row = (result.rows?.[0] ?? result[0] ?? {}) as {
    days_with_data?: number | string
    athletes_with_data?: number | string
  }

  return {
    daysWithData: Number(row.days_with_data ?? 0) || 0,
    athletesWithData: Number(row.athletes_with_data ?? 0) || 0,
    minDays: PREMIUM_REPORT_MIN_DAYS_WITH_DATA,
    minAthletes,
  }
}

export const isSparseCoverage = (coverage: PremiumCoverage): boolean =>
  coverage.daysWithData < coverage.minDays ||
  coverage.athletesWithData < coverage.minAthletes

export const sparseDataMessage = (
  language: AppLanguage,
  coverage: PremiumCoverage,
  dateRange: PremiumReportDateRange
): string => {
  const { from, to } = dateRange
  if (coverage.daysWithData === 0) {
    return language === 'fr'
      ? `Sur la période du ${from} au ${to}, aucune donnée (entraînement, wellness, sommeil, VALD, biomarqueurs ou composition) n'est disponible pour ce groupe. Élargis la période ou vérifie le périmètre joueurs.`
      : `For ${from} → ${to}, no training, wellness, sleep, VALD, biomarker, or body data is available for this group. Widen the period or check the player scope.`
  }
  return language === 'fr'
    ? `Sur la période du ${from} au ${to}, on ne dispose que de ${coverage.daysWithData} jour(s) et ${coverage.athletesWithData} joueur(s) avec des données (minimum utile : ${coverage.minDays} jours, ${coverage.minAthletes} joueur(s)). Élargis la période ou le groupe pour générer un rapport utile.`
    : `For ${from} → ${to}, only ${coverage.daysWithData} day(s) and ${coverage.athletesWithData} player(s) have data (useful minimum: ${coverage.minDays} days, ${coverage.minAthletes} player(s)). Widen the period or group to generate a useful report.`
}
