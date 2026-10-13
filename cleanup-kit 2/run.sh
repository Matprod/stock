#!/usr/bin/env bash
# Usage : ROOT=/chemin/du/depot-backend bash run.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
export ROOT="${ROOT:-$(pwd)}"
export OUT="${OUT:-$HERE/out}"; mkdir -p "$OUT"
S="$ROOT/app/services"
echo "== Lignes par dossier"
for d in report_v4 premium_report report_builder; do
  printf "%-18s fichiers=%3s lignes=%s\n" $d $(find $S/$d -name '*.ts' | wc -l) $(find $S/$d -name '*.ts' | xargs cat | wc -l)
done
echo; echo "== Code atteignable depuis le contrôleur report_v4 (le reste ne sert qu'aux anciennes routes)"
node "$HERE/reach.mjs" | sed -n 1,40p
echo; echo "== Exports sans aucune référence"
node "$HERE/dead-exports.cjs" | head -25
echo; echo "== Plus grosses fonctions"
node "$HERE/function-sizes.cjs"
echo; echo "== Duplications (jscpd, a installer : npm i -D jscpd)"
if [ -x "$ROOT/node_modules/.bin/jscpd" ]; then
  "$ROOT/node_modules/.bin/jscpd" $S/report_v4 $S/premium_report $S/report_builder --min-lines 5 --min-tokens 40 --reporters console --silent | tail -3
else echo "jscpd non installé : npm i -D jscpd"; fi
echo; echo "== Typage"; (cd "$ROOT" && node_modules/.bin/tsc --noEmit --pretty false 2>&1 | tail -15)
