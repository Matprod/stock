import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { tokenMap, resolveTokens, renderChecked, renderChart, checkOption, checkAdditive, applyChartOp, validateSpec, chooseForm, intents } from './chart-lib.mjs';
import { NAMES, loadExample, loadPacks } from './examples/load.mjs';

const packs = loadPacks();
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
const COMBOS = [...Object.keys(packs).map((id) => [id, 'light']), ['controlroom', 'dark']];

test('les cinq exemples respectent le schéma ChartSpec', () => {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(read('./chart-spec.schema.json'));
  for (const n of NAMES) assert.ok(validate(loadExample(n).spec), `${n}: ${JSON.stringify(validate.errors)}`);
});

test('le schéma soft-ops accepte chart_op et set_pack, et refuse couleur, forme inconnue, réglage vide', () => {
  const ajv = new Ajv({ strict: false });
  const v = ajv.compile(read('./soft-ops.schema.json'));
  assert.ok(v(read('./examples/chart-op.example.json')), JSON.stringify(v.errors));
  for (const set of [{}, { color: '#ff0000' }, { form: 'pie' }]) assert.equal(v({ version: 1, baseRev: 'x', ops: [{ op: 'chart_op', block: 's2.fig1', set }] }), false);
});

test('chaque intention a une forme par défaut permise', () => {
  for (const [k, it] of Object.entries(intents())) { assert.ok(it.forms.includes(it.default), k); assert.equal(chooseForm(k), it.default); }
});

test('resolveTokens : tout se résout dans chaque pack et mode ; un jeton inconnu lève une erreur', () => {
  for (const [id, mode] of COMBOS) {
    const m = tokenMap(packs[id], mode);
    assert.equal(resolveTokens('$series-8', m), m['$series-8']);
    assert.equal(resolveTokens('texte $100', m), 'texte $100');
  }
  assert.throws(() => resolveTokens({ a: ['$neon'] }, tokenMap(packs.staff, 'light')), /jeton inconnu/);
});

test('tous les exemples se rendent sans échec dans les 5 packs (controlroom aussi en sombre)', () => {
  for (const [id, mode] of COMBOS) for (const n of NAMES) {
    const { spec, rows, reference } = loadExample(n);
    const r = renderChecked(spec, rows, { pack: packs[id], mode, reference });
    assert.ok(r.ok, `${id}/${mode}/${n}: ${JSON.stringify(r.issues)} ${JSON.stringify(r.failures)}`);
  }
});

test('le rendu ne contient aucune couleur hors pack ni jeton non résolu', () => {
  for (const [id, mode] of COMBOS) for (const n of NAMES) {
    const { spec, rows, reference } = loadExample(n);
    const s = JSON.stringify(renderChart(spec, rows, { pack: packs[id], mode, reference }));
    assert.equal(/"\$[a-z]/.test(s), false);
  }
});

test('contrôle : une couleur codée en dur est refusée', () => {
  const { spec, rows } = loadExample('trend');
  const o = renderChart(spec, rows, { pack: packs.staff });
  o.series[0].itemStyle.color = '#123456';
  assert.ok(checkOption(o, spec, { pack: packs.staff }).some((f) => f.check === 'color_outside_pack'));
});

test('contrôle : un jeton non résolu est refusé', () => {
  const { spec, rows } = loadExample('trend');
  const o = renderChart(spec, rows, { pack: packs.staff });
  o.series[0].itemStyle.color = '$series-1';
  assert.ok(checkOption(o, spec, { pack: packs.staff }).some((f) => f.check === 'unresolved_token'));
});

test('contrôle : une courbe sans le tiret ou le marqueur de son rang est refusée', () => {
  const { spec, rows } = loadExample('trend');
  const o = renderChart(spec, rows, { pack: packs.staff });
  o.series[1].lineStyle.type = 'solid'; o.series[1].symbol = 'circle';
  assert.ok(checkOption(o, spec, { pack: packs.staff }).some((f) => f.check === 'series_encoding'));
});

test('contrôle : deux axes de valeurs sont refusés', () => {
  const { spec, rows } = loadExample('trend');
  const o = renderChart(spec, rows, { pack: packs.staff });
  o.yAxis = [o.yAxis, { type: 'value' }];
  assert.ok(checkOption(o, spec, { pack: packs.staff }).some((f) => f.check === 'dual_axis'));
});

test('contrôle : une barre qui ne part pas de zéro est refusée', () => {
  const { spec, rows } = loadExample('ranking');
  const o = renderChart(spec, rows, { pack: packs.staff });
  o.xAxis.min = 100;
  assert.ok(checkOption(o, spec, { pack: packs.staff }).some((f) => f.check === 'bar_baseline'));
});

test('contrôle : couleur sous 3:1 sans étiquettes ni tableau est refusée (relief obligatoire)', () => {
  const { spec, rows } = loadExample('ranking');
  const s = clone(spec); s.labels = 'legend';
  // le rang 1 de `performance` est orange, sous 3:1 sur fond clair
  const r = renderChecked(s, rows, { pack: packs.performance });
  assert.ok(r.failures.some((f) => f.check === 'relief_missing'));
  const t = clone(spec); t.labels = 'table';
  assert.ok(renderChecked(t, rows, { pack: packs.performance }).ok);
});

test('contrôle : zone ACWR avec la série rouge (rang 8) est refusée', () => {
  const { spec, rows } = loadExample('trend');
  const s = clone(spec); s.entities[2].slot = 8;
  const r = renderChecked(s, rows, { pack: packs.staff });
  assert.ok(r.failures.some((f) => f.check === 'status_vs_series'));
});

test('cascade : refusée si les données ne sont pas additives, et la somme est vérifiée', () => {
  const { spec, rows } = loadExample('contribution');
  const s = clone(spec); s.data.additive = false;
  assert.ok(validateSpec(s, rows).some((i) => i.code === 'form_needs_additive'));
  const bad = clone(rows); bad[bad.length - 1].value = 99;
  assert.ok(checkAdditive(bad, spec).length === 1);
  assert.ok(renderChecked(spec, bad, { pack: packs.staff }).failures.some((f) => f.check === 'waterfall_sum'));
  assert.equal(checkAdditive(rows, spec).length, 0);
});

test('la couleur suit l\'entité : masquer un joueur ne repeint pas les autres', () => {
  const { spec, rows } = loadExample('trend');
  const full = renderChart(spec, rows, { pack: packs.staff });
  const op = applyChartOp(spec, { entities: ['p123', 'p318'] }, { rows, pack: packs.staff });
  assert.ok(op.ok, op.detail);
  const a = full.series.find((s) => s.name === 'Joueur 318'), b = op.option.series.find((s) => s.name === 'Joueur 318');
  assert.equal(b.color, a.color);
  assert.equal(b.lineStyle.type, a.lineStyle.type);
  assert.equal(b.symbol, a.symbol);
  assert.equal(op.option.series.length, 2);
});

test('chart_op : refus typés', () => {
  const t = loadExample('trend'), ctx = { rows: t.rows, pack: packs.staff };
  const code = (spec, set, c = ctx) => applyChartOp(spec, set, c).code;
  assert.equal(code(t.spec, {}), 'empty_set');
  assert.equal(code(t.spec, { color: '#f00' }), 'param_unknown');
  assert.equal(code(t.spec, { form: 'hist' }), 'form_not_permitted');
  assert.equal(code(t.spec, { sort: 'random' }), 'value_not_allowed');
  assert.equal(code(t.spec, { entities: [] }), 'entity_empty');
  assert.equal(code(t.spec, { entities: ['p999'] }), 'entity_unknown');
  assert.equal(code(t.spec, { window: { from: '2026-01-01', to: '2026-10-05' } }), 'window_outside_data');
  assert.equal(code(t.spec, { window: { from: '2026-10-05', to: '2026-09-07' } }), 'window_empty');
  assert.equal(code(t.spec, { highlight: ['p999'] }), 'highlight_unknown');
  assert.equal(code(t.spec, { y_range: { min: 2, max: 1 } }), 'y_range_invalid');
  const r = loadExample('ranking');
  assert.equal(code(r.spec, { zones: 'acwr' }, { rows: r.rows, pack: packs.staff }), 'zones_not_applicable');
  assert.equal(code(r.spec, { y_range: { min: 50, max: 500 } }, { rows: r.rows, pack: packs.staff }), 'y_range_truncates_bars');
  const c = loadExample('contribution'), cs = clone(c.spec); cs.data.additive = false; cs.intent = 'contribution'; cs.form = 'barh';
  assert.equal(code(cs, { form: 'waterfall' }, { rows: c.rows, pack: packs.staff }), 'form_needs_additive');
});

test('chart_op : fenêtre valide, idempotence et spécification d\'origine intacte', () => {
  const { spec, rows } = loadExample('trend'), before = JSON.stringify(spec), ctx = { rows, pack: packs.staff };
  const set = { window: { from: '2026-09-07', to: '2026-10-05' }, highlight: ['p318'] };
  const a = applyChartOp(spec, set, ctx);
  assert.ok(a.ok && a.changed, a.detail);
  assert.equal(JSON.stringify(spec), before);
  const b = applyChartOp(a.spec, set, ctx);
  assert.ok(b.ok && b.changed === false);
  assert.deepEqual(a.option.xAxis.data, ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
});

test('chart_op : si un contrôle échoue, rien n\'est promis (check_failed)', () => {
  const { spec, rows } = loadExample('ranking');
  const r = applyChartOp(spec, { labels: 'legend' }, { rows, pack: packs.performance });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'check_failed');
  assert.equal(spec.labels, 'direct');
});

test('chart_op : changer de forme dans les formes permises', () => {
  const { spec, rows } = loadExample('ranking');
  const r = applyChartOp(spec, { form: 'bar', sort: 'asc' }, { rows, pack: packs.staff });
  assert.ok(r.ok, r.detail);
  assert.equal(r.option.series[0].type, 'bar');
  assert.deepEqual(r.option.xAxis.data.slice(0, 2), ['Joueur F', 'Joueur E']);
});

test('chart_op : le même réglage donne le même rendu dans chaque pack', () => {
  const { spec, rows } = loadExample('trend');
  for (const [id, mode] of COMBOS) {
    const r = applyChartOp(spec, { entities: ['p123', 'p245'], zones: 'acwr' }, { rows, pack: packs[id], mode });
    assert.ok(r.ok, `${id}/${mode}: ${r.detail}`);
  }
});
