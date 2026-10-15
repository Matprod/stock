// Style sheet ("planche de style"): two A4 pages showing every token, element and chart of the kit,
// with do / don't pairs. For people and for Cursor; not sent to the Designer.
const fs = require('fs'), path = require('path');
const { NB, fr } = require('./lib');
const C = require('./charts');
const D = require('./data');

const sw = (v, hex, role, dark) => `<div class="sw"><i style="background:var(${v})${dark ? '' : ';box-shadow:inset 0 0 0 1px var(--line)'}"></i><div><b>${v}</b><span>${hex} · ${role}</span></div></div>`;
const head = (n, title) => `<header class="runhead"><span class="brand">MAUNA · Planche de style</span><span class="period">Rapport staff, version 1</span></header>`;
const foot = (n) => `<footer class="runfoot"><span>Kit de direction artistique · theme.css</span><span>${n} / 2</span></footer>`;

function page1() {
  return `<div class="page">
  ${head()}
  <section class="stack-1" style="margin-top:20px"><div class="kicker">Planche de style · 1</div><h1 class="headline" style="font-size:30px">Couleurs, typographie et éléments</h1></section>

  <div class="block-title" style="margin-top:16px"><span class="h3" style="font-size:17px">Encre et surfaces</span><span class="unit">texte, filets, fonds</span></div>
  <div class="sw-grid">
    ${sw('--ink', '#0F1B2D', 'titres, valeurs', 1)}${sw('--ink-2', '#43506A', 'texte courant', 1)}${sw('--ink-3', '#667085', 'légendes, unités', 1)}${sw('--ink-4', '#9AA4B2', 'désactivé', 1)}
    ${sw('--line', '#D9DEE6', 'filets, axes')}${sw('--line-soft', '#EEF1F4', 'grille, lignes')}${sw('--surface-2', '#F3F5F8', 'notes, zones')}${sw('--accent', '#9A3412', 'surtitres, jamais une donnée', 1)}
  </div>
  <div class="block-title" style="margin-top:12px"><span class="h3" style="font-size:17px">Couleurs de données</span><span class="unit">le sens d’abord</span></div>
  <div class="sw-grid">
    ${sw('--risk', '#C2410C', 'risque de blessure', 1)}${sw('--perf', '#1F5FB5', 'performance', 1)}${sw('--reference', '#8793A8', 'équipe, poste, autres', 1)}${sw('--series-2', '#1F9E6E', '2e joueur comparé', 1)}
    ${sw('--series-3', '#A21CAF', '3e joueur comparé', 1)}${sw('--status-good', '#15803D', 'complet + forme', 1)}${sw('--status-warn', '#B45309', 'partiel + forme', 1)}${sw('--status-bad', '#B91C1C', 'absent + forme', 1)}
  </div>
  <div style="display:flex;gap:26px;margin-top:10px;align-items:center;font-size:var(--fs-micro);color:var(--ink-3)">
    <span>Risque</span><span class="hm" style="grid-template-columns:repeat(5,30px)"><span class="r0">0</span><span class="r1">10</span><span class="r2">25</span><span class="r3">50</span><span class="r4">75</span></span>
    <span>Performance</span><span class="hm" style="grid-template-columns:repeat(5,30px)"><span class="p0">&lt;35</span><span class="p1">35</span><span class="p2">45</span><span class="p3">55</span><span class="p4">65</span></span>
  </div>

  <div class="block-title" style="margin-top:16px"><span class="h3" style="font-size:17px">Typographie</span><span class="unit">Barlow Condensed pour les titres, Barlow pour le texte</span></div>
  <div class="type">
    <div><span class="tk">Titre de page · 40 px</span><span class="headline" style="font-size:36px">Le constat, avec son chiffre</span></div>
    <div><span class="tk">Section · 26 px</span><span class="h2">Charge par poste</span></div>
    <div><span class="tk">Bloc · 20 px</span><span class="h3">Risque et performance, jour par jour</span></div>
    <div><span class="tk">Surtitre · 14 px</span><span class="kicker">Fiche joueur · Attaquant</span></div>
    <div><span class="tk">Texte · 13–14 px</span><span>Le score passe de 51 à 72 en quatre jours, puis reste sur un plateau.</span></div>
    <div><span class="tk">Légende · 10,5–12 px</span><span class="figcaption" style="margin:0">Scores quotidiens de 0 à 100, ${D.scored.length} joueurs. Valeurs affichées : début, pic, fin.</span></div>
  </div>

  <div class="block-title" style="margin-top:16px"><span class="h3" style="font-size:17px">Éléments</span><span class="unit">classes de theme.css</span></div>
  <div class="grid-2" style="margin-top:10px;row-gap:14px">
    <div class="kpi-strip"><div class="kpi"><div class="label" style="margin:0 0 4px">.kpi</div><div class="value">62,1</div><div class="delta">une ligne de contexte</div></div><div class="kpi"><div class="label" style="margin:0 0 4px">avec unité</div><div class="value">2${NB}872<small>m</small></div><div class="delta">par séance</div></div></div>
    <div class="stack-2">
      <div style="display:flex;gap:10px;flex-wrap:wrap"><span class="chip risk-up"><svg viewBox="0 0 10 10"><path d="M5 9V1M1.5 4.5 5 1l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>.chip.risk-up</span><span class="chip risk-down"><svg viewBox="0 0 10 10"><path d="M5 1v8M1.5 5.5 5 9l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>.chip.risk-down</span></div>
      <div style="display:flex;gap:16px"><span class="status good">.status.good</span><span class="status warn">.status.warn</span><span class="status bad">.status.bad</span></div>
      <div class="callout"><b>.callout</b> : un point à vérifier, une seule fois par page.</div>
    </div>
    <div class="finding stack-1"><div class="title">.finding : un titre qui est une phrase</div><div class="body">Puis une ou deux phrases avec les chiffres qui le prouvent.</div></div>
    <div class="note"><b>.note</b> : contexte, lecture, ce qui n’a pas été produit. Fond gris clair, jamais de couleur.</div>
  </div>
  <table class="table" style="margin-top:14px">
    <thead><tr><th>.table</th><th class="num">Distance (m)</th><th class="num">HMLD (m)</th><th class="num">Écart</th></tr></thead>
    <tbody><tr class="focus"><td>tr.focus : le joueur de la page</td><td class="num">2${NB}940</td><td class="num">393</td><td class="num strong">+19,1${NB}%</td></tr>
    <tr class="ref"><td>tr.ref : la référence</td><td class="num">2${NB}905</td><td class="num">330</td><td class="num">—</td></tr></tbody>
  </table>
  ${foot(1)}
</div>`;
}

function badLabels() {
  const v = [47, 51, 58, 66, 71, 72, 70], w = 300, h = 74, x0 = 22, x1 = w - 30, y0 = 16, y1 = h - 20;
  const X = (i) => x0 + (i * (x1 - x0)) / 6, Y = (x) => y1 - (x / 100) * (y1 - y0);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line class="axis" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/><polyline class="line-risk" points="${v.map((x, i) => `${X(i)},${Y(x)}`).join(' ')}"/>${v.map((x, i) => `<circle class="dot-risk" cx="${X(i)}" cy="${Y(x)}" r="3"/><text class="value" x="${X(i)}" y="${Y(x) - 7}" text-anchor="middle">${x}</text>`).join('')}</svg>`;
}
function badRainbow() {
  const items = [['Milieu offensif', 3210, '#e6194b'], ['Ailier', 3060, '#3cb44b'], ['Attaquant', 2905, '#ffe119'], ['Latéral', 2900, '#4363d8'], ['Déf. central', 2660, '#f58231'], ['Milieu défensif', 2380, '#911eb4']];
  const w = 300, row = 17, x0 = 100, x1 = w - 10;
  return `<svg width="${w}" height="${items.length * row}" viewBox="0 0 ${w} ${items.length * row}">${items.map(([l, v, c], i) => `<text class="label" x="0" y="${i * row + 14}">${l}</text><rect x="${x0}" y="${i * row + 4}" width="${((v / 3300) * (x1 - x0)).toFixed(1)}" height="12" fill="${c}"/>`).join('')}</svg>`;
}
function badDual() {
  const w = 300, h = 110, x0 = 30, x1 = w - 30, y1 = h - 18;
  const cols = [2310, 2480, 2390, 2620, 2150, 2710], line = [0.94, 1.02, 0.98, 1.11, 1.18, 1.52];
  const X = (i) => x0 + ((i + 0.5) * (x1 - x0)) / 6;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line class="axis" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>${cols.map((v, i) => `<rect class="bar" x="${X(i) - 12}" y="${y1 - (v / 3000) * 80}" width="24" height="${(v / 3000) * 80}"/>`).join('')}<polyline fill="none" stroke="var(--perf)" stroke-width="2" points="${line.map((v, i) => `${X(i)},${y1 - ((v - 0.6) / 1) * 80}`).join(' ')}"/><text class="tick" x="${x0 - 4}" y="${y1 - 76}" text-anchor="end">3000</text><text class="tick" x="${x1 + 4}" y="${y1 - 76}" style="fill:var(--perf)">1,6</text><text class="tick" x="${x0 - 4}" y="${y1}" text-anchor="end">0</text><text class="tick" x="${x1 + 4}" y="${y1}" style="fill:var(--perf)">0,6</text></svg>`;
}

function page2() {
  const thumb = (title, use, svg) => `<div class="cat"><div class="ct">${title}</div><div class="cu">${use}</div><div class="cs">${svg}</div></div>`;
  const pos = [['Milieu offensif', 3210], ['Ailier', 3060], ['Attaquant', 2905], ['Latéral', 2900], ['Déf. central', 2660]];
  return `<div class="page">
  ${head()}
  <section class="stack-1" style="margin-top:20px"><div class="kicker">Planche de style · 2</div><h1 class="headline" style="font-size:30px">Graphiques : lequel, et comment</h1></section>
  <div class="cat-grid">
    ${thumb('Mini-courbe', 'Un score sur 7 jours, dans une carte', C.sparkline([47, 51, 58, 66, 71, 72, 70], { w: 210, h: 70 }))}
    ${thumb('Barres triées', 'Comparer des postes ou des joueurs sur une mesure', C.hbars({ items: pos.map(([l, v]) => ({ label: l, value: v })), w: 210, row: 16, labelW: 88, ref: { value: 2872, label: 'équipe' } }))}
    ${thumb('Écart à une référence', 'Au-dessus ou au-dessous de la moyenne du poste', C.deviation({ items: [{ label: 'Lindqvist', value: 23 }, { label: 'Ferreira', value: 19 }, { label: 'Okafor', value: -4 }, { label: 'Berger', value: -12 }], w: 210, row: 18, labelW: 64, span: 30 }))}
    ${thumb('Nuage de points', 'Deux mesures par joueur, des seuils qui découpent', C.scatter({ points: D.scored.map((p) => ({ label: p.short.split(' ')[1], x: D.acwrNow[p.short], y: p.rm, focus: p.short === 'T. Lindqvist', side: 'l' })), w: 210, h: 120, xDom: [0.8, 1.6], yDom: [0, 80], xTicks: [0.8, 1.2, 1.6], yTicks: [0, 40, 80], xRef: { v: 1.3, label: '' }, yRef: { v: 20, label: '' }, xTitle: 'ACWR', yTitle: 'Risque' }))}
    ${thumb('ACWR et zone', 'Rapport aigu / chronique dans le temps', C.acwrChart({ labels: D.weeks, w: 210, h: 120, series: [{ name: 'Lindqvist', values: D.acwr['T. Lindqvist'], color: 'var(--series-1)' }, { name: 'Équipe', values: D.acwr['Équipe (médiane)'], ref: true }] }))}
    ${thumb('Petits multiples', 'Plus de trois joueurs sur la même mesure', C.smallMultiples({ panels: Object.entries(D.wellness.fatigue).slice(0, 2).map(([k, v]) => ({ title: k, values: v })), ref: D.wellness.teamMedianFatigue, yMin: 1, yMax: 10, ticks: [1, 10], cols: 2, w: 210, ph: 84, xFrom: '', xTo: '' }))}
    ${thumb('Colonnes empilées', 'Parties d’un tout par jour (disponibilité)', C.stacked({ labels: ['2', '3', '4', '5', '6', '7', '8'], parts: D.availability, colors: ['var(--avail-ok)', 'var(--avail-mod)', 'var(--avail-out)'], w: 210, h: 110, total: 24 }))}
    ${thumb('Frise', 'Absences et retours prévus', C.timeline({ rows: D.injuries.slice(0, 2), from: 8, to: 13, now: 10, w: 210, row: 30, labelW: 64 }).replace(/Reprise individuelle|Réathlétisation/g, ''))}
    ${thumb('Distribution', 'Où se situe un joueur dans l’effectif', C.dotStrip({ rows: [{ title: 'Fatigue', values: D.wellness.meanFatigue, focus: ['T. Lindqvist'] }], dom: [1, 10], ticks: [1, 5, 10], w: 210, row: 60, labelW: 44 }))}
  </div>
  <p class="figcaption" style="margin-top:4px">Matrice joueurs × jours : classes .r0 à .r4 et .p0 à .p4 (page 1). Courbes risque et performance : page de référence 09. Tous ces graphiques sont produits par chart_svg.</p>

  <div class="block-title" style="margin-top:14px"><span class="h3" style="font-size:17px">À ne pas faire, et quoi faire à la place</span><span class="unit"></span></div>
  <div class="dd">
    <div class="no"><b>Non : une valeur sur chaque point</b>${badLabels()}</div>
    <div class="yes"><b>Oui : début, pic et fin seulement</b>${C.sparkline([47, 51, 58, 66, 71, 72, 70], { w: 300, h: 74 })}</div>
    <div class="no"><b>Non : une couleur par barre</b>${badRainbow()}</div>
    <div class="yes"><b>Oui : triées, le premier en foncé</b>${C.hbars({ items: pos.map(([l, v]) => ({ label: l, value: v })), w: 300, row: 17, labelW: 100 })}</div>
    <div class="no"><b>Non : deux axes sur un graphique</b><div class="muted" style="font-size:var(--fs-small)">Charge à gauche, ACWR à droite : deux échelles, une lecture fausse.</div></div>
    <div class="yes"><b>Oui : deux graphiques côte à côte</b><div class="muted" style="font-size:var(--fs-small)">Chacun avec son axe, comme la page de référence 04.</div></div>
  </div>
  ${foot(2)}
</div>`;
}

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Planche de style</title>
<link rel="stylesheet" href="theme.css">
<style>
  .sw-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 14px; margin-top: 8px; }
  .sw { display: flex; gap: 8px; align-items: center; }
  .sw i { width: 24px; height: 24px; border-radius: 3px; flex: none; }
  .sw b { display: block; font-size: 11.5px; color: var(--ink); font-weight: 600; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'calt' 0; }
  .sw span { font-size: var(--fs-micro); color: var(--ink-3); }
  .type > div { display: grid; grid-template-columns: 150px 1fr; align-items: baseline; padding: 2px 0; border-bottom: 1px solid var(--line-soft); }
  .type .tk { font-size: var(--fs-micro); color: var(--ink-3); }
  .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 22px; margin-top: 10px; }
  .cat .ct { font-weight: 600; color: var(--ink); font-size: 13px; }
  .cat .cu { font-size: var(--fs-micro); color: var(--ink-3); min-height: 26px; line-height: 1.3; }
  .cat .cs { border-top: 1px solid var(--line-soft); padding-top: 6px; height: 108px; overflow: hidden; }
  .dd { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 28px; margin-top: 8px; }
  .dd > div { padding-left: 10px; border-left: 3px solid var(--line); }
  .dd b { display: block; font-size: 12px; margin-bottom: 4px; }
  .dd .no { border-left-color: var(--status-bad); } .dd .no b { color: var(--status-bad); }
  .dd .yes { border-left-color: var(--status-good); } .dd .yes b { color: var(--status-good); }
</style>
</head>
<body>
${page1()}
${page2()}
</body>
</html>
`;
fs.writeFileSync(path.join(process.argv[2], 'planche.html'), html);
console.log('planche', html.length);
