# Mauna Database — Schema Documentation (PostgreSQL)

This file describes the business meaning of each table, join paths, and when to use them.
The agent uses the **Keywords** line to decide which domains are relevant to a question.

**Database:** PostgreSQL. All primary keys are UUIDs (strings). Use PostgreSQL date syntax:
`date_col >= 'YYYY-MM-DD'::date - INTERVAL '7 days'` (not MySQL `DATE_SUB` / `CURDATE()`).

**Translations:** Reference entities (injury_types, pain_discomfort_locations, activities, player_positions, sports, injury_sections) store display names in the `translations` table:
`translations.translatable_id = <entity>.id AND translations.translatable_type = '<type>' AND translations.language IN ('fr','en') AND translations.key = '<key>'`.

**Legacy column renames (MySQL → PostgreSQL):**

- `athlete_day_id` → `day_id`
- `date_added` / `date_updated` → `created_at` / `updated_at`
- `base_athlete` → `athletes`, `base_athleteday` → `days`, `sleep_sleep` → `sleeps`, `health_health` → `health_ratings`

---

## Domain: Athlete Identity

**Keywords:** athlete, player, user, who, profile, name, club, team, list, all athletes, equipe, joueur, profil, position, jersey, height, weight body, age, birth, gender, sport, active, inactive
**Tables:** athletes, sports, player_positions

### athletes

Core athlete profile. Every other table links back to this one.

```
id (uuid), first_name, last_name, email,
birth_date, height_cm, weight_kg, gender,
club_id, player_position_id → player_positions.id, jersey_number,
start_date, end_date,
fc_max, fc_min, fat_percentage, app_language,
created_at, updated_at
```

**Join:** standalone — other tables join TO athletes

### sports

Sport reference. Display name via `translations` (`translatable_type = 'sport'`, `key = 'sport_name'`).

```
id, name, created_at, updated_at
```

### player_positions

Athlete position reference (e.g. Forward, Goalkeeper). Resolve `athletes.player_position_id` via this table. Display name via `translations` (`translatable_type = 'player_position'`, `key = 'player_position_name'`).

```
id, name, sport_id → sports.id, created_at, updated_at
```

---

## Domain: Daily Scores

**Keywords:** score, performance score, health score, activity score, sleep score, injury score, injury risk, risque, risque blessure, blessure, daily, day, today, date, prediction, overall, global, jours, quotidien, performance du jour, overall score
**Tables:** days

### days

One row per athlete per day. Central hub — most tables join through this one.

```
id (uuid), date_of_day, athlete_id,
performance_score (0-100),
injury_risk_score (0-100, higher = more injury risk),
created_at, updated_at
```

**IMPORTANT — Score columns on `days`:**

- `performance_score` = overall performance score (0-100, higher = better). "High performance" uses this club's `club_settings.performance_high` — never treat that number as an injury threshold.
- `injury_risk_score` = injury risk score (0-100, higher = worse / more at risk). "High injury risk" / "injury high" = this club's `club_settings.injury_high` (e.g. 40), compared with `d.injury_risk_score >= injury_high`. Do not use 70 unless the user typed 70.
- Sub-domain scores (health, sleep, activity) are **not** columns on `days`. Query raw data from `health_ratings`, `sleeps`, `sport_activities`, or pivot `day_metric_values` when a named metric exists in `day_metrics`.

**Join:** days.athlete_id → athletes.id
**Note:** Filter by period: `d.date_of_day >= 'YYYY-MM-DD'::date - INTERVAL '1 month'`

---

## Domain: Detailed Daily Averages

**Keywords:** average, ewma, trend, training load, acwr, nutrition average, macro average, sleep debt, hrv average, rhr average, recovery score, consistency, efficiency, detail, computed, load ratio
**Tables:** day_metrics, day_metric_values

### day_metrics

Reference catalogue of computed daily metrics (training load, ACWR, sleep debt, EWMA values, etc.).

```
id, name, description, unit, data_type, created_at, updated_at
```

### day_metric_values

Pivot table storing computed metric values per day. One row per (day, metric) pair.

```
id, day_id → days.id, metric_id → day_metrics.id,
value (string — cast to numeric for aggregations),
created_at, updated_at
```

**Join:** day_metric_values.day_id → days.id → athletes
**Query pattern:**

```sql
SELECT d.date_of_day, dm.name, CAST(dmv.value AS DECIMAL) AS metric_value
FROM day_metric_values dmv
JOIN day_metrics dm ON dmv.metric_id = dm.id
JOIN days d ON dmv.day_id = d.id
WHERE dm.name = 'training_load'
```

---

## Domain: Health & Wellness

**Keywords:** feeling, soreness, body soreness, body rpe, energy, mood, stress, wellness, health, recovery, heart rate, hrv, resting heart rate, rhr, tired, fatigue, weight, cigarette, travel, comment se sent, bien-être, récupération, forme, pain location, douleur localisée, rpe, effort, perceived exertion, training_rpe, pre_training_rpe, post_training_rpe, sap, sportsone
**Tables:** health_ratings, health_pains, health_metric_values, health_metrics, travels

### health_ratings

Daily subjective wellness data filled by the athlete.
Hub for daily health: `health_pains`, `health_metric_values`, and `travels` all join through `health_ratings.id`.

```
id, day_id,
body_soreness_rating, energy_rating, mood_rating, stress_rating,
created_at, updated_at
```

**Scale ranges:** do NOT hardcode 1-10. Use the **Club subjective scale configuration** block when present (e.g. some clubs use 10–60). Schema comments saying 1-10 are legacy defaults only.

**Query aliases:** user may say "body soreness", "RPE Body", "body RPE", "RPE corps", "courbatures" — these all map to `health_ratings.body_soreness_rating` (not `sport_activities.rpe`, not a `health_metrics` `*_rpe` name unless the club catalogue lists a separate metric).
**Output wording:** ALWAYS use the club catalogue label for this field in answers and chart titles. Never invent a nickname; never force "RPE Body" unless that is the club label.

**Join:** health_ratings.day_id → days.id → days.athlete_id → athletes.id

### health_pains

Pain ratings per body location linked to a health entry.

```
id, health_id → health_ratings.id,
location_id → pain_discomfort_locations.id,
rating (pain intensity 1–5, higher = more pain; NOT NULL — always SELECT hp.rating), created_at, updated_at
```

### health_metric_values

Extended health metrics (resting heart rate, HRV, recovery score, weight, club-specific SAP/RPE fields, etc.) stored as EAV.

**RPE for some clubs (e.g. Hamburg / SAP SportsOne) lives HERE**, not in `sport_activities.rpe`.
Typical `hm.name`: `training_rpe`, `pre_training_rpe`, `post_training_rpe`, `at_it_rt_rpe`.
When the user asks for **session / training RPE** / perceived exertion: first check **CLUB HEALTH METRICS**; if names like `*_rpe` appear, query `health_metric_values`. When they ask for **body soreness / "RPE Body" / body RPE**, use `health_ratings.body_soreness_rating` (same-day wellness) and answer with the club catalogue label. Only fall back to `sport_activities.rpe` when health EAV has no session-RPE metrics.

Metric names come from **CLUB HEALTH METRICS** — do not invent. Prefer `hm.name` / `hm.unit` (never hardcode conversions). `value` is a string → `CAST(... AS DECIMAL)` when numeric.

```
health_metrics: id, name, display_name, description, unit, data_type, created_at, updated_at
health_metric_values: id, health_id → health_ratings.id, metric_id → health_metrics.id,
value (string), created_at, updated_at
```

**Join:** health_metric_values.health_id → health_ratings.id → days.id → athletes.id ; catalogue: health_metric_values.metric_id → health_metrics.id

```sql
SELECT ad.date_of_day, hm.name, hm.unit, CAST(hmv.value AS DECIMAL) AS value
FROM health_metric_values hmv
JOIN health_metrics hm ON hmv.metric_id = hm.id
JOIN health_ratings hr ON hmv.health_id = hr.id
JOIN days ad ON hr.day_id = ad.id
JOIN athletes a ON ad.athlete_id = a.id
WHERE a.club_id = ? AND hm.name IN (/* CLUB HEALTH METRICS */)
ORDER BY ad.date_of_day DESC
LIMIT 100
```

### travels

Travel records linked to a health entry.

```
id, health_id → health_ratings.id, event_id,
mean_of_transport, duration_minutes, created_at, updated_at
```

**Join:** travels.health_id → health_ratings.id → days.id → athletes

---

## Domain: Sleep

**Keywords:** sleep, sommeil, nuit, rest, bedtime, wake up, rem, slow wave, deep sleep, efficiency, consistency, nap, duration, hours, sleep quality, insomnia, fatigue nocturne, temps de sommeil
**Tables:** sleeps

### sleeps

Nightly sleep tracking data (from watch/device).

```
id, day_id,
bedtime_date, wake_up_date,
quality_rating (club scale — see subjective scale config; not always 1-10),
sleep_efficiency_percentage,
sleep_consistency_percentage,
need_from_sleep_debt_milli,
total_slow_wave_sleep_time_milli (deep sleep in ms),
total_rem_sleep_time_milli (in ms),
total_in_bed_time_milli (in ms),
total_awake_time_milli (in ms),
baseline_mili, nap_am, nap_pm,
data_source,
created_at, updated_at
```

**Join:** sleeps.day_id → days.id → days.athlete_id → athletes.id

---

## Domain: Injury & Pain

**Keywords:** injury, injuries, blessure, blessures, pain, pains, douleur, douleurs, discomfort, discomforts, gêne, gênes, hurt, hurts, sore, soreness, sore spot, body part, location, recovery, recovery date, out of training, blessé, blessés, bobos, inconfort, inconforts, register, level of pain, injury history, historique blessures, tissue, tissues, mechanism, mechanisms, pathology, pathologies, context, note blessure
**Tables:** injuries, health_pains, sport_activity_pains, injury_types, injury_sections, pain_discomfort_locations

### health_pains

Daily pain/discomfort per body location (wellness check-in).

```
id, health_id → health_ratings.id,
location_id → pain_discomfort_locations.id,
rating (ALWAYS 1–5, higher = more pain — NEVER report as /10), created_at, updated_at
```

**HARD RULE:** `rating` is NOT NULL — every pain row has an intensity. ALWAYS `SELECT hp.rating`. NEVER say intensity was not recorded / players only checked zones. Output as `n/5` (e.g. `3/5`). Same for `sport_activity_pains.rating`.

```sql
SELECT a.first_name, a.last_name, d.date_of_day, hp.rating,
       t.value AS location_name
FROM health_pains hp
JOIN health_ratings h ON hp.health_id = h.id
JOIN days d ON h.day_id = d.id
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN pain_discomfort_locations pdl ON hp.location_id = pdl.id
LEFT JOIN translations t ON t.translatable_id = pdl.id
  AND t.translatable_type = 'pain_discomfort_location'
  AND t.key = 'pain_discomfort_location_name' AND t.language = 'fr'
WHERE a.club_id = '<club_id>' AND d.date_of_day BETWEEN <start> AND <end>
ORDER BY d.date_of_day DESC
```

### injuries

Full injury records per athlete (main injury history table).

```
id, athlete_id,
date_of_injury, recovery_date,
context (enum: match/training/other),
contact_type (enum: no_contact/contact/semi_contact, nullable),
type_of_injury_id → injury_types.id,
note (free text),
mechanism, tissue, angle, pathology, source
```

**Join:** injuries.athlete_id → athletes.id. Prefer macro `fetch_injuries` (overlap window: date_of_injury ≤ to AND (recovery_date IS NULL OR recovery_date ≥ from)). Clinical injuries ≠ `injury_risk_score` on days.

### injury_types

Injury type reference. Display name via `translations` (`translatable_type = 'injury_type'`, `key = 'injury_type_name'`).

```
id, category_id → injury_sections.id, club_id, created_at, updated_at
```

### injury_sections

Injury category (e.g. muscular, ligament, tendon). Display name via `translations` (`translatable_type = 'injury_section'`, `key = 'injury_section_name'`).

```
id, zone_id → zones.id, created_at, updated_at
```

### pain_discomfort_locations

Body part/location reference. Display name via `translations` (`translatable_type = 'pain_discomfort_location'`, `key = 'pain_discomfort_location_name'`).

```
id, name, zone_id → zones.id
```

---

## Domain: Illness & Disease

**Keywords:** sick, disease, illness, maladie, malade, symptom, symptôme, médication, medication, drug, supplement, foodsupplement, compléments alimentaires, pathologie
**Tables:** diseases, disease_types

### diseases

Illness episodes per athlete.

```
id, athlete_id,
start_date, recovery_date,
name (illness name), note, source,
created_at, updated_at
```

**Join:** diseases.athlete_id → athletes.id

### disease_types

Disease type reference.

```
id, name, club_id, created_at, updated_at
```

---

## Domain: Sport Activities & Training

**Keywords:** activity, training, workout, session, run, game, match, distance, speed, duration, calories, rpe, effort, cardio, muscular, fatigue, pleasure, load, gps, zone, heart rate zone, trimp, power, cadence, sprint, acceleration, deceleration, top speed, entrainement, activité, séance, sport, pace, strain, epoc, period, catapult, player load, velocity band, speed band, IMA, metabolic power, basketball, rebounds, assists, points, field time, bench time, dive load, heart rate band, RHIE, cycling, cycle, vélo, wahoo, series, timeseries, time series, courbe, heart rate curve, elevation profile, sport activity metric, activity metric, tackle, tackles, tacle, tacles, tackles_won, tackles_contested, minutes played, minutes_played, duel, duels, match stats, stats de match, last training, last session, dernière séance, dernier entraînement, team training
**Tables:** sport_activities, activities, periods, period_metrics, period_metric_values, period_metric_club_units, sport_activity_metrics, sport_activity_metric_values, series, translations, events, event_types

**Metrics layers (same EAV pattern twice):**

| Scope    | Values                                  | Catalogue                        | Join path                 | Typical use                              |
| -------- | --------------------------------------- | -------------------------------- | ------------------------- | ---------------------------------------- |
| Period   | `period_metric_values` (`pmv`)          | `period_metrics` (`pm`)          | `sa → periods → pmv ← pm` | GPS / load / provider                    |
| Activity | `sport_activity_metric_values` (`samv`) | `sport_activity_metrics` (`sam`) | `sa → samv ← sam`         | Match stats (tackles, minutes_played, …) |

Shared rules for both:

- `value` is a string → `CAST(... AS DECIMAL)`.
- **Period units are club-aware:** default `pm.unit`, override via `period_metric_club_units` when present for `(metric_id, club_id)`. Always resolve with `COALESCE(pmcu.unit, pm.unit)` — never hardcode conversions.
- Activity metrics still use `sam.unit` (no club override table).
- Metric names come from **CLUB PERIOD METRICS** / **CLUB SPORT ACTIVITY METRICS** — do not invent.
- Prefer EAV over `sa.distance*` / `sa.training_load` / MyCoach speed bands (often empty).
- Tackles / match stats → activity EAV only (`sam.name` e.g. `tackles_won`, `tackles_contested`). Empty rows = no values, not "metric missing".

```sql
-- Period (GPS/load) — unit = club override else catalogue default
SELECT ad.date_of_day, pm.name,
       COALESCE(pmcu.unit, pm.unit) AS unit,
       SUM(CAST(pmv.value AS DECIMAL)) AS total
FROM period_metric_values pmv
JOIN periods p ON pmv.period_id = p.id
JOIN period_metrics pm ON pmv.metric_id = pm.id
LEFT JOIN period_metric_club_units pmcu
  ON pmcu.metric_id = pm.id AND pmcu.club_id = a.club_id
JOIN sport_activities sa ON p.sport_activity_id = sa.id
JOIN days ad ON sa.day_id = ad.id
JOIN athletes a ON ad.athlete_id = a.id
WHERE a.club_id = ? AND pm.name IN (/* CLUB PERIOD METRICS */)
  AND (
    p.name ILIKE '%entire session%'
    OR NOT EXISTS (
      SELECT 1 FROM periods p2
      WHERE p2.sport_activity_id = p.sport_activity_id AND p2.name ILIKE '%entire session%'
    )
  )
GROUP BY ad.date_of_day, pm.name, COALESCE(pmcu.unit, pm.unit)
ORDER BY ad.date_of_day DESC
LIMIT 100

-- Activity (match stats)
SELECT ad.date_of_day, sam.name, sam.unit, SUM(CAST(samv.value AS DECIMAL)) AS total
FROM sport_activity_metric_values samv
JOIN sport_activity_metrics sam ON samv.metric_id = sam.id
JOIN sport_activities sa ON samv.sport_activity_id = sa.id
JOIN days ad ON sa.day_id = ad.id
JOIN athletes a ON ad.athlete_id = a.id
WHERE a.club_id = ? AND sam.name IN (/* CLUB SPORT ACTIVITY METRICS */)
GROUP BY ad.date_of_day, sam.name, sam.unit
ORDER BY ad.date_of_day DESC
LIMIT 100
```

GPS `pm.name` values come only from the **CLUB PERIOD METRICS** block for this club. Catapult clubs list names such as `total_distance`, `player_load`, `gen2_velocity_band*_total_distance`. StatSports clubs list names such as `kpi_distanceTotal`, `kpi_dsl`, `kpi_maxSpeed`, `kpi_sprintDistance`, `kpi_sprints`. Query the names in the block.

**Period overlap rule (Period/GPS queries only):** an activity can have a period named "Entire Session"
that already contains the sum of its other listed periods (e.g. the two match halves, or a warm-up +
main block). Summing `pmv.value` across ALL periods of the activity in that case double-counts the
metric. Always keep the `p.name ILIKE '%entire session%' OR NOT EXISTS (...)` filter from the query
above (or an equivalent one) whenever grouping/summing `period_metric_values` per activity/day/athlete
— never drop it when adapting the template (e.g. for a leaderboard `GROUP BY athlete_id`).

**Other layers:** basic columns on `sport_activities`; intra-session curves in `series` (SELECT `s.id` only — never `data_encoded`).

**Note:** This domain has two levels of metrics:

- **Basic metrics** live directly on `sport_activities` (distance, duration, RPE, MyCoach speed bands, HR zones).
- **Advanced GPS / drill metrics** (Catapult, StatSports periods, etc.) are stored in `period_metric_values` linked through `periods`.
- **Session / competition metrics from alternate sources** (SkillCorner, DFL, box scores…) are stored in `sport_activity_metric_values` with a `source` column so the same metric name can coexist without overwriting GPS period data.
- `period_metric_values.value` and `sport_activity_metric_values.value` are stored as strings. Use `CAST(... AS DECIMAL)` for numeric comparisons.

**Distance & speed data source — details:**

- `sport_activities.distance` and the MyCoach speed-band columns (`distance_0_7_kmh`, `distance_7_14_kmh`, `distance_14_19_kmh`, `distance_19_25_kmh`, `distance_25_plus_kmh`, `nb_efforts_above_19_8_kmh`, `nb_efforts_above_25_kmh`, `top_speed`) are often NULL. Session GPS is on `period_metric_values`.
- When those columns are NULL, query `period_metric_values` with `pm.name` taken from **CLUB PERIOD METRICS** (StatSports distance is `kpi_distanceTotal` when that name is listed; Catapult distance is `total_distance` when that name is listed).
- An empty result for `total_distance` or `player_load` means that name is absent for this club. Read the catalogue names. The GPS rows are still there.

### sport_activities

One row per recorded sport activity/session.

```
id, day_id, created_at, activity_type_id → activities.id,
distance, speed, duration_seconds, elevation, power,
averaged_bpm, rpe (1-10), training_load,
active_calories, intensity_level,
cardio_respiratory, muscular_difficulty,
time_of_activity, fatigue_level, pleasure_level,
game_activity (bool), data_source,
cadence, elevation_descent, fc_max,
event_id, workout_session_instance_id
```

**RPE:** If **CLUB HEALTH METRICS** lists `*_rpe` names (e.g. Hamburg/SAP: `training_rpe`, `pre_training_rpe`, …), session RPE lives in `health_metric_values` — **ignore `sa.rpe` entirely** (do not query, do not mention, do not report as missing). Otherwise prefer `sa.rpe` when filled. Body soreness / "RPE Body" → `health_ratings.body_soreness_rating` (user with club catalogue label), not `sa.rpe`.

**Join:** sport_activities.day_id → days.id → days.athlete_id → athletes.id

When selecting sessions, ALWAYS JOIN `activities` (+ translations) for the display name — never infer sport from distance/speed/duration.

**Last training / last session:** last day with training (`MAX(date_of_day)`), then **every** `events.id` that day (calendar cards 1:1). Key by `e.id` only — same title ≠ same event; never invent groups. Roster = `sa.event_id = e.id`. No `LIMIT 1` on events (that pattern is for series curves only).

```sql
WITH last_day AS (
  SELECT MAX(ad.date_of_day) AS day
  FROM sport_activities sa
  JOIN days ad ON sa.day_id = ad.id
  JOIN athletes a ON ad.athlete_id = a.id
  WHERE a.club_id = ? AND ad.date_of_day <= ?
)
SELECT e.id, e.title, e.start_date, e.end_date,
       TRIM(a.first_name), TRIM(a.last_name), sa.duration_seconds
FROM sport_activities sa
JOIN days ad ON sa.day_id = ad.id
JOIN athletes a ON ad.athlete_id = a.id
JOIN events e ON e.id = sa.event_id
WHERE a.club_id = ? AND ad.date_of_day = (SELECT day FROM last_day)
ORDER BY e.start_date, e.id, a.last_name
```

```sql
LEFT JOIN activities act ON sa.activity_type_id = act.id
LEFT JOIN translations t_act ON t_act.translatable_id = act.id
  AND t_act.translatable_type = 'activity'
  AND t_act.key = 'activity_name'
  AND t_act.language = 'fr'   -- or 'en'
-- SELECT COALESCE(t_act.value, act.name) AS activity_name
```

#### activities

```
id, name, created_at, updated_at
```

**Join:** sport_activities.activity_type_id → activities.id → translations (`translatable_type = 'activity'`, `key = 'activity_name'`)

#### periods

Segments of a sport activity (warm-up, half, full session…). Period EAV attaches here.

```
id, provider_id, name, start_time, end_time,
sport_activity_id → sport_activities.id,
created_at, updated_at
```

**Join:** periods.sport_activity_id → sport_activities.id

##### period_metrics / period_metric_values / period_metric_club_units

Catalogue + pivot (one row per period × metric). See shared EAV rules above.

```
period_metrics: id, name, display_name, description, unit (default), aggregation_method, data_type, created_at, updated_at
period_metric_values: id, period_id → periods.id, metric_id → period_metrics.id, value, created_at, updated_at
period_metric_club_units: id, metric_id → period_metrics.id, club_id → clubs.id, unit, created_at, updated_at
  UNIQUE (metric_id, club_id)
```

**Unit resolution:** `COALESCE(pmcu.unit, pm.unit)` with
`LEFT JOIN period_metric_club_units pmcu ON pmcu.metric_id = pm.id AND pmcu.club_id = <club_id>`.
Same metric name can display as `m` for one club and `km` for another — always use the club override when present.

##### sport_activity_metrics / sport_activity_metric_values

Same shape as period EAV, but keyed on `sport_activity_id` (whole session). See shared EAV rules above.

```
sport_activity_metrics: id, name, display_name, description, unit, aggregation_method, data_type, created_at, updated_at
sport_activity_metric_values: id, sport_activity_id → sport_activities.id, metric_id → sport_activity_metrics.id, value, created_at, updated_at
```

##### series

Intra-activity curves. Never SELECT `data_encoded` — SELECT `s.id`; server auto-decodes (max 20). No GPS LATITUDE/LONGITUDE charts.
Types: `HEART_RATE` | `SPEED_METERS_PER_SECOND` | `TOTAL_DISTANCE_IN_METERS` | `ELEVATION_IN_METERS` | `POWER_IN_WATTS`
Always filter exactly ONE `s.type` per query.

**Athlete by name (team)** — first name only with accents:

```sql
SELECT s.id, s.type, a.id AS athlete_id, TRIM(a.first_name) AS first_name, TRIM(a.last_name) AS last_name, ad.date_of_day
FROM athletes a
JOIN days ad ON ad.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = ad.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN series s ON s.period_id = p.id
WHERE a.club_id = ?
  AND s.type = 'HEART_RATE'
  AND TRIM(a.first_name) ILIKE 'Name%'
ORDER BY ad.date_of_day DESC, sa.time_of_activity DESC NULLS LAST, p.start_time DESC NULLS LAST
LIMIT 1
```

**Athlete — N latest sessions** (`ORDER BY date DESC`, optional `LIMIT N`; server backfills older activities until N chartable graphs):

```sql
SELECT s.id, s.type, a.id AS athlete_id, TRIM(a.last_name) AS last_name, ad.date_of_day
FROM athletes a
JOIN days ad ON ad.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = ad.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN series s ON s.period_id = p.id
WHERE a.id = ? AND s.type = 'POWER_IN_WATTS'
ORDER BY ad.date_of_day DESC, sa.time_of_activity DESC NULLS LAST, p.start_time DESC NULLS LAST
LIMIT 5
```

**Team — latest session per athlete** (`DISTINCT ON (a.id)`, one graph per player; no small LIMIT — server caps & backfills):

```sql
SELECT DISTINCT ON (a.id) s.id, s.type, a.id AS athlete_id, TRIM(a.first_name) AS first_name, TRIM(a.last_name) AS last_name, ad.date_of_day
FROM athletes a
JOIN days ad ON ad.athlete_id = a.id
JOIN sport_activities sa ON sa.day_id = ad.id
JOIN periods p ON p.sport_activity_id = sa.id
JOIN series s ON s.period_id = p.id
WHERE a.club_id = ? AND s.type = 'HEART_RATE'
ORDER BY a.id, ad.date_of_day DESC, sa.time_of_activity DESC NULLS LAST, p.start_time DESC NULLS LAST
```

##### sport_activity_metrics

Catalogue of session/competition-level metrics (SkillCorner, DFL, box scores, etc.). Same shape as `period_metrics`.

```
id, name, description, unit,
aggregation_method (sum/average/max/min),
data_type (float/integer/string/boolean),
created_at, updated_at
```

Common names: `minutes_played`, `total_distance`, `sprint_distance`, `intensive_run_distance`, `max_speed`, `tackles_contested`, `tackles_won`.

##### sport_activity_metric_values

Pivot of metric values at sport-activity grain. **Same metric name can exist multiple times** with different `source` values (no overwrite across providers).

```
id, sport_activity_id → sport_activities.id,
metric_id → sport_activity_metrics.id,
source (skillcorner/dfl/statsports/catapult/manual/…),
value (string — cast to number for aggregations),
created_at, updated_at
UNIQUE (sport_activity_id, metric_id, source)
```

```sql
SELECT pm.name AS metric_name, samv.source,
       CAST(samv.value AS DECIMAL) AS metric_value, pm.unit
FROM sport_activity_metric_values samv
JOIN sport_activity_metrics pm ON samv.metric_id = pm.id
JOIN sport_activities sa ON samv.sport_activity_id = sa.id
JOIN days d ON sa.day_id = d.id
WHERE d.athlete_id = ?
  AND samv.source IN ('dfl', 'skillcorner')
  AND pm.name = 'total_distance'
```

---

## Domain: Nutrition

**Keywords:** nutrition, food, meal, eat, calories, carbs, carbohydrates, fat, protein, hydration, water, drink, liters, macro, diet, manger, nourriture, repas, glucides, lipides, protéines, hydratation, alimentation
**Tables:** nutritions, hydratations

### nutritions

Individual meal/food entries per day.

```
id, day_id, created_at,
meal_type (breakfast/lunch/dinner/snack),
quantity, portion,
meal_id, recipe_id
```

**Join:** nutritions.day_id → days.id → athletes

### hydratations

Daily water intake.

```
id, day_id, created_at,
total_liters, nbr_of_bottles, nbr_of_glasses
```

**Join:** hydratations.day_id → days.id → athletes

---

## Domain: Strength & Force Testing

**Keywords:** vald, force, strength, test, asymmetry, jump, squat, force plate, trial, test musculaire, force maximale, puissance, déséquilibre, hauteur de saut, CMJ
**Tables:** vald_tests, vald_trials

### vald_tests

VALD ForceDecks test session per athlete day. One row per test execution. Detailed metrics live on `vald_trials` (join required). **No** `athlete_id`, `test_date`, `test_name`, or `result_value`.

```
id, day_id → days.id,
test_type (e.g. CMJ, ABCMJ, CMRJ, SQT),
provider_test_id (nullable),
value (optional summary string — prefer trial metrics for numbers),
created_at, updated_at
```

**Join:** `vald_tests.day_id → days.id → athletes` (never `vald_tests.athlete_id`).

### vald_trials

Individual trial / rep within a VALD test. Numeric metrics are here (snake_case columns). There is **no** `vald_test_values` table.

```
id, vald_test_id → vald_tests.id,
trial_jump_height (cm),
trial_rsi_modified,
trial_peak_takeoff_power (W),
trial_concentric_rfd (N/s),
trial_peak_landing_force (N),
trial_time_to_stabilisation (s),
trial_rsi,
trial_eccentric_braking_rfd (N/s),
created_at, updated_at
```

**Join:** vald_trials.vald_test_id → vald_tests.id → days → athletes

**Query tip:** For daily headline values use MAX(vt.<metric>) per athlete and date_of_day across trials. Filter club via athletes.club_id.

Prefer premium macro `fetch_vald_tests`. Never invent bare `jump_height` / `peak_power` / `landing_force`.

---

## Domain: Goals, Races & Events

**Keywords:** race, goal, target, objectif, competition, event, course, format, date de course, prochaine compétition, calendar, match schedule, agenda
**Tables:** athlete_events, events, event_types

### athlete_events

Events linked to athletes.

```
id, athlete_id, event_id → events.id, created_at
```

### event_types

Event type reference (training, match, recovery...).

```
id, name, color, icon, event_category (enum), activity_id → activities.id, travel_type
```

---

## Domain: Coach Notes & Observations

**Keywords:** note, comment, coach note, observation, remarque, commentaire, annotation, feedback, written
**Tables:** player_notes

### player_notes

Structured coach notes per athlete with category.

```
id, athlete_id, event_id,
note_date, content, category,
created_at
```

**Join:** player_notes.athlete_id → athletes.id

---

## Domain: AI Summaries

**Keywords:** summary, résumé, report, rapport, insight, ai analysis, weekly summary, daily summary, generated, automated
**Tables:** ai_summaries

### ai_summaries

AI-generated summaries for athlete days or other entities.

```
id, day_id, entity_id, entity_type,
summary_message (text), created_at
```

**Join:** ai_summaries.day_id → days.id → athletes

---

## Domain: Garmin Data

**Keywords:** garmin, steps, stress, body battery, floors, calories burned, active calories, resting heart rate, hrv, garmin sleep, deep sleep seconds, light sleep, rem, awake, sleep score garmin, device, wearable, daily activity, pas, fréquence cardiaque repos
**Tables:** _(not migrated to PostgreSQL — Garmin data is not queryable via SQL)_

---

## Domain: Body Metrics

**Keywords:** body composition, weight history, fat percentage, muscle mass, bone mass, hydration percentage, body fat, lean mass, composition corporelle, poids historique, masse musculaire, masse osseuse
**Tables:** bodymetrics_histories

### bodymetrics_histories

Historical body composition measurements per athlete. Date is via `day_id → days.date_of_day` (no `date` / `measured_at` column on this table).

```
id, athlete_id, day_id,
weight, fat_percentage,
created_at
```

**Join:** bodymetrics_histories.day_id → days.id → athletes. Prefer macro `fetch_body_metrics`.

---

## Domain: Biomarkers

**Keywords:** biomarker, biomarkers, biomarqueur, biomarqueurs, blood marker, lab, laboratory, blood test, analyse sanguine, creatine kinase, ck, crp, ferritin, hemoglobin, cortisol, vitamin, vitamine, y-balance, fms
**Tables:** biomarkers, biomarker_types, biomarker_type_clubs

No `day_id`: join `biomarkers.athlete_id → athletes.id`. Calendar day = `(b.measured_at AT TIME ZONE 'UTC')::date`.
Type names: use `bt.name` from the **CLUB BIOMARKERS** block (do not invent). Always SELECT `bt.unit` with values.

### biomarker_types

```
id, name, unit, created_at, updated_at
```

### biomarker_type_clubs

Club ↔ enabled types.

```
id, biomarker_type_id → biomarker_types.id, club_id → clubs.id,
created_at, updated_at
```

### biomarkers

```
id, value (string — CAST to DECIMAL for aggregations),
measured_at (timestamptz),
athlete_id → athletes.id,
biomarker_type_id → biomarker_types.id,
created_at, updated_at
```

**Join:** biomarkers → athletes (athlete_id) + biomarker_types. Team scope: `a.club_id = ?`; optionally JOIN biomarker_type_clubs to restrict to club-enabled types.

```sql
SELECT (b.measured_at AT TIME ZONE 'UTC')::date AS date_of_day,
       bt.name AS biomarker_name, bt.unit,
       CAST(b.value AS DECIMAL) AS biomarker_value
FROM biomarkers b
JOIN biomarker_types bt ON b.biomarker_type_id = bt.id
JOIN athletes a ON b.athlete_id = a.id
WHERE a.club_id = ?
  AND bt.name ILIKE ?
  AND (b.measured_at AT TIME ZONE 'UTC')::date BETWEEN ? AND ?
ORDER BY date_of_day DESC
LIMIT 100
```

For charts: daily `AVG(CAST(b.value AS DECIMAL)) GROUP BY date`, then `suggest_chart` (one team mean series).

---

## Domain: Basketball

**Keywords:** basketball, basketball game, basketball match, basketball points, basketball assists, basketball rebounds, basketball blocks, basketball steals, field goal, three point, free throw, plus minus, turnover, nba, basket, score de jeu, stats de match, statistiques basket
**Tables:** basketball_games, basketball_game_stats, basketball_game_player_stats

### basketball_games

Basketball game records per team.

```
id, club_id,
date, opponent, location (home/away),
result (win/loss/draw), score_team, score_opponent,
season_id, competition_name
```

### basketball_games_stats

Team-level aggregated stats for a game.

```
id, game_id → basketball_games.id,
total_points, total_assists, total_rebounds,
total_steals, total_blocks, total_turnovers,
field_goal_attempts, field_goals_made, field_goal_percentage,
three_point_attempts, three_points_made, three_point_percentage
```

### basketball_game_player_stats

Individual player stats per game.

```
id, game_stats_id → basketball_games_stats.id,
athlete_id → athletes.id,
minutes_played, points, assists,
rebounds_offensive, rebounds_defensive, rebounds_total,
steals, blocks, turnovers,
field_goal_attempts, field_goals_made, field_goal_percentage,
three_point_attempts, three_points_made,
free_throw_attempts, free_throws_made,
plus_minus, starter (bool)
```

**Join:** basketball_game_player_stats.athlete_id → athletes.id

---

## Domain: Symptoms & Illness Details

**Keywords:** symptom, symptôme, sick sign, fever, nausea, cough, headache, signe de maladie, mal de tête, fièvre, nausée, toux, type of symptom
**Tables:** diseases, disease_types

### diseases

Symptom episodes reported per athlete.

```
id, athlete_id,
date_of_symptom, recovery_date,
type_of_symptom_id → disease_types.id,
note, source
```

**Join:** diseases.athlete_id → athletes.id

### disease_types

Symptom type reference.

```
id, name, club_id, created_at, updated_at
```

---

## Domain: Seasons & Planning

**Keywords:** season, saison, période, planning, calendar period, training block, off-season, pre-season, in-season, competition period
**Tables:** seasons, events

### seasons

Club seasons (date ranges).

```
id, club_id, name,
start_date, end_date
```

Active season = `start_date <= today AND end_date >= today` (no `is_active` column).

Report v4 windowing loads these rows as the authoritative calendar for "this/current/last season" and named season asks (prefer over inventing July–June defaults).

### events

Calendar events (training sessions, matches, recovery days, etc.).

```
id, club_id,
title, description,
start_date, end_date,
event_type_id → event_types.id,
location, all_day (bool),
created_at
```

---

## Domain: Workout Programs

**Keywords:** workout, program, exercise, séance de musculation, programme, exercice, série, répétition, charge, load, sets, reps, strength training, gym, resistance, poids, entraînement musculaire
**Tables:** workout_sessions, workout_session_instances, exercise_loads

### workout_sessions

Planned workout sessions (templates).

```
id, athlete_id, club_id,
name, date, status (planned/completed/skipped),
duration, notes
```

**Join:** workout_sessions.athlete_id → athletes.id

### workout_session_instances

Individual exercise instances within a workout session.

```
id, workout_session_id → workout_sessions.id,
exercise_id, exercise_name,
sets, reps, rest_seconds,
order_index
```

### exercise_loads

Actual loads recorded per exercise instance.

```
id, session_instance_id → workout_session_instances.id,
set_number,
weight_kg, reps_done,
rpe, notes
```

---

## Domain: Strength Testing (VALD)

**Keywords:** vald, force, strength, test, asymmetry, jump, squat, force plate, trial, test musculaire, force maximale, puissance, déséquilibre, trial detail
**Tables:** vald_tests, vald_trials

### vald_tests

```
id, day_id → days.id,
test_type, provider_test_id, value (nullable legacy),
created_at, updated_at
```

**Join:** `vald_tests.day_id → days.id → athletes`. No `athlete_id` / `test_date` on this table.

### vald_trials

```
id, vald_test_id → vald_tests.id,
trial_jump_height, trial_rsi, trial_rsi_modified,
trial_peak_takeoff_power, trial_concentric_rfd,
trial_peak_landing_force, trial_eccentric_braking_rfd,
trial_time_to_stabilisation,
created_at, updated_at
```

Do not invent `jump_height`, `peak_force`, `vald_test_values`, or `biomarker_measurements`. Prefer `fetch_vald_tests`.

---

## Domain: Travel

**Keywords:** travel, voyage, déplacement, jet lag, away game, déplacement sportif, fatigue de voyage
**Tables:** travels

### travels

Travel records per athlete day (affects recovery).

```
id, day_id,
travel_type (domestic/international),
departure_time, arrival_time,
time_zones_crossed,
notes
```

**Join:** travels.day_id → days.id → athletes

---

## Domain: ML Insights & Reports

**Keywords:** insight, feature importance, prediction, model, ai insight, club insight, weekly report, rapport hebdomadaire, analyse ml, score de prédiction, variable importance, monotony, monotonie, volume load monotony, ewma, exponential, acwr, strain index, load index, readiness index, subjective energy, subjective wellness, training stress, fatigue index, chronic load, acute load, model variable, metric value, named metric
**Tables:** feature_importances, insights, club_insights, dataApis_report, dataApis_weeklyreport

### insights

Static reference/lookup table defining ML model metric types. One row per metric — NOT per athlete or per day.

```
id, variable_name, name,
description,
can_too_high, can_too_low,
threshold_low, threshold_too_low,
threshold_high, threshold_too_high,
threshold_type (PERCENTAGE/ABSOLUTE),
maximum,
created_at, updated_at
```

**No athlete_id or date columns.** This table only defines metric types, not values.

- `name` = human-readable label (e.g. `'Volume Load Monotony (7days)'`, `'EWMA Subjective Energy (7days)'`)
- `variable_name` = technical code (e.g. `'monotony_TL_volume_F2'`)
- Per-athlete values are in `feature_importances.value`, linked via `feature_importances.insight_id = insights.id`

**CRITICAL — correct query pattern to retrieve a named metric value over time:**

```sql
SELECT ad.date_of_day, fi.value, fi.optimal
FROM insights i
JOIN feature_importances fi ON fi.insight_id = i.id
JOIN days ad ON fi.day_id = ad.id
WHERE ad.athlete_id = <athlete_id>
  AND i.name = '<metric name>'
  AND d.date_of_day BETWEEN '<ref_date>'::date - INTERVAL 'N days' AND '<ref_date>'::date
ORDER BY ad.date_of_day ASC;
```

- `fi.value` = actual value, `fi.optimal` = target value
- Athlete filtering → `days.athlete_id` (not through `insights`)
- Date filtering → `fi.day_id = days.id`

### feature_importances

Numeric values computed by the ML model, one row per insight per day.

```
id, insight_id, day_id,
value, optimal,
shap_value, contrib_pct,
type (activity/nutrition/sleep/health),
category (performance/injury),
created_at, updated_at
```

**Joins:**

- feature_importances.insight_id → insights.id
- feature_importances.day_id → days.id

**Note:** `value` is the numeric value of the metric. `optimal` is the target/optimal value. Always join to `insights` first to filter by metric name, then use `day_id` to join to `days` for date filtering.

### club_insights

Aggregated insights at the club/team level.

```
id, club_id,
insight_type, message,
date, created_at
```

### dataApis_report

Daily data API reports per athlete.

```
id, athlete_id,
report_date, source (garmin/firstbeat/catapult/vald),
status, raw_data (JSON),
created_at
```

### dataApis_weeklyreport

Weekly aggregated data reports.

```
id, athlete_id,
week_start_date, week_end_date,
summary (JSON),
created_at
```

---

## Domain: Activity Reference & Zones

**Keywords:** activity type, sport type, heart rate zone, zone name, zone description, type d'activité, zone fréquence cardiaque, zone de puissance, référentiel
**Tables:** zones, activities, sport_activity_pains

### zones

Body map zones (front/back) for pain locations.

```
id, side (front/back), name, created_at, updated_at
```

### activities

Activity type reference. Display name via `translations` (`translatable_type = 'activity'`, `key = 'activity_name'`).

```
id, name, created_at, updated_at
```

### sport_activity_pains

Pain reported during a sport activity.

```
id, sport_activity_id → sport_activities.id,
location_id → pain_discomfort_locations.id,
rating (pain intensity 1–5, higher = more pain; NOT NULL — always SELECT hp.rating), created_at, updated_at
```

---

## Domain: Club & Positions Reference

**Keywords:** club, team name, organization, position, poste, rôle, role, équipe, club name, staff, player position
**Tables:** clubs, player_positions

### clubs

Club/organization reference.

```
id, name, sport_id → sports.id,
logo, country, city,
created_at
```

### player_positions

Athlete position reference (e.g., Forward, Goalkeeper). Use `translations` for localized names.

```
id, name, sport_id → sports.id, created_at, updated_at
```

---

## Common Query Patterns

### Get athlete by name

```sql
SELECT id, first_name, last_name, start_date FROM athletes
WHERE TRIM(first_name) = 'Alex' AND TRIM(last_name) = 'Lesia'
```

### Get injury history for an athlete (with injury type name)

```sql
SELECT i.date_of_injury, i.recovery_date, i.context,
       i.mechanism, i.tissue, i.note,
       t_en.value AS injury_type_en, t_fr.value AS injury_type_fr
FROM injuries i
JOIN athletes a ON i.athlete_id = a.id
LEFT JOIN injury_types it ON i.type_of_injury_id = it.id
LEFT JOIN translations t_en ON t_en.translatable_id = it.id
  AND t_en.translatable_type = 'injury_type' AND t_en.key = 'injury_type_name' AND t_en.language = 'en'
LEFT JOIN translations t_fr ON t_fr.translatable_id = it.id
  AND t_fr.translatable_type = 'injury_type' AND t_fr.key = 'injury_type_name' AND t_fr.language = 'fr'
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY i.date_of_injury DESC
```

### Get pain/discomfort by body location

```sql
SELECT d.date_of_day, hp.rating,
       t.value AS location_name
FROM health_pains hp
JOIN health_ratings h ON hp.health_id = h.id
JOIN days d ON h.day_id = d.id
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN pain_discomfort_locations pdl ON hp.location_id = pdl.id
LEFT JOIN translations t ON t.translatable_id = pdl.id
  AND t.translatable_type = 'pain_discomfort_location'
  AND t.key = 'pain_discomfort_location_name' AND t.language = 'en'
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY d.date_of_day DESC
```

### Get daily scores over a period

```sql
SELECT d.date_of_day, d.performance_score, d.injury_risk_score
FROM days d
JOIN athletes a ON d.athlete_id = a.id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
AND d.date_of_day >= CURRENT_DATE - INTERVAL '3 months'
ORDER BY d.date_of_day DESC
```

### Top N players by injury risk on a given day (team)

```sql
SELECT TRIM(a.first_name) AS first_name, TRIM(a.last_name) AS last_name,
       d.injury_risk_score, d.date_of_day,
       t.value AS position_name
FROM days d
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN player_positions pp ON a.player_position_id = pp.id
LEFT JOIN translations t ON t.translatable_id = pp.id
  AND t.translatable_type = 'player_position'
  AND t.key = 'player_position_name' AND t.language = 'fr'
WHERE a.club_id = 'CLUB_UUID'
  AND d.date_of_day = 'YYYY-MM-DD'
  AND d.injury_risk_score IS NOT NULL
ORDER BY d.injury_risk_score DESC
LIMIT 10
```

**Note:** `injury_risk_score` higher = more risk. "High" means `>= club_settings.injury_high` for this club, not 100 and not `performance_high`. Use the `injuries` table only for injury _history_, not for daily risk scores.

### Get health/wellness for an athlete

```sql
SELECT d.date_of_day, h.body_soreness_rating, h.energy_rating, h.mood_rating, h.stress_rating
FROM health_ratings h
JOIN days d ON h.day_id = d.id
JOIN athletes a ON d.athlete_id = a.id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY d.date_of_day DESC
```

### Get sleep data

```sql
SELECT d.date_of_day, s.quality_rating, s.sleep_efficiency_percentage,
       ROUND(s.total_in_bed_time_milli / 3600000.0, 1) AS hours_in_bed,
       ROUND(s.total_slow_wave_sleep_time_milli / 3600000.0, 1) AS deep_sleep_hours
FROM sleeps s
JOIN days d ON s.day_id = d.id
JOIN athletes a ON d.athlete_id = a.id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY d.date_of_day DESC
```

### Get training activities

```sql
SELECT d.date_of_day, sa.time_of_activity,
       COALESCE(t_act.value, act.name) AS activity_name,
       sa.distance, sa.duration_seconds, sa.training_load,
       sa.rpe, sa.averaged_bpm, sa.active_calories, sa.game_activity
FROM sport_activities sa
JOIN days d ON sa.day_id = d.id
JOIN athletes a ON d.athlete_id = a.id
LEFT JOIN activities act ON sa.activity_type_id = act.id
LEFT JOIN translations t_act ON t_act.translatable_id = act.id
  AND t_act.translatable_type = 'activity'
  AND t_act.key = 'activity_name'
  AND t_act.language = 'fr'
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY d.date_of_day DESC, sa.time_of_activity DESC
```

### Get body metrics history

```sql
SELECT d.date_of_day, bh.weight, bh.fat_percentage
FROM bodymetrics_histories bh
JOIN days d ON d.id = bh.day_id
JOIN athletes a ON a.id = bh.athlete_id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY d.date_of_day DESC
```

### Get basketball game stats for a player

```sql
SELECT bg.date, bg.opponent, bg.result,
       bgsp.minutes_played, bgsp.points, bgsp.assists, bgsp.rebounds_total,
       bgsp.field_goal_percentage, bgsp.plus_minus
FROM basketball_game_player_stats bgsp
JOIN basketball_game_stats bgs ON bgsp.game_stats_id = bgs.id
JOIN basketball_games bg ON bgs.game_id = bg.id
JOIN athletes a ON bgsp.athlete_id = a.id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY bg.date DESC
```

### Get workout sessions for an athlete

```sql
SELECT wsi.start_time, ws.title, wsi.duration_seconds
FROM workout_sessions ws
JOIN workout_session_instances wsi ON wsi.workout_session_id = ws.id
JOIN athletes a ON ws.athlete_id = a.id
WHERE TRIM(a.first_name) = 'X' AND TRIM(a.last_name) = 'Y'
ORDER BY wsi.start_time DESC
```
