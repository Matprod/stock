# R7.5 §5 + R7.6 §2 — metrics fill

Sources: `scripts/baseline/baseline_*_r75.{html,meta.json}`, `tmp/canari_runs/baseline_*.{stdout.json,document.json}`, `tmp/canari_runs/r75_fact_autolink_measure.json`, Postgres (club `019fa7cc-684c-783e-9609-c132a26eb4e3`).

> Note: `baseline_hamburg_r75` harvested **2026-10-08→2026-10-14** (not March). `individual` / `short` / `hard24` `_r75` use **2026-03-01→2026-03-07**.

---

## A. R7.5 §5 — four `_r75` baselines

### 1. Valeurs écartées

| Baseline | `imputedExcludedCells` (stdout `report_v4.data_profile`) | HTML em-dash-only `td` | Per-column / reason (from document reliability text / `formatImputedExclusionLine`) |
| --- | ---: | ---: | --- |
| **hamburg** | **252** | **0** | `suspicious_default:performance_score=51@50%` ×120; `sentinel:injury_risk_score=0` ×62; `suspicious_default:kpi_maxacceleration=5@44%` ×46; `constant:nb_matchs=1` ×13 |
| **individual** | **154** | **0** | `sentinel:injury_risk_score=0` ×56; `suspicious_default:kpi_maxacceleration=6@46%` ×32; `suspicious_default:kpi_maxdeceleration=6@43%` ×30; `suspicious_default:kpi_decelerationdistancez6rel=0@41%` ×28 |
| **short** | **30** | **10** (all col **Max acceleration (m/s²)**) | `suspicious_default:kpi_maxacceleration=6@67%` ×16; `@80%` ×8; `suspicious_default:kpi_maxdeceleration=8@60%` ×6 |
| **hard24** | **154** | **27** | Same reason mix as individual (154). HTML em-dash by col: Distance totale (m)×8, HMLD×8, HSR×8, sRPE moyen×1, Score perf×1, Score risque×1 |

`document.json` has no `imputed[]` arrays (datasets not persisted). Reasons come from reliability block text (also mirrored in stdout as `imputedExcludedCells` only). Meta `checks.imputedCopyPresent` = **false** for all four (designer HTML often omits the reliability paragraph; counts still apply at dataset mark time).

### 2. Mesures corrigées

| Baseline | `requested_measure_note` / substitution | Notes |
| --- | --- | --- |
| **hamburg** | none | — |
| **individual** | none | — |
| **short** | **yes** — document text: « total distance substituée depuis les données (à la place de mesure affichée). » HTML caption: ranking copy for top-10 GPS distance week 1–7 Mar 2026. Table header **`Distance total (m)`** with meter values (e.g. `38 180`). | Measure contract OK (distance totale in **m**, not m/min). |
| **hard24** | none | — |

No « non disponible » captions found in the four `_r75` HTMLs.

### 3. Libellés bruts restants

Visible table / chart labels still English or vendor-raw:

| Baseline | Raw / English labels |
| --- | --- |
| **hamburg** | `Intensive Run Distance`, `Max Speed`, chart series `Explosive distance (absolute)` |
| **individual** | `Distance Total`, `Explosive Distance (Absolute)` |
| **short** | `Max acceleration (m/s²)` (unit OK; English metric name). Distance col localized enough: `Distance total (m)` |
| **hard24** | chart series `Explosive distance (absolute)` |

No snake_case column ids visible in body text (only inside chart option JSON / internals).

### 4. Part nombres reliés (`fact_autolink`)

Method: same pattern as `fact_autolink_hamburg_measure` — harvest `[data-fact]`/`[data-src]` + HTML tables as synthetic datasets, then `linkDisplayedNumbersToFacts` (`tmp/canari_runs/r75_fact_autolink_measure.json`). **false = 0** (not hand-sampled beyond TOC/date heuristics; no false links asserted).

| Baseline | displayed | linked (fact+src) | ambiguous | unmatched | linked share | before spans (fact/src) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| **hamburg** | 97 | **40** (0+40) | 9 | 48 | **41.2%** | 0 / 25 |
| **individual** | 36 | **23** (0+23) | 2 | 11 | **63.9%** | 0 / 0 |
| **short** | 23 | **13** (0+13) | 0 | 10 | **56.5%** | 1 / 0 |
| **hard24** | 175 | **107** (0+107) | 57 | 11 | **61.1%** | 1 / 7 |

---

## B. 3630 source (data team) — see also `r75_defaults_inventory.md`

Concrete inventory (Postgres, club Hambourg, 2026-03-01→03-07):

| Field | Value |
| --- | --- |
| **sRPE product** | `training_rpe` × activity minutes = **3630** |
| **RPE table / column** | `health_metric_values.value` via `health_metrics.name = 'training_rpe'` (`metric_id` `019fb884-fd8b-74a5-a138-c58f3994693c`) |
| **Minutes table / column** | `sport_activities.duration_seconds` (/60), `data_source = 'statsports'` — **`sport_activities.rpe` is NULL** for all 123 StatSports rows in window |
| **club_id** | `019fa7cc-684c-783e-9609-c132a26eb4e3` |
| **Example rows** | Jean-Luc Dompé & Luka Vušković, day **2026-03-07** (UTC date_of_day `2026-03-06T23:00:00Z`): RPE **30** × **121.00** min = **3630.0** |
| **Import path (minutes)** | StatSports → `StatssportsService.syncDateRange` / job `ProcessStatssportsJob` (`#jobs/process_statsports_job`, queue `statsports`) → `StatssportsPersistService` → `sport_activities` |
| **Import path (RPE)** | SAP SportsOne subjective → `node ace sapsportsone:import` (`SapSportsOneService`) → `health_ratings` + `health_metric_values` (`training_rpe`) |

Report SQL (`daily_srpe`): `COALESCE(sport_activities rpe×min, health_rpe × minutes, 0)`. Original hard24 HTML showed **9× `3 630`** as sRPE moyen with identical GPS fills; `_r75` replaced that cluster with em-dashes (imputed mark). Live DB no longer has week-mean exactly 3630 for those nine names — the **exact product 3630** still exists as above for Dompé/Vušković.

---

## C. R7.6 §2 — cache before / after (4 original baselines)

From agent `TOTAL` + `tokens` lines in `tmp/canari_runs/baseline_{name}.stdout.json` vs `baseline_{name}_r75.stdout.json`.

> **Caveat:** `_r75` includes R7.5 imputed/measure work, not cache-only. **hamburg before** is the first baseline and is **pre–R7.6§2** (`cacheW=0` on linker+analyst).

### hamburg

| Agent | Before cacheW | Before cacheR | Before $ | After cacheW | After cacheR | After $ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| linker | 0 | 59k | 0.061 | 43k | 6.1k | 0.180 |
| analyst | 0 | 133k | 0.337 | 203k | 172k | 1.084 |
| designer | 1.9k | 6.4k | 0.165 | 19k | 13k | 0.181 |
| **total $** | | | **0.563** | | | **1.445** |

### individual

| Agent | Before cacheW | Before cacheR | Before $ | After cacheW | After cacheR | After $ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| linker | 70k | 28k | 0.363 | 35k | 12k | 0.140 |
| analyst | 27k | 265k | 1.097 | 868k | 397k | 3.823 |
| designer | 3.7k | 4.6k | 0.145 | 17k | 16k | 0.143 |
| **total $** | | | **1.605** | | | **4.106** |

### short

| Agent | Before cacheW | Before cacheR | Before $ | After cacheW | After cacheR | After $ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| linker | 49k | 24k | 0.199 | 42k | 31k | 0.174 |
| analyst | 21k | 48k | 0.123 | 23k | 76k | 0.146 |
| designer | 3.6k | 4.4k | 0.089 | 7.3k | 8.1k | 0.072 |
| **total $** | | | **0.411** | | | **0.392** |

### hard24

| Agent | Before cacheW | Before cacheR | Before $ | After cacheW | After cacheR | After $ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| linker | 56k | 0 | 0.245 | 35k | 12k | 0.139 |
| analyst | 25k | 174k | 0.537 | 82k | 193k | 0.478 |
| designer | 3.8k | 4.6k | 0.182 | 16k | 12k | 0.168 |
| **total $** | | | **0.964** | | | **0.785** |

**Totals summary:** short −$0.019; hard24 −$0.179; hamburg +$0.882 (also first/pre-§2 + heavier r75 path); individual +$2.501 (analyst iters 14→26, cacheW 27k→868k).
