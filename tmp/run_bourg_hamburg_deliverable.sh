#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BOURG='019f5371-fdc5-74c6-bdae-d973b3fa5575'
HAMBURG='019fa7cc-684c-783e-9609-c132a26eb4e3'
BOURG_PROMPT='Bilan staff Bourg-en-Bresse de la semaine dernière: GPS, match et wellness. Synthèse équipe, joueurs à suivre, couverture des données, et fiches individuelles pour chaque joueur du groupe avec graphiques essentiels.'
HAMBURG_PROMPT='Bilan staff des 7 derniers jours (2026-03-01 → 2026-03-07): charge/sRPE, GPS, wellness, sommeil, scores, match si dispo. Synthèse + graphiques essentiels.'

run_one() {
  local tag="$1"
  local club="$2"
  local prompt="$3"
  local free="$4"
  echo "======== START $tag FREE_DESIGNER=$free $(date -u +%H:%M:%S) ========"
  unset REPORT_V4_HTML_PATH REPORT_V4_DOCUMENT_JSON REPORT_V4_HISTORY_JSON \
    REPORT_V4_SESSION_FOCUS_JSON REPORT_V4_DESIGN_PACK_ID REPORT_V4_LANGUAGE
  export REPORT_V4_FREE_DESIGNER="$free"
  export REPORT_V4_FREE_DESIGNER_REFS=1
  export REPORT_V4_SKIP_PDF=0
  export REPORT_V4_BASELINE_DIR=scripts/baseline
  export REPORT_V4_CLUB_ID="$club"
  export REPORT_V4_OUT_TAG="$tag"
  export REPORT_V4_PROMPT="$prompt"
  node --import=ts-node-maintained/register/esm tmp/run_report_v4_generate.ts \
    >"tmp/canari_runs/${tag}.stdout.json" \
    2>"tmp/canari_runs/${tag}.log"
  echo "======== DONE $tag ========"
  tail -5 "tmp/canari_runs/${tag}.log" || true
  rg -n "freeDesigner|TOTAL  │|harvest_empty|lang=|athlete_sheets_prebuilt|coverage|literal_number|autolink" \
    "tmp/canari_runs/${tag}.stdout.json" "tmp/canari_runs/${tag}.log" "tmp/canari_runs/${tag}.meta.json" 2>/dev/null | head -40 || true
}

run_one bourg_fix_classic "$BOURG" "$BOURG_PROMPT" 0
run_one bourg_fix_free "$BOURG" "$BOURG_PROMPT" 1
run_one hamburg_fix_classic "$HAMBURG" "$HAMBURG_PROMPT" 0

echo "ALL DELIVERABLE RUNS COMPLETE $(date -u +%H:%M:%S)"
