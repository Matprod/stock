type WellnessSleepSqlArgs = {
  clubId: string
  from: string
  to: string
  athleteIds?: string[]
}

const athleteFilter = (athleteIds?: string[]): string => {
  if (!athleteIds?.length) return ''
  return ` AND a.id IN (${athleteIds.map((id) => `'${id}'`).join(',')})`
}

const clubDateWhere = (args: WellnessSleepSqlArgs): string =>
  `a.club_id = '${args.clubId}'
  AND d.date_of_day BETWEEN '${args.from}'::date AND '${args.to}'::date
  ${athleteFilter(args.athleteIds)}`

export const sqlWellnessDaily = (args: WellnessSleepSqlArgs): string =>
  `
SELECT
  d.date_of_day,
  TRIM(CONCAT(a.first_name, ' ', a.last_name)) AS joueur,
  hr.body_soreness_rating,
  hr.energy_rating,
  hr.mood_rating,
  hr.stress_rating,
  hr.wellbeing_rating
FROM health_ratings hr
JOIN days d ON d.id = hr.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE ${clubDateWhere(args)}
ORDER BY joueur, d.date_of_day
`.trim()

export const sqlSleepDaily = (args: WellnessSleepSqlArgs): string =>
  `
SELECT
  d.date_of_day,
  TRIM(CONCAT(a.first_name, ' ', a.last_name)) AS joueur,
  s.quality_rating,
  s.sleep_efficiency_percentage,
  s.sleep_consistency_percentage,
  ROUND((s.total_in_bed_time_milli / 3600000.0)::numeric, 2) AS hours_in_bed,
  ROUND((s.total_slow_wave_sleep_time_milli / 3600000.0)::numeric, 2) AS hours_slow_wave,
  ROUND((s.total_rem_sleep_time_milli / 3600000.0)::numeric, 2) AS hours_rem,
  ROUND((s.total_awake_time_milli / 3600000.0)::numeric, 2) AS hours_awake
FROM sleeps s
JOIN days d ON d.id = s.day_id
JOIN athletes a ON a.id = d.athlete_id
WHERE ${clubDateWhere(args)}
ORDER BY joueur, d.date_of_day
`.trim()
