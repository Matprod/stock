#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CLUB='019fa7cc-684c-783e-9609-c132a26eb4e3'
OUT_ROOT=tmp/canari_runs
BASE_DIR=scripts/baseline
mkdir -p "$OUT_ROOT" "$BASE_DIR"

run_one() {
  local tag="$1"
  local refs="$2"
  local prompt="$3"
  echo "======== START $tag refs=$refs $(date -u +%H:%M:%S) ========"
  unset REPORT_V4_HTML_PATH REPORT_V4_DOCUMENT_JSON REPORT_V4_HISTORY_JSON \
    REPORT_V4_SESSION_FOCUS_JSON REPORT_V4_DESIGN_PACK_ID
  export REPORT_V4_FREE_DESIGNER=1
  export REPORT_V4_FREE_DESIGNER_REFS="$refs"
  export REPORT_V4_SKIP_PDF=0
  export REPORT_V4_BASELINE_DIR="$BASE_DIR"
  export REPORT_V4_CLUB_ID="$CLUB"
  export REPORT_V4_OUT_TAG="$tag"
  export REPORT_V4_PROMPT="$prompt"
  node --import=ts-node-maintained/register/esm tmp/run_report_v4_generate.ts \
    >"$OUT_ROOT/${tag}.stdout.json" \
    2>"$OUT_ROOT/${tag}.log" || {
      echo "FAIL $tag exit=$?"
      return 1
    }
  echo "======== DONE $tag $(date -u +%H:%M:%S) ========"
  tail -3 "$OUT_ROOT/${tag}.log" || true
  rg -n "TOTAL  │|agent-stop  │  designer|free_designer|capture_review|layout_warn|refs=" \
    "$OUT_ROOT/${tag}.stdout.json" | head -40 || true
}

HAMBURG='Bilan staff des 7 derniers jours (2026-03-01 → 2026-03-07): charge/sRPE, GPS, wellness, sommeil, scores, match si dispo. Synthèse + graphiques essentiels.'
INDIVIDUAL='Fiches individuelles pour chaque joueur du groupe sur la période 2026-03-01 → 2026-03-07: wellness, GPS et scores. Une fiche par athlète avec graphiques essentiels.'
SHORT='Un seul tableau: top 10 distance GPS totale sur 2026-03-01 → 2026-03-07.'
HARD24='Rapport staff difficile: inclure un long tableau nominatif d au moins 24 joueurs (colonnes: poste, distance totale, HMLD, HSR, sRPE moyen, score perf, score risque) pour 2026-03-01 → 2026-03-07, plus 2 graphiques de synthèse équipe (charge et GPS).'
ALT_ASK='Focus sommeil et wellness seulement, 2026-03-01 → 2026-03-07: tendances équipe, joueurs à risque, sans tableau GPS nominatif.'

# 4 baselines × refs on/off
run_one s5_short_refs1 1 "$SHORT"
run_one s5_short_refs0 0 "$SHORT"
run_one s5_hamburg_refs1 1 "$HAMBURG"
run_one s5_hamburg_refs0 0 "$HAMBURG"
run_one s5_hard24_refs1 1 "$HARD24"
run_one s5_hard24_refs0 0 "$HARD24"
run_one s5_individual_refs1 1 "$INDIVIDUAL"
run_one s5_individual_refs0 0 "$INDIVIDUAL"

# Freedom: same ask twice with refs
run_one s5_freedom_indiv_a 1 "$INDIVIDUAL"
run_one s5_freedom_indiv_b 1 "$INDIVIDUAL"
# Freedom: very different ask with refs
run_one s5_freedom_alt 1 "$ALT_ASK"

echo "ALL STEP5 RUNS COMPLETE $(date -u +%H:%M:%S)"
