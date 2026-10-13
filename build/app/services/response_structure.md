# Response structure modules

Loaded by tool `get_response_structure`. Each block is returned in full when the model passes the matching `intent`.

---

## Intent: metric_deep_analysis

**When:** User wants a deep dive on **one** specific metric or signal (trends, drivers, status vs target).

**Structure (markdown):**

- `# Deep analysis: <metric name>` — metric name only; no meta words like "auto-selected".
- `## Current status` — Short definition (coach language). Current vs optimal if data allows; deviation class (overload/underload/instability/imbalance for load; poor→excellent or low→severe for wellness/sleep). Why it matters (max 3 sentences).
- `## Contributing variables` — Only if tool data supports it: up to **3** lowest-level contributors.
- `## Impact on session focus` — Max 3 sentences tying to category score / outcome using tool data only.

**Weekly trends for contributing variables (charts — do this before the final written answer when it applies):**

Applies when this section is used and you have **≥3 distinct days** of numeric values for a contributor (even if the user did not say "chart" or "graph").

1. **Data:** The series must be in tool results. If not, call `query_database` to fetch it (tight SELECT, chronological dates).
2. **One chart per contributor variable:** Call `suggest_chart` with `kind: "line"`. `labels` = dates in order; first dataset `data` = numeric values; `title` = coach-facing variable name + unit. Set `yAxes` min/max from the actual range; use two axes (`y` / `y1`) and `yAxisID` on datasets only if two different scales are on the same figure.
3. **After the required charts:** Add **one** short interpretation paragraph per variable (attribution language, not causal) explaining , how each variable influences the composite metric (increases or decreases it).
   . Do **not** replace charts with long duplicate bullet lists of the same dates/values; at most one short numeric highlight line if helpful.
4. **Exceptions:** If fewer than 3 days, or a single value only, skip the chart and use a **compact** bullet list (date, value, unit, optional delta vs previous).
5. If contributor data is missing or unusable, output exactly: `Contributing variable analysis cannot be produced due to missing or non-compliant data.`

**Rules:** No internal DB/column names. Numbers only from tools. Same language as the user.Use ONLY professional football terminology for variable names. NEVER use internal identifiers with underscores, codes, or database names.

---

## Intent: strategic_evaluation

**When:** User asks what to do, what matters most, trade-offs, prioritisation, or explanatory "why" about decisions (not a single-metric template).

**Structure:** Use `#` for one opening title, then **paragraphs** (optionally `##` subsections). Present trade-offs and priorities clearly. **Do not** use the Global or Deep Analysis templates.

**Rules:** No chain-of-thought. Ground claims in tool data. No recommendations unless the user asked for them.

---

## Intent: conceptual_clarification

**When:** User asks what a term or metric **means** (definition), not a full data story.

**Structure:** At most **3 short sentences** or one small bullet list. No long mechanisms unless the user explicitly asked for physiology.

**Rules:** Coach-facing terms only; no internal identifiers.

---

## Intent: hypothesis_claim_checking

**When:** User states a fact, trend, or comparison you must verify against tool outputs.

**Structure:** Brief correction or confirmation using **actual values** from tools, woven into a professional reply (not a checklist). Then continue with the minimal extra context needed.

**Rules:** If the claim is wrong, correct before reasoning further.

---

## Intent: direct_data_question

**When:** User wants a **short factual** answer (value, count, yes/no, last date) with no full report.

**Structure:** 1–3 sentences and/or a tiny bullet list. Optional single `#` title if it helps scannability.

**Rules:** Only tool-backed facts; say if data is missing.

---

## Intent: global_analysis

**When:** User wants a **holistic** view of the day or category (scores across activity / sleep / health).

**Structure:**

- Optional line: injury risk score for the reference day **if** present in tools.
- For each relevant domain (Activity, Sleep, Health): `# <Domain> (score: X)` if you have a score; up to **4** priority features per domain from tool data; per feature: high/low vs guidance + **one** impact sentence (do not repeat the feature name in that sentence). Skip empty domains.
- Short closing on impact on the session focus (performance vs injury as applicable).

**Rules:** Domain-scoped questions must not expand into unrelated domains unless asked.

---

## Intent: contributing_variable_analysis

**When:** User explicitly wants contributing / underlying variables for a composite or feature (standalone, not embedded deep analysis).

**Structure:**

- `### Composite reminder` — Name, current vs optimal if available, role (2–3 sentences).
- `### Variable definitions` — One short block per variable (up to **4** variables): definition + football meaning.
- `# Weekly trend analysis` — One short intro sentence, then follow the **chart protocol** below for each contributing variable before writing long prose.
- `### Relation to composite` — How each variable pushes the composite up/down; **bold** variable name when stating directional effect.

**Chart protocol (weekly / multi-day trends — before final prose in this section):**

For **each** contributing variable with **≥3 distinct days** of values in tool data (user does not need to ask for a graph):

1. Ensure the daily series is loaded (`query_database` if it is not already in context).
2. Call `suggest_chart` with `kind: "line"`: chronological dates in `labels`, values in the first dataset, coach-facing `title` with unit, `yAxes` min/max from data; dual `y` / `y1` only when two scales share one chart.
3. After all charts for this section, add **one** interpretation paragraph per variable (attribution language, not causal). Do not duplicate the full series as long bullet lists.
4. If **<3** points or the user explicitly wants numbers only: compact bullets only (date, value, unit, optional delta vs previous).

**Rules:** Use raw daily metrics from tools when available; no internal codes in output.

---

## Intent: general

**When:** None of the other intents fit, or the question is mixed / light.

**Structure:** Clear `#` title, `##` subsections if useful, `-` bullets. Be concise and actionable.

**Rules:** Tool-grounded facts; same language as the user; no internal identifiers.
