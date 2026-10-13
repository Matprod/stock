// Rend les cinq exemples dans trois packs/modes en SVG (rendu côté serveur ECharts) et écrit demo.html.
import fs from 'node:fs';
import * as echarts from 'echarts';
import { echartsTheme } from '../design-packs-kit/pack-lib.mjs';
import { packCss } from '../design-packs-kit/pack-lib.mjs';
import { renderChecked } from './chart-lib.mjs';
import { NAMES, loadExample, loadPacks } from './examples/load.mjs';

const packs = loadPacks();
const combos = [['staff', 'light'], ['performance', 'light'], ['controlroom', 'dark']];
let html = `<!doctype html><meta charset="utf-8"><title>Démo graphiques</title><style>body{font:13px sans-serif;margin:16px;background:#888}section{padding:12px;margin:0 0 16px;border-radius:8px}h2{margin:0 0 8px;font-size:14px}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.c{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px;color:var(--ink)}.c b{display:block;font-size:11px;color:var(--muted);margin:2px 6px}.bad{color:#b00;font-size:11px}`;
for (const [id, mode] of combos) html += packCss(id, packs[id]);
html += '</style>';
let allOk = true;
for (const [id, mode] of combos) {
  const pack = packs[id];
  echarts.registerTheme(`${id}-${mode}`, echartsTheme(pack, mode));
  html += `<section data-pack="${id}"><h2>${id} · ${mode}</h2><div class="g">`;
  for (const n of NAMES) {
    const { spec, rows, reference } = loadExample(n);
    const res = renderChecked(spec, rows, { pack, mode, reference });
    if (!res.ok) { allOk = false; html += `<div class="c"><b>${n}</b><div class="bad">${JSON.stringify(res.issues)}${JSON.stringify(res.failures)}</div></div>`; continue; }
    const c = echarts.init(null, `${id}-${mode}`, { renderer: 'svg', ssr: true, width: 520, height: 280 });
    c.setOption(res.option);
    html += `<div class="c"><b>${spec.title}</b>${c.renderToSVGString()}</div>`;
    c.dispose();
  }
  html += '</div></section>';
}
fs.writeFileSync('demo.html', html);
console.log(allOk ? 'demo.html écrit, tous les contrôles passent' : 'demo.html écrit AVEC des échecs');
