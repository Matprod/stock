// Graphiques de Report-v4 : une spécification (ChartSpec), un rendu en code, des contrôles, des opérations douces bornées.
// Aucune valeur chiffrée ni couleur dans la spécification : les données viennent de `rows`, les couleurs du pack.
// Fonctions pures. En Node, les intentions sont lues dans chart-intents.json ; dans le navigateur, appeler setIntents(json).

import fs from 'node:fs';

let INTENTS = null;
export function setIntents(json) { INTENTS = json.intents || json; }
export function intents() {
  if (!INTENTS) INTENTS = JSON.parse(fs.readFileSync(new URL('./chart-intents.json', import.meta.url), 'utf8')).intents;
  return INTENTS;
}

/* ---------- jetons du pack ---------- */

/** Table `$jeton` -> couleur pour un pack et un mode ('light' = clair et impression, 'dark' = écran sombre). */
export function tokenMap(pack, mode = 'light') {
  const dark = mode === 'dark' && !!pack.dark;
  const t = dark ? pack.dark : pack.light;
  const m = {};
  (dark ? pack.series.dark : pack.series.light).forEach((c, i) => { m[`$series-${i + 1}`] = c; });
  (dark ? (pack.sequential.dark || pack.sequential.light) : pack.sequential.light).forEach((c, i) => { m[`$seq-${i + 1}`] = c; });
  const d = (dark && pack.diverging.dark) || pack.diverging.light;
  d.good.forEach((c, i) => { m[`$div-good-${i + 1}`] = c; });
  d.bad.forEach((c, i) => { m[`$div-bad-${i + 1}`] = c; });
  m['$div-mid'] = d.mid;
  Object.assign(m, {
    '$paper': t.paper, '$card': t.card, '$ink': t.ink, '$ink-2': t.ink2, '$muted': t.muted, '$faint': t.faint, '$line': t.line, '$accent': t.accent,
    '$risk': t.status.risk.fill, '$watch': t.status.watch.fill, '$ok': t.status.ok.fill, '$under': t.under,
  });
  return m;
}

const TOKEN = /^\$[a-z][a-z0-9-]*$/;
/** Remplace chaque chaîne `$jeton` par la couleur du pack. Un jeton inconnu est une erreur, jamais une couleur par défaut. */
export function resolveTokens(node, map) {
  if (typeof node === 'string') {
    if (!TOKEN.test(node)) return node;
    if (!(node in map)) throw new Error(`jeton inconnu : ${node}`);
    return map[node];
  }
  if (Array.isArray(node)) return node.map((x) => resolveTokens(x, map));
  if (node && typeof node === 'object') {
    const o = {};
    for (const k of Object.keys(node)) o[k] = resolveTokens(node[k], map);
    return o;
  }
  return node;
}

/* ---------- outils ---------- */

const fmt = (v, d = 1) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: d });
const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
const rel = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrastRatio = (a, b) => { const [h, l] = [rel(a), rel(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };

const visible = (spec) => spec.entities.filter((e) => !e.hidden);
const entityOf = (spec, id) => spec.entities.find((e) => e.id === id);
const fieldsOf = (spec) => ({ x: spec.data.fields.x, y: spec.data.fields.y, by: spec.data.fields.by, kind: spec.data.fields.kind });

/** Lignes dans la fenêtre demandée (comparaison de chaînes ISO) et pour les entités visibles. */
export function selectRows(spec, rows) {
  const f = fieldsOf(spec);
  const vis = new Set(visible(spec).map((e) => e.id));
  return rows.filter((r) => {
    if (spec.window && f.x && (r[f.x] < spec.window.from || r[f.x] > spec.window.to)) return false;
    if (f.by && !vis.has(r[f.by])) return false;
    return true;
  });
}

export function dataRange(spec, rows) {
  const f = fieldsOf(spec);
  if (!f.x) return null;
  const xs = rows.map((r) => r[f.x]).sort();
  return { from: xs[0], to: xs[xs.length - 1] };
}

const uniqueSorted = (arr) => [...new Set(arr)].sort();

/* ---------- choix et validation de forme ---------- */

export function chooseForm(intent) { const i = intents()[intent]; if (!i) throw new Error(`intention inconnue : ${intent}`); return i.default; }

/** Contrôles de cohérence de la spécification (le schéma JSON couvre la structure ; ici le sens). Renvoie une liste de {code, detail}. */
export function validateSpec(spec, rows = null) {
  const issues = [];
  const it = intents()[spec.intent];
  if (!it) return [{ code: 'intent_unknown', detail: spec.intent }];
  if (!it.forms.includes(spec.form)) issues.push({ code: 'form_not_permitted', detail: `${spec.form} n'est pas permis pour l'intention ${spec.intent} (${it.forms.join(', ')})` });
  if (spec.form === 'waterfall' && spec.data.additive !== true) issues.push({ code: 'form_needs_additive', detail: 'la cascade exige data.additive = true' });
  if (spec.entities.length > it.maxEntities) issues.push({ code: 'too_many_entities', detail: `${spec.entities.length} > ${it.maxEntities}` });
  const slots = spec.entities.map((e) => e.slot);
  if (new Set(slots).size !== slots.length) issues.push({ code: 'slot_duplicate', detail: slots.join(',') });
  if (spec.zones && spec.data.metric !== 'acwr') issues.push({ code: 'zones_not_applicable', detail: `zones ${spec.zones} sur la métrique ${spec.data.metric}` });
  for (const h of spec.highlight || []) {
    const known = spec.entities.some((e) => e.id === h) || (rows && Object.values(fieldsOf(spec)).length && rows.some((r) => r[spec.data.fields.x] === h));
    if (!known) issues.push({ code: 'highlight_unknown', detail: h });
  }
  if (spec.y_range) {
    if (!(spec.y_range.min < spec.y_range.max)) issues.push({ code: 'y_range_invalid', detail: 'min doit être inférieur à max' });
    if (['bar', 'barh', 'hist', 'waterfall'].includes(spec.form) && spec.y_range.min !== 0) issues.push({ code: 'y_range_truncates_bars', detail: 'une barre part toujours de zéro' });
  }
  if (spec.form === 'bar' && spec.intent === 'trend' && rows) {
    const f = fieldsOf(spec);
    if (new Set(selectRows(spec, rows).map((r) => r[f.x])).size > 12) issues.push({ code: 'bar_too_many_points', detail: 'plus de 12 points de temps : utiliser une courbe' });
  }
  if (spec.window && !(spec.window.from <= spec.window.to)) issues.push({ code: 'window_empty', detail: 'from doit précéder to' });
  return issues;
}

/* ---------- construction de l'option (avec des jetons $) ---------- */

const dashOf = (pack, slot) => pack.chart.dashByIndex[(slot - 1) % 8];
const symOf = (pack, slot) => pack.chart.symbolByIndex[(slot - 1) % 8];
const col = (slot) => `$series-${slot}`;

function baseOption(spec, pack, extra = {}) {
  const vis = visible(spec);
  return {
    animation: false,
    aria: { enabled: true, label: { description: spec.title || spec.id } },
    grid: { left: 52, right: 24, top: vis.length >= 2 ? 44 : 20, bottom: 32 },
    legend: { show: vis.length >= 2, top: 4, left: 0 },
    tooltip: { trigger: 'axis' },
    ...extra,
  };
}

const niceTop = (maxY, th) => Math.ceil(Math.max(maxY * 1.08, th[2] * 1.2) * 10) / 10;

function lineOption(spec, rows, pack) {
  const f = fieldsOf(spec), R = selectRows(spec, rows), xs = uniqueSorted(R.map((r) => r[f.x]));
  const vis = visible(spec), hl = new Set(spec.highlight || []);
  const direct = spec.labels === 'direct' && vis.length <= 4;
  const maxY = Math.max(...R.map((r) => r[f.y]));
  const th = pack.zones.thresholds;
  const series = vis.map((e, i) => {
    const byX = new Map(R.filter((r) => !f.by || r[f.by] === e.id).map((r) => [r[f.x], r[f.y]]));
    const faded = hl.size > 0 && !hl.has(e.id);
    const s = {
      id: `${spec.id}:${e.id}`, name: e.label, type: 'line', data: xs.map((x) => (byX.has(x) ? byX.get(x) : null)), connectNulls: false,
      color: col(e.slot), itemStyle: { color: col(e.slot) },
      lineStyle: { color: col(e.slot), width: hl.has(e.id) ? pack.chart.lineWidth + 1.5 : pack.chart.lineWidth, type: dashOf(pack, e.slot), opacity: faded ? 0.4 : 1 },
      symbol: symOf(pack, e.slot), symbolSize: pack.chart.symbolSize, showSymbol: xs.length <= 30,
    };
    if (direct) s.endLabel = { show: true, formatter: '{a}', color: '$ink-2', distance: 6 };
    if (i === 0 && spec.zones === 'acwr') {
      const L = pack.zones.labels, top = niceTop(maxY, th);
      s.markArea = {
        silent: true, label: { show: true, position: 'insideTopLeft', color: '$muted', fontSize: 10 },
        data: [
          [{ yAxis: 0, name: L[0], itemStyle: { color: '$under', opacity: 0.12 } }, { yAxis: th[0] }],
          [{ yAxis: th[0], name: L[1], itemStyle: { color: '$ok', opacity: 0.12 } }, { yAxis: th[1] }],
          [{ yAxis: th[1], name: L[2], itemStyle: { color: '$watch', opacity: 0.14 } }, { yAxis: th[2] }],
          [{ yAxis: th[2], name: L[3], itemStyle: { color: '$risk', opacity: 0.12 } }, { yAxis: top }],
        ],
      };
    }
    return s;
  });
  const yAxis = { type: 'value', scale: !spec.zones && !spec.y_range };
  if (spec.zones === 'acwr') { yAxis.min = 0; yAxis.max = niceTop(maxY, th); }
  if (spec.y_range) { yAxis.min = spec.y_range.min; yAxis.max = spec.y_range.max; yAxis.scale = false; }
  return baseOption(spec, pack, {
    grid: { left: 52, right: direct ? 96 : 24, top: vis.length >= 2 ? 44 : 20, bottom: 32 },
    xAxis: { type: 'category', data: xs, boundaryGap: false }, yAxis, series,
  });
}

function barOption(spec, rows, pack, horizontal) {
  const f = fieldsOf(spec), R = selectRows(spec, rows), vis = visible(spec);
  const hl = new Set(spec.highlight || []), sortMode = spec.sort || (horizontal ? 'desc' : 'natural');
  const direct = spec.labels === 'direct';
  const grouped = !!f.by && vis.length > 1;
  let cats;
  if (grouped) cats = uniqueSorted(R.map((r) => r[f.x]));
  else {
    const e = vis[0];
    const pts = R.map((r) => ({ c: r[f.x], v: r[f.y] }));
    if (sortMode === 'desc') pts.sort((a, b) => b.v - a.v); else if (sortMode === 'asc') pts.sort((a, b) => a.v - b.v);
    cats = pts.map((p) => p.c);
    const lab = (v) => ({ show: direct, position: horizontal ? 'right' : 'top', color: '$ink-2', formatter: fmt(v) });
    const data = pts.map((p) => ({
      value: p.v, label: lab(p.v),
      itemStyle: { color: hl.size > 0 && !hl.has(p.c) ? '$faint' : col(e.slot) },
    }));
    const value = { type: 'value', min: spec.y_range ? spec.y_range.min : 0, ...(spec.y_range ? { max: spec.y_range.max } : {}) };
    const category = { type: 'category', data: cats, inverse: horizontal };
    return baseOption(spec, pack, {
      legend: { show: false }, tooltip: { trigger: 'item' },
      grid: { left: horizontal ? 112 : 52, right: horizontal ? 48 : 24, top: 20, bottom: 32 },
      xAxis: horizontal ? value : category, yAxis: horizontal ? category : value,
      series: [{ id: `${spec.id}:${e.id}`, name: e.label, type: 'bar', data, barMaxWidth: 28, label: { show: direct, position: horizontal ? 'right' : 'top', color: '$ink-2' }, itemStyle: { borderRadius: horizontal ? [0, pack.chart.barRadius, pack.chart.barRadius, 0] : [pack.chart.barRadius, pack.chart.barRadius, 0, 0] } }],
    });
  }
  const series = vis.map((e) => {
    const byX = new Map(R.filter((r) => r[f.by] === e.id).map((r) => [r[f.x], r[f.y]]));
    const faded = hl.size > 0 && !hl.has(e.id);
    return {
      id: `${spec.id}:${e.id}`, name: e.label, type: 'bar', barMaxWidth: 28, barGap: '8%',
      data: cats.map((c) => (byX.has(c) ? byX.get(c) : null)),
      itemStyle: { color: col(e.slot), opacity: faded ? 0.45 : 1, borderRadius: horizontal ? [0, pack.chart.barRadius, pack.chart.barRadius, 0] : [pack.chart.barRadius, pack.chart.barRadius, 0, 0] },
      label: { show: direct, position: horizontal ? 'right' : 'top', color: '$ink-2', fontSize: 10 },
    };
  });
  const value = { type: 'value', min: spec.y_range ? spec.y_range.min : 0, ...(spec.y_range ? { max: spec.y_range.max } : {}) };
  const category = { type: 'category', data: cats, inverse: horizontal };
  return baseOption(spec, pack, { xAxis: horizontal ? value : category, yAxis: horizontal ? category : value, series, tooltip: { trigger: 'axis' } });
}

function histOption(spec, rows, pack, reference) {
  const f = fieldsOf(spec), vals = selectRows(spec, rows).map((r) => r[f.y]).filter((v) => Number.isFinite(v));
  const n = vals.length, k = Math.max(3, Math.ceil(Math.log2(n) + 1));
  const lo = Math.min(...vals), hi = Math.max(...vals), w = (hi - lo) / k || 1;
  const counts = Array(k).fill(0);
  vals.forEach((v) => { counts[Math.min(k - 1, Math.floor((v - lo) / w))]++; });
  const cats = counts.map((_, i) => `${fmt(lo + i * w)}–${fmt(lo + (i + 1) * w)}`);
  const e = visible(spec)[0];
  const s = { id: `${spec.id}:${e.id}`, name: e.label, type: 'bar', data: counts, barCategoryGap: '8%', itemStyle: { color: col(e.slot), borderRadius: [pack.chart.barRadius, pack.chart.barRadius, 0, 0] }, label: { show: spec.labels === 'direct', position: 'top', color: '$ink-2' } };
  if (spec.reference && Number.isFinite(reference)) {
    const bin = Math.min(k - 1, Math.max(0, Math.floor((reference - lo) / w)));
    s.markArea = { silent: true, label: { show: true, position: 'top', color: '$ink', fontSize: 11 }, itemStyle: { color: '$ink', opacity: 0.12 }, data: [[{ xAxis: cats[bin], name: 'Joueur' }, { xAxis: cats[bin] }]] };
  }
  return baseOption(spec, pack, {
    legend: { show: false }, tooltip: { trigger: 'item' }, grid: { left: 52, right: 24, top: 24, bottom: 44 },
    xAxis: { type: 'category', data: cats }, yAxis: { type: 'value', min: 0 }, series: [s],
  });
}

function waterfallOption(spec, rows, pack) {
  const f = fieldsOf(spec);
  const labels = rows.map((r) => r[f.x]);
  const base = [], up = [], down = [], total = [];
  let cum = 0;
  rows.forEach((r) => {
    const v = r[f.y], kind = r[f.kind];
    const lab = (txt) => ({ show: true, position: 'top', color: '$ink-2', formatter: txt });
    if (kind === 'start' || kind === 'end') { base.push(null); up.push(null); down.push(null); total.push({ value: v, label: lab(fmt(v)) }); cum = v; }
    else if (v >= 0) { base.push(cum); up.push({ value: v, label: lab(signed(v)) }); down.push(null); total.push(null); cum += v; }
    else { cum += v; base.push(cum); down.push({ value: -v, label: lab(signed(v)) }); up.push(null); total.push(null); }
  });
  const mk = (name, data, color) => ({ name, type: 'bar', stack: 'wf', data, barMaxWidth: 36, itemStyle: { color } });
  return baseOption(spec, pack, {
    legend: { show: false }, tooltip: { show: false }, grid: { left: 52, right: 24, top: 28, bottom: 56 },
    xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, fontSize: 10, overflow: 'break', lineHeight: 12 } }, yAxis: { type: 'value', min: 0 },
    series: [{ name: 'base', type: 'bar', stack: 'wf', silent: true, data: base, itemStyle: { color: 'transparent' } }, mk('Hausse', up, '$div-bad-3'), mk('Baisse', down, '$div-good-3'), mk('Total', total, '$ink-2')],
  });
}

function divergingOption(spec, rows, pack) {
  const f = fieldsOf(spec), R = selectRows(spec, rows).map((r) => ({ c: r[f.x], v: r[f.y] }));
  const mode = spec.sort || 'desc';
  if (mode === 'desc') R.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); else if (mode === 'asc') R.sort((a, b) => Math.abs(a.v) - Math.abs(b.v));
  const step = (v) => { const a = Math.abs(v); return a < 1 ? 1 : a < 2 ? 2 : a < 3 ? 3 : 4; };
  const m = Math.ceil(Math.max(...R.map((r) => Math.abs(r.v)), 1));
  const e = visible(spec)[0];
  const data = R.map((r) => ({ value: r.v, itemStyle: { color: r.v >= 0 ? `$div-bad-${step(r.v)}` : `$div-good-${step(r.v)}` }, label: { show: true, position: r.v >= 0 ? 'right' : 'left', color: '$ink-2', formatter: signed(r.v) } }));
  return baseOption(spec, pack, {
    legend: { show: false }, tooltip: { trigger: 'item' }, grid: { left: 176, right: 48, top: 20, bottom: 32 },
    xAxis: { type: 'value', min: -m, max: m }, yAxis: { type: 'category', data: R.map((r) => r.c), inverse: true, axisLine: { show: true, lineStyle: { color: '$ink-2' } }, axisLabel: { position: 'left' } },
    series: [{ id: `${spec.id}:${e.id}`, name: e.label, type: 'bar', data, barMaxWidth: 22 }],
  });
}

/** Option ECharts avec jetons $ non résolus. */
export function buildOption(spec, rows, { pack, reference } = {}) {
  switch (spec.form) {
    case 'line': return lineOption(spec, rows, pack);
    case 'bar': return barOption(spec, rows, pack, false);
    case 'barh': return barOption(spec, rows, pack, true);
    case 'hist': return histOption(spec, rows, pack, reference);
    case 'waterfall': return waterfallOption(spec, rows, pack);
    case 'diverging_bar': return divergingOption(spec, rows, pack);
    default: throw new Error(`forme non implémentée : ${spec.form}`);
  }
}

/** Option ECharts finale, jetons résolus pour le mode demandé. */
export function renderChart(spec, rows, { pack, mode = 'light', reference } = {}) {
  return resolveTokens(buildOption(spec, rows, { pack, reference }), tokenMap(pack, mode));
}

/** Contenu d'une vue tableau (labels = "table") : en-tête et lignes, formatées par le code. */
export function tableView(spec, rows) {
  const f = fieldsOf(spec), R = selectRows(spec, rows);
  const cols = [f.x, f.by, f.y, f.kind].filter(Boolean);
  return { head: cols, body: R.map((r) => cols.map((c) => r[c])) };
}

/* ---------- contrôles ---------- */

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
function walk(node, fn, path = '') {
  if (typeof node === 'string') fn(node, path);
  else if (Array.isArray(node)) node.forEach((x, i) => walk(x, fn, `${path}[${i}]`));
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) walk(node[k], fn, path ? `${path}.${k}` : k);
}

/**
 * Contrôles sur l'option résolue. Renvoie une liste d'échecs {check, detail} ; liste vide = rendu accepté.
 * Les contrôles qui exigent le DOM (chevauchement d'étiquettes, débordement de page) restent ceux de la phase F.
 */
export function checkOption(option, spec, { pack, mode = 'light' }) {
  const fail = [];
  const map = tokenMap(pack, mode), allowed = new Set(Object.values(map).map((c) => c.toLowerCase()));
  walk(option, (s, p) => {
    if (/^\$[a-z]/.test(s)) fail.push({ check: 'unresolved_token', detail: `${p} = ${s}` });
    else if (HEX.test(s) && !allowed.has(s.toLowerCase())) fail.push({ check: 'color_outside_pack', detail: `${p} = ${s}` });
  });
  const series = option.series || [];
  if (Array.isArray(option.yAxis) && option.yAxis.length > 1) fail.push({ check: 'dual_axis', detail: 'deux axes de valeurs' });
  const vis = visible(spec);

  if (spec.form === 'line') {
    series.forEach((s, i) => {
      const slot = vis[i].slot;
      if (s.lineStyle?.type !== dashOf(pack, slot) || s.symbol !== symOf(pack, slot)) fail.push({ check: 'series_encoding', detail: `${s.name} : tiret ou marqueur différent de celui du rang ${slot}` });
    });
  }
  if (vis.length >= 2 && !option.legend?.show) fail.push({ check: 'legend_missing', detail: `${vis.length} séries sans légende` });

  const t = mode === 'dark' && pack.dark ? pack.dark : pack.light;
  const usesSeriesColor = ['line', 'bar', 'barh', 'hist'].includes(spec.form);
  if (usesSeriesColor) {
    const low = vis.filter((e) => Math.min(contrastRatio(map[col(e.slot)], t.paper), contrastRatio(map[col(e.slot)], t.card)) < 3);
    const labelsShown = series.length > 0 && series.every((s) => s.endLabel?.show || s.label?.show);
    if (low.length && !labelsShown && spec.labels !== 'table') fail.push({ check: 'relief_missing', detail: `couleurs sous 3:1 (${low.map((e) => e.label).join(', ')}) sans étiquettes visibles ni vue tableau` });
  }
  if (spec.form === 'line' && spec.labels === 'direct' && vis.length > 4) fail.push({ check: 'direct_labels_limit', detail: 'étiquettes directes limitées à 4 séries' });

  if (['bar', 'barh', 'hist', 'waterfall'].includes(spec.form)) {
    const axis = spec.form === 'barh' ? option.xAxis : option.yAxis;
    if (axis?.min !== 0 && !(spec.y_range && spec.y_range.min === 0)) fail.push({ check: 'bar_baseline', detail: 'axe des valeurs d\'une barre qui ne part pas de zéro' });
  }
  if (spec.zones && series.some((s, i) => vis[i] && vis[i].slot === 8)) fail.push({ check: 'status_vs_series', detail: 'la série rouge (rang 8) est réservée aux statuts et la zone ACWR est affichée' });
  return fail;
}

/** Cascade : début + somme des contributions = fin (tolérance 1e-6). */
export function checkAdditive(rows, spec) {
  const f = fieldsOf(spec);
  const start = rows.find((r) => r[f.kind] === 'start'), end = rows.find((r) => r[f.kind] === 'end');
  if (!start || !end) return [{ check: 'waterfall_sum', detail: 'début ou fin manquant' }];
  const sum = rows.filter((r) => r[f.kind] === 'delta').reduce((a, r) => a + r[f.y], 0);
  return Math.abs(start[f.y] + sum - end[f.y]) > 1e-6 ? [{ check: 'waterfall_sum', detail: `${start[f.y]} + ${sum} ≠ ${end[f.y]}` }] : [];
}

/** Rendu complet + tous les contrôles de code. */
export function renderChecked(spec, rows, { pack, mode = 'light', reference } = {}) {
  const issues = validateSpec(spec, rows);
  if (issues.length) return { ok: false, issues, failures: [], option: null };
  const f = fieldsOf(spec);
  const extra = spec.form === 'waterfall' ? checkAdditive(rows, spec) : [];
  if (spec.window && f.x) {
    const r = dataRange(spec, rows);
    if (spec.window.from < r.from || spec.window.to > r.to) extra.push({ check: 'window_in_data', detail: `fenêtre hors des données (${r.from} à ${r.to})` });
  }
  const option = renderChart(spec, rows, { pack, mode, reference });
  const failures = [...extra, ...checkOption(option, spec, { pack, mode })];
  return { ok: failures.length === 0, issues: [], failures, option };
}

/* ---------- édition douce : chart_op ---------- */

export const CHART_PARAMS = ['form', 'window', 'entities', 'highlight', 'sort', 'labels', 'zones', 'size', 'caption', 'y_range'];
const ENUMS = { sort: ['desc', 'asc', 'natural'], labels: ['direct', 'legend', 'table'], size: ['hero', 'wide', 'pair'], caption: ['full', 'short', 'none'] };

const refuse = (code, detail) => ({ ok: false, code, detail });

/**
 * Applique `set` (réglages bornés) à une spécification, sans effet de bord. Sémantique « fixer » : idempotente.
 * Refus typés ; si un contrôle de rendu échoue après changement, la spécification d'origine est conservée (code check_failed).
 * Aucun effet de bord : l'essai à blanc consiste à ne pas enregistrer le résultat ; l'appelant ne remplace la spécification que si `ok`.
 */
export function applyChartOp(spec, set, { rows, pack, mode = 'light', reference } = {}) {
  const keys = Object.keys(set || {});
  if (!keys.length) return refuse('empty_set', 'aucun réglage');
  for (const k of keys) if (!CHART_PARAMS.includes(k)) return refuse('param_unknown', k);
  const next = JSON.parse(JSON.stringify(spec));
  for (const k of keys) {
    const v = set[k];
    if (k in ENUMS) { if (!ENUMS[k].includes(v)) return refuse('value_not_allowed', `${k} = ${v}`); next[k] = v; continue; }
    if (k === 'form') {
      const it = intents()[spec.intent];
      if (!it.forms.includes(v)) return refuse('form_not_permitted', `${v} pour l'intention ${spec.intent} (permis : ${it.forms.join(', ')})`);
      if (v === 'waterfall' && spec.data.additive !== true) return refuse('form_needs_additive', 'données non additives');
      next.form = v;
    } else if (k === 'window') {
      if (v === null) { delete next.window; continue; }
      if (!(v.from <= v.to)) return refuse('window_empty', 'from doit précéder to');
      const r = dataRange(spec, rows);
      if (!r || v.from < r.from || v.to > r.to) return refuse('window_outside_data', `les données couvrent ${r ? r.from + ' à ' + r.to : 'aucune période'}`);
      next.window = { from: v.from, to: v.to };
    } else if (k === 'entities') {
      const ids = new Set(spec.entities.map((e) => e.id));
      for (const id of v) if (!ids.has(id)) return refuse('entity_unknown', id);
      if (!v.length) return refuse('entity_empty', 'au moins une entité visible');
      next.entities = spec.entities.map((e) => ({ ...e, hidden: !v.includes(e.id) }));
      if (!next.entities.some((e) => e.hidden)) next.entities.forEach((e) => delete e.hidden);
    } else if (k === 'highlight') {
      const known = new Set([...spec.entities.map((e) => e.id), ...(rows || []).map((r) => r[spec.data.fields.x])]);
      for (const id of v) if (!known.has(id)) return refuse('highlight_unknown', id);
      next.highlight = v;
    } else if (k === 'zones') {
      if (v === null) { delete next.zones; continue; }
      if (spec.data.metric !== 'acwr') return refuse('zones_not_applicable', `métrique ${spec.data.metric}`);
      next.zones = v;
    } else if (k === 'y_range') {
      if (v === null) { delete next.y_range; continue; }
      next.y_range = { min: v.min, max: v.max };
    }
  }
  const issues = validateSpec(next, rows);
  if (issues.length) return refuse(issues[0].code, issues[0].detail);
  const res = renderChecked(next, rows, { pack, mode, reference });
  if (!res.ok) return { ok: false, code: 'check_failed', detail: res.failures.map((x) => `${x.check}: ${x.detail}`).join(' | '), failures: res.failures };
  const changed = JSON.stringify(next) !== JSON.stringify(spec);
  return { ok: true, changed, spec: next, option: res.option };
}
