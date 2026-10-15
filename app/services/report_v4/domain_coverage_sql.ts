export const buildDomainCoverageSql = (athletePlaceholders: string): string => `
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
    `
