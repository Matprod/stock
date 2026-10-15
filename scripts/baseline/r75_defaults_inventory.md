# R7.5 §1 — Defaults / imputed inventory

Sources scanned: `scripts/baseline/baseline_{hamburg,individual,short,hard24}.{html,meta.json}` and `tmp/canari_runs/` mirrors (same HTML content).

## Hard24 (primary)

| Value | Where | Count | Likely source | Notes |
| --- | --- | ---: | --- | --- |
| **3630** (displayed `3 630`) | Nominative table, sRPE daily / moyen | **9** (orig hard24 HTML; cleared to `—` in `_r75`) | **`db_fill` / computed product** | **Postgres (live):** not a TS literal. Exact product **30 × 121.00 min = 3630** on **2026-03-07** for Dompé & Vušković. **RPE:** `health_metric_values.value` where `health_metrics.name = 'training_rpe'` (`metric_id` `019fb884-fd8b-74a5-a138-c58f3994693c`), via `health_ratings.day_id`. **Minutes:** `sport_activities.duration_seconds` (`data_source = 'statsports'`); `sport_activities.rpe` **NULL** for all 123 StatSports rows in club window. **club_id** `019fa7cc-684c-783e-9609-c132a26eb4e3`. **Import:** minutes ← `ProcessStatssportsJob` / `StatssportsService`; RPE ← `node ace sapsportsone:import` (`SapSportsOneService`). SQL path `daily_srpe` = `COALESCE(sa.rpe×min, health_rpe×minutes, 0)`. Orig hard24 also clustered 3630 with GPS `2765`/`323`/`76` — treat as repeated stored/period fill, not report constant. |
| **50** | Performance score column | **13** (HTML td.num) | **`model_impute`** | Mid-scale 0–100 when model input is thin; no backend `= 50` assignment in Hamburg persist (scores come from ML `score_overall`). Treated as sentinel. |
| **0** | Injury risk score column | **21** (HTML td.num; many risk cells) | **`model_impute` / real low risk** | Persist path writes rounded ML proba; 0 is also a plausible true low risk. Accords: treat as sentinel with perf 50. |
| Identical GPS `2765`/`323`/`76` | Distance / HMLD / HSR | **7** players | **`db_fill`** | Same players often also show sRPE 3630 + perf 50 + risk 0. |

**3630 ≠ coded default_RPE × default_duration.** Correction target: upstream DB / vendor fill (or period aggregation of filled days), not a report_v4 hardcoded product. Profiler share/sentinel rules still exclude it when repeated above threshold.

## Hamburg

| Finding | Detail | Source |
| --- | --- | --- |
| Narrative already flags defaults | « Proportion élevée de valeurs par défaut (0) » and « (51) » | Profile / Analyst copy from suspicious defaults (fixture scores ~51) |
| Perf **50** | 1× in scores table | `model_impute` sentinel candidate |
| No **3630** | — | — |
| Match minutes repeats (`206` ×3, etc.) | Legitimate playing-time repeats | Exclude via match-duration rule |

## Individual

| Finding | Detail |
| --- | --- |
| No **3630** | — |
| Scores table | Varied means; occasional ~50 band — share rule / sentinel apply per cell |
| Wellness `10` clusters | Subjective scale (good end) — profiler already excludes |

## Short

| Finding | Detail |
| --- | --- |
| No **3630**, no score 50/0 cluster | Ranking is m/min (separate R7.5 §2 measure contract) |
| No repeated default signature in table | — |

## Code search (report / SQL / ML)

| Pattern | Result |
| --- | --- |
| Literal `3630` | **None** in TS |
| Default RPE / default minutes product | **None**; `tools_data` `srpe` recipe is `rpe * minutes` with null if either missing |
| SQL sRPE missing path | `COALESCE(..., 0)` → **`code_default` = 0** (rest / empty day) — exclude from imputed when load/sRPE is 0 |
| Minutes SQL | `COALESCE(..., 0)` — not 90/60 hardcode |
| Hamburg perf/injury persist | Writes model scores; **no** local fill of 50/0 |
| Fixture profiler AC | `performance_score` suspicious default **51**; roster `weight_kg` **70** |

## Classification summary

| (column, value) | Source tag | Action in §1 |
| --- | --- | --- |
| `srpe_*` / load, **3630** (high share) | `db_fill` | Mark cells via share / constant-repeat |
| `performance_score`, **50** | `model_impute` | Sentinel constant |
| `injury_risk_score`, **0** | `model_impute` (or true 0) | Sentinel constant per accords |
| load/sRPE **0** | `code_default` (SQL) / rest | **Do not mark** (rest-day exclusion) |
| minutes = match duration | real match length | **Do not mark** |
| Subjective scale good-end mode | real Likert | **Do not mark** (existing profiler rule) |
