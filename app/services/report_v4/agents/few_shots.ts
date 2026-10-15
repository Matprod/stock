type FewShotXml = string

export const ANALYST_FEW_SHOTS: FewShotXml = `
<example id="analyst_scores_individuals_envelope">
  <situation>
    Roster n=21. Linker: ds_6 daily scores (joueur, date_of_day, performance_score, injury_risk_score).
    Coach ask: "Individual evolution of performance and injury-risk scores for my players + team mean min-max."
  </situation>
  <ideal_tool_calls>
    1. add_chart datasetId=ds_6 chartType=line values=["performance_score"] splitAthletes=true title="Performance score"
       → chunks titled "Performance score (i/n)" (never athlete name ranges); layout=individual
    2. add_chart datasetId=ds_6 chartType=line values=["injury_risk_score"] splitAthletes=true title="Injury risk score"
       → separate chunks (perf and injury never share a chart)
    3. aggregate_dataset ds_6 groupBy=date_of_day columns=["performance_score"] ops=[mean,min,max] → ds_perf_env
    4. add_chart datasetId=ds_perf_env chartType=line values=["performance_score_mean","performance_score_min","performance_score_max"] title="Performance — team mean ± min-max"
    5. Same aggregate + envelope chart for injury_risk_score
    6. commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Individuals + team envelope = BOTH. Do not reject splitAthletes here. Staff overview without "individually / my players / every player" still rejects full-roster split.
  </notes>
</example>

<example id="analyst_clinical_injuries_table">
  <situation>
    Linker: ds_9 fetch_injuries (joueur, date_of_injury, recovery_date, status, injury, location, context, contact_type).
    Coach ask: "Injury log / availability for the squad this period."
  </situation>
  <ideal_tool_calls>
    1. add_table datasetId=ds_9 columns=["joueur","date_of_injury","recovery_date","status","injury","location","context"] title="Injury log"
    2. Optional short add_text on ongoing vs recovered counts from the same dataset
    3. commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Clinical injuries ≠ injury_risk_score. Prefer table; do not invent ML risk charts for this ask.
  </notes>
</example>

<example id="analyst_gps_multi_kpi_catalog">
  <situation>
    Roster n=18. periodKpis populated: total_distance_m, hmld_m, hsr_z5_m, explosive_dist_m (Abs).
    Linker: ds_4 fetch_gps_intensity_daily with those columns. Coach ask: GPS volume / intensity briefing (no named Top-N).
  </situation>
  <ideal_tool_calls>
    1. Pick 2–4 distinct families from periodKpis — not distance+HMLD alone (e.g. total_distance_m, hmld_m, hsr_z5_m, explosive_dist_m)
    2. One line or bar ranking per KPI from ds_4 (athletes Top-N or team mean via aggregate / charts_to_team)
    3. Optional watch table with ≥2 GPS columns
    4. commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Use only catalog aliases present on the Linker dataset. Never invent columns outside periodKpis.
  </notes>
</example>

<example id="analyst_match_sam_daily">
  <situation>
    Roster n=22. matchKpis: minutes_played, total_distance, sprint_distance, tackles_won.
    Linker: ds_8 fetch_match_stats_daily (date_of_day, joueur, nb_matchs, minutes_played, total_distance, …),
    ds_9 fetch_match_stats (joueur, nb_matchs, …). Coach ask: match minutes and distance this month.
  </situation>
  <ideal_tool_calls>
    1. Prefer ds_8 for trends (line/bar by date or athlete×day); ds_9 for period totals / Top-N
    2. add_table or add_chart from live match dataset columns only (SkillCorner/SAM names)
    3. commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Match KPIs = sport_activity_metrics on game_activity. Never invent distance_m / intensive_run_m aliases.
    Training GPS stays on fetch_gps_* (game_activity IS NOT TRUE).
  </notes>
</example>

<example id="analyst_roster_poste_join_sequential">
  <situation>
    Linker: ds_roster (joueur, poste), ds_4 GPS daily. Club postes: CB, CM, ST only.
    Coach ask: GPS by position. First filter_dataset poste=MIDFIELDER → poste not found.
  </situation>
  <ideal_tool_calls>
    1. Plan B once: join_datasets datasetIds=[ds_roster, ds_4] keys=["joueur"] → ds_7 (live id from tool — never invent ds_N)
    2. filter_dataset ds_7 column=poste op=eq value="CM" (club poste only)
    3. add_chart / add_table from ds_7
    4. commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Unknown datasetId → reuse available_ids. Never cascade invent-retry. Sequential roster→poste join only.
  </notes>
</example>

<example id="analyst_staff_ask_focused">
  <situation>
    Roster n=21. Linker catalog:
    - ds_1 build_load_summary daily (joueur, date_of_day, srpe_daily, ewma_7, ewma_28, acwr_ewma)
    - ds_2 load summary latest (joueur, srpe_daily, acwr_ewma)
    - ds_4 fetch_gps_intensity_daily (joueur, date_of_day, total_distance_m, hmld_m, hsr_z5_m)
    - ds_5 wellness daily (joueur, date_of_day, body_soreness_rating, mood_rating, quality_rating)
    Coach ask: sRPE + ACWR; GPS multi-KPI Top-3 + team mean; wellness multi-axis; watch table ≥2 metrics. No individual-player lines.
  </situation>
  <ideal_tool_calls>
    1. aggregate_dataset ds_1 groupBy=date_of_day columns=["srpe_daily"] op=mean → add_chart team mean sRPE
    2. add_chart datasetId=ds_2 chartType=bar values=["acwr_ewma"] title="ACWR EWMA latest (sRPE)"
    3. add_text short sRPE / EWMA-7 / EWMA-28 / ACWR glossary
    4. filter_dataset top=3 on GPS → athletes=[...] lines for ≥2 distinct KPIs (e.g. hmld_m + hsr_z5_m) + charts_to_team overlay
    5. Wellness squad: grouped bar if ≥4 same-scale *_rating (radar only for one athlete) else table
    6. add_table watch ≥2 metrics; commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    ANTI-PATTERN: splitAthletes full roster on staff overview without individual ask = FAIL (tool rejects).
    Prefer athletes=[...] or Top-N. Reuse Linker datasetIds only.
  </notes>
</example>

<example id="analyst_narrow_metric">
  <situation>
    Linker catalog: ds_3 only (joueur, date_of_day, hmld_m). Roster n=18.
    Coach ask: "HMLD curve for the 3 highest volumes + team mean, last 7 days." Soft floor.
  </situation>
  <ideal_tool_calls>
    1. aggregate_dataset / filter_dataset top=3 sortBy=hmld_m → identify three athletes
    2. add_chart datasetId=ds_3 chartType=line values=["hmld_m"] athletes=["Player A","Player B","Player C"] title="HMLD — Top 3"
    3. charts_to_team id=chart_1 mode=overlay
    4. Optional add_table of the three totals
    5. commit_report_brief (thin) then end_turn
  </ideal_tool_calls>
  <notes>
    Do not densify to wellness/scores/load. No splitAthletes. One chart answers the ask.
  </notes>
</example>

<example id="analyst_section_domain_columns">
  <situation>
    Linker: ds_wellness (body_soreness_rating, mood_rating), ds_gps (total_distance_m, hmld_m, hsr_z5_m).
    Coach ask: wellness band then GPS band, then individual sheets for outliers.
  </situation>
  <ideal_tool_calls>
    1. add_heading "Wellness" → add_chart/add_table from ds_wellness columns only
    2. add_heading "GPS" → add_chart/add_table from ds_gps columns only
    3. athlete sheets already built by code for watch athletes — never per-athlete heading loops
    4. add_sheet_comments once with comments:[{athlete,text}] then commit_report_brief then end_turn
  </ideal_tool_calls>
  <notes>
    Table columns MUST match the section domain: never put GPS distance/hmld/hsr columns under a Wellness heading (or vice versa). Athlete sheet heading A must not host athlete B's table.
  </notes>
</example>
`.trim()

export const DESIGNER_FEW_SHOTS: FewShotXml = `
<example id="designer_hosts">
  <situation>
    get_design_context → charts[] with stable ids + InsightIR sections. CSS server-injected. set_report_html only.
  </situation>
  <notes>
    Structure: cover → toc → executive → domain bands → outliers/watch → athlete sheets → reliability.
    Every requiredChartIds as empty chart-box with verbatim id — never invent chart_1..N. Titles = charts[].title / InsightIR (never Group N).
    .band is header-only — never nest .card / chart-box inside .band. Individual sheets: one athlete heading → that athlete's chart ids only.
    Narrow ask: skip TOC/KPI scaffolding.
  </notes>
</example>
`.trim()
