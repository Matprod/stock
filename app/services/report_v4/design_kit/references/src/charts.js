// Chart functions used by the reference pages. They are the visual spec for chart_svg:
// same sizes, same classes, same labelling rules. Every function returns an SVG (or HTML) string.
// Rules shared by all charts:
// - colors come from theme.css classes or variables only;
// - values are shown only where they matter (start, peak, low, last, or the bar end);
// - no label may sit on a line, a marker or another label;
// - one y axis; gridlines light and horizontal.
const { fr, int, mean, t, PCT, dayShort } = require('./lib');

const f1 = (x) => x.toFixed(1);
const svgOpen = (w, h, label) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">`;

// ---------- Sparkline: one score series, 0-100, inside a card ----------
function sparkline(values, { w = 300, h = 84, from = dayShort(2), to = dayShort(8), ref = 50 } = {}) {
  const x0 = 22, x1 = w - 30, y0 = 16, y1 = h - 20;
  const X = (i) => x0 + (i * (x1 - x0)) / (values.length - 1);
  const Y = (v) => y1 - (v / 100) * (y1 - y0);
  const pts = values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ');
  const iMax = values.indexOf(Math.max(...values));
  const iMin = values.lastIndexOf(Math.min(...values));
  const keep = [...new Set([0, iMax, iMin, values.length - 1])];
  const labels = keep.map((i) => {
    const last = i === values.length - 1;
    const above = i === iMax || (i !== iMin && values[i] >= values[Math.max(0, i - 1)]);
    const y = last ? Y(values[i]) + 4 : above ? Y(values[i]) - 8 : Y(values[i]) + 15;
    const anchor = last || i === 0 ? 'start' : 'middle';
    const dx = last ? 8 : i === 0 ? -4 : 0;
    return `<text class="value" x="${f1(X(i) + dx)}" y="${f1(y)}" text-anchor="${anchor}">${values[i]}</text>`;
  }).join('');
  return `${svgOpen(w, h, t('Risque quotidien', 'Daily risk'))}
    <line class="line-ref" x1="${x0}" x2="${x1}" y1="${Y(ref)}" y2="${Y(ref)}"/>
    <text class="tick" x="0" y="${Y(ref) + 3.5}">${ref}</text>
    <line class="axis" x1="${x0}" x2="${x1}" y1="${y1 + 0.5}" y2="${y1 + 0.5}"/>
    <polyline class="line-risk" points="${pts}"/>
    ${values.map((v, i) => `<circle class="dot-risk" cx="${f1(X(i))}" cy="${f1(Y(v))}" r="${keep.includes(i) ? 3.5 : 2.5}"/>`).join('')}
    ${labels}
    <text class="tick" x="${x0}" y="${h - 3}">${from}</text>
    <text class="tick" x="${x1}" y="${h - 3}" text-anchor="end">${to}</text>
  </svg>`;
}

// ---------- Line chart: risk and/or performance over days, 0-100 ----------
// series: [{ kind: 'risk'|'perf', name, values, labelAt: [i], below: [i] }]
function lineChart({ series, xLabels, w = 698, h = 210, annotation, sessionDays = [] }) {
  const x0 = 34, x1 = w - 128, y0 = 30, y1 = h - 44;
  const X = (i) => x0 + (i * (x1 - x0)) / (xLabels.length - 1);
  const Y = (v) => y1 - (v / 100) * (y1 - y0);
  let s = svgOpen(w, h, t('Score par jour', 'Score by day'));
  for (const t of [0, 25, 50, 75, 100]) {
    s += `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${Y(t)}" y2="${Y(t)}"/>`;
    s += `<text class="tick" x="${x0 - 8}" y="${Y(t) + 3.5}" text-anchor="end">${t}</text>`;
  }
  xLabels.forEach((d, i) => {
    s += `<text class="tick" x="${X(i)}" y="${y1 + 16}" text-anchor="middle">${d}</text>`;
    if (sessionDays.includes(i)) s += `<path d="M${X(i)} ${y1 + 23}l3.5 3.5-3.5 3.5-3.5-3.5z" fill="var(--ink-2)"/>`;
  });
  if (annotation) {
    const ya = y0 - 14, a = X(annotation.from), b = X(annotation.to);
    s += `<path d="M${a} ${ya + 6}V${ya}H${b}V${ya + 6}" fill="none" stroke="var(--ink-3)" stroke-width="1"/>`;
    s += `<text class="annot" x="${(a + b) / 2}" y="${ya - 4}" text-anchor="middle" style="font-weight:600;fill:var(--ink)">${annotation.text}</text>`;
  }
  for (const se of series) {
    s += `<polyline class="line-${se.kind}" points="${se.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`;
    se.values.forEach((v, i) => {
      s += se.kind === 'risk'
        ? `<circle class="dot-risk" cx="${f1(X(i))}" cy="${f1(Y(v))}" r="3.5"/>`
        : `<rect class="dot-perf" x="${f1(X(i) - 3.5)}" y="${f1(Y(v) - 3.5)}" width="7" height="7"/>`;
    });
    for (const i of se.labelAt || []) {
      const dy = (se.below || []).includes(i) ? 16 : -9;
      s += `<text class="value" x="${f1(X(i))}" y="${f1(Y(se.values[i]) + dy)}" text-anchor="middle">${se.values[i]}</text>`;
    }
    const last = se.values[se.values.length - 1];
    s += `<text class="value" x="${x1 + 12}" y="${f1(Y(last) + 4)}" style="fill:var(--${se.kind})">${se.name} ${last}</text>`;
  }
  return s + '</svg>';
}

// ---------- Horizontal bars, sorted descending ----------
// items: [{ label, value, display?, focus? }]; the leader (or focus items) in ink, others in gray.
// ref: optional { value, label } drawn as a dashed vertical line (team or position mean).
function hbars({ items, w = 330, row = 24, labelW = 118, max, ref, fmt = int, highlight = 'lead' }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const top = ref ? 18 : 4;
  const h = top + sorted.length * row + 4;
  const x0 = labelW, x1 = w - 46;
  const M = max || Math.max(...sorted.map((d) => d.value), ref ? ref.value : 0);
  const X = (v) => x0 + (v / M) * (x1 - x0);
  let s = svgOpen(w, h, t('Classement', 'Ranking'));
  if (ref) {
    const xr = X(ref.value);
    s += `<line class="line-ref" x1="${f1(xr)}" x2="${f1(xr)}" y1="${top - 4}" y2="${h - 2}"/>`;
    s += `<text class="tick" x="${f1(xr)}" y="${top - 7}" text-anchor="middle">${ref.label}</text>`;
  }
  sorted.forEach((d, i) => {
    const y = top + i * row;
    const strong = highlight === 'lead' ? i === 0 : !!d.focus;
    s += `<text class="label" x="0" y="${y + row / 2 + 4}" style="${strong ? 'fill:var(--ink);font-weight:600' : ''}">${d.label}</text>`;
    s += `<rect class="${strong ? 'bar-lead' : 'bar'}" x="${x0}" y="${y + 5}" width="${f1(Math.max(1, X(d.value) - x0))}" height="${row - 10}" rx="1"/>`;
    s += `<text class="value" x="${f1(X(d.value) + 6)}" y="${y + row / 2 + 4}">${d.display || fmt(d.value)}</text>`;
  });
  return s + '</svg>';
}

// ---------- Deviation bars: signed gap to a reference, centred on 0 ----------
// items: [{ label, value }] in percent. Above the reference in ink, below in gray. Labels carry the sign.
function deviation({ items, w = 330, row = 24, labelW = 118, span }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const h = sorted.length * row + 22;
  const S = span || Math.ceil(Math.max(...sorted.map((d) => Math.abs(d.value))) / 10) * 10;
  const x0 = labelW + 30, x1 = w - 30, xm = (x0 + x1) / 2;
  const X = (v) => xm + (v / S) * ((x1 - x0) / 2);
  let s = svgOpen(w, h, t('Écart à la référence', 'Gap to reference'));
  sorted.forEach((d, i) => {
    const y = i * row;
    const pos = d.value >= 0;
    s += `<text class="label" x="0" y="${y + row / 2 + 4}">${d.label}</text>`;
    s += `<rect class="${pos ? 'bar-lead' : 'bar'}" x="${f1(Math.min(xm, X(d.value)))}" y="${y + 6}" width="${f1(Math.abs(X(d.value) - xm))}" height="${row - 12}"/>`;
    const lbl = (d.value > 0 ? '+' : d.value < 0 ? '−' : '') + fr(Math.abs(d.value), 0) + PCT;
    s += `<text class="value" x="${f1(pos ? X(d.value) + 5 : X(d.value) - 5)}" y="${y + row / 2 + 4}" text-anchor="${pos ? 'start' : 'end'}">${lbl}</text>`;
  });
  s += `<line class="axis" x1="${xm}" x2="${xm}" y1="0" y2="${sorted.length * row}"/>`;
  s += `<text class="tick" x="${xm}" y="${h - 4}" text-anchor="middle">${t('moyenne du poste', 'position mean')}</text>`;
  return s + '</svg>';
}

// ---------- Small multiples: one mini line per panel, shared scale, reference dashed ----------
// panels: [{ title, values }], ref: values of the reference line (same for every panel)
function smallMultiples({ panels, ref, yMin, yMax, cols = 3, w = 698, ph = 104, xFrom, xTo, ticks }) {
  const gap = 22, pw = (w - gap * (cols - 1)) / cols;
  const rows = Math.ceil(panels.length / cols);
  const h = rows * (ph + 16);
  let s = svgOpen(w, h, t('Petits multiples', 'Small multiples'));
  panels.forEach((p, k) => {
    const ox = (k % cols) * (pw + gap), oy = Math.floor(k / cols) * (ph + 16);
    const x0 = ox + 18, x1 = ox + pw - 24, y0 = oy + 26, y1 = oy + ph - 14;
    const X = (i) => x0 + (i * (x1 - x0)) / (p.values.length - 1);
    const Y = (v) => y1 - ((v - yMin) / (yMax - yMin)) * (y1 - y0);
    s += `<text class="label" x="${ox}" y="${oy + 12}" style="fill:var(--ink);font-weight:600">${p.title}</text>`;
    for (const t of ticks) {
      s += `<line class="${t === yMin ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(t))}" y2="${f1(Y(t))}"/>`;
      if (k % cols === 0) s += `<text class="tick" x="${x0 - 5}" y="${f1(Y(t) + 3.5)}" text-anchor="end">${t}</text>`;
    }
    s += `<polyline class="line-ref" points="${ref.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`;
    s += `<polyline fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" points="${p.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`;
    const li = p.values.length - 1, lv = p.values[li];
    s += `<circle cx="${f1(X(li))}" cy="${f1(Y(lv))}" r="3" fill="var(--ink)"/>`;
    s += `<text class="value" x="${f1(X(li) + 6)}" y="${f1(Y(lv) + 4)}">${lv}</text>`;
    const iMax = p.values.indexOf(Math.max(...p.values));
    if (iMax !== li) s += `<text class="value" x="${f1(X(iMax))}" y="${f1(Y(p.values[iMax]) - 6)}" text-anchor="middle">${p.values[iMax]}</text>`;
    s += `<text class="tick" x="${x0}" y="${oy + ph}" >${xFrom}</text><text class="tick" x="${x1}" y="${oy + ph}" text-anchor="end">${xTo}</text>`;
  });
  return s + '</svg>';
}

// ---------- Scatter: one point per athlete, two reference lines split the plane ----------
// points: [{ label, x, y, focus?, side?: 'r'|'l'|'t'|'b' }]; only focus points are labelled.
function scatter({ points, w = 698, h = 290, xDom, yDom, xTicks, yTicks, xRef, yRef, xTitle, yTitle, zones = [] }) {
  const x0 = 46, x1 = w - 16, y0 = 30, y1 = h - 42;
  const X = (v) => x0 + ((v - xDom[0]) / (xDom[1] - xDom[0])) * (x1 - x0);
  const Y = (v) => y1 - ((v - yDom[0]) / (yDom[1] - yDom[0])) * (y1 - y0);
  let s = svgOpen(w, h, t('Nuage de points', 'Scatter'));
  for (const t of yTicks) {
    s += `<line class="${t === yDom[0] ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(t))}" y2="${f1(Y(t))}"/>`;
    s += `<text class="tick" x="${x0 - 8}" y="${f1(Y(t) + 3.5)}" text-anchor="end">${t}</text>`;
  }
  for (const t of xTicks) s += `<text class="tick" x="${f1(X(t))}" y="${y1 + 16}" text-anchor="middle">${fr(t, 1)}</text>`;
  if (xRef) s += `<line class="line-ref" x1="${f1(X(xRef.v))}" x2="${f1(X(xRef.v))}" y1="${y0}" y2="${y1}"/><text class="tick" x="${f1(X(xRef.v) + 5)}" y="${y0 + 9}">${xRef.label}</text>`;
  if (yRef) s += `<line class="line-ref" x1="${x0}" x2="${x1}" y1="${f1(Y(yRef.v))}" y2="${f1(Y(yRef.v))}"/><text class="tick" x="${x0 + 4}" y="${f1(Y(yRef.v) - 5)}">${yRef.label}</text>`;
  for (const z of zones) s += `<text class="annot" x="${f1(X(z.x))}" y="${f1(Y(z.y))}" text-anchor="${z.anchor || 'start'}" style="font-weight:600;fill:var(--ink-3)">${z.text}</text>`;
  for (const p of points.filter((q) => !q.focus)) s += `<circle cx="${f1(X(p.x))}" cy="${f1(Y(p.y))}" r="4" fill="var(--reference)" stroke="var(--surface)" stroke-width="1.5"/>`;
  for (const p of points.filter((q) => q.focus)) {
    const cx = X(p.x), cy = Y(p.y);
    s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="5" fill="var(--risk)" stroke="var(--surface)" stroke-width="2"/>`;
    const side = p.side || 'r';
    const pos = { r: [cx + 9, cy + 4, 'start'], l: [cx - 9, cy + 4, 'end'], t: [cx, cy - 10, 'middle'], b: [cx, cy + 17, 'middle'] }[side];
    s += `<text class="value" x="${f1(pos[0])}" y="${f1(pos[1])}" text-anchor="${pos[2]}">${p.label}</text>`;
  }
  s += `<text class="tick" x="${x1}" y="${h - 4}" text-anchor="end">${xTitle}</text>`;
  s += `<text class="tick" x="0" y="10">${yTitle}</text>`;
  return s + '</svg>';
}

// ---------- ACWR lines with the 0.8-1.3 band ----------
// series: [{ name, values, color }]; the team median dashed gray.
function acwrChart({ series, labels, w = 330, h = 220, band = [0.8, 1.3], dom = [0.6, 1.7] }) {
  const x0 = 30, x1 = w - 96, y0 = 12, y1 = h - 26;
  const X = (i) => x0 + (i * (x1 - x0)) / (labels.length - 1);
  const Y = (v) => y1 - ((v - dom[0]) / (dom[1] - dom[0])) * (y1 - y0);
  let s = svgOpen(w, h, t('ACWR par semaine', 'ACWR by week'));
  s += `<rect class="band" x="${x0}" y="${f1(Y(band[1]))}" width="${x1 - x0}" height="${f1(Y(band[0]) - Y(band[1]))}"/>`;
  for (const t of [0.6, 0.8, 1.0, 1.3, 1.6]) s += `<text class="tick" x="${x0 - 6}" y="${f1(Y(t) + 3.5)}" text-anchor="end">${fr(t, 1)}</text>`;
  s += `<line class="axis" x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}"/>`;
  labels.forEach((l, i) => { s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${l}</text>`; });
  const ends = [];
  for (const se of series) {
    const dashed = se.ref;
    s += `<polyline ${dashed ? 'class="line-ref"' : `fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round"`} points="${se.values.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`;
    const li = se.values.length - 1;
    if (!dashed) s += `<circle cx="${f1(X(li))}" cy="${f1(Y(se.values[li]))}" r="3.5" fill="${se.color}" stroke="var(--surface)" stroke-width="1.5"/>`;
    ends.push({ y: Y(se.values[li]), text: `${se.name} ${fr(se.values[li], 2)}`, color: dashed ? 'var(--ink-3)' : se.color });
  }
  // end labels, pushed apart vertically when closer than 13 px
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  for (const e of ends) s += `<text class="value" x="${x1 + 8}" y="${f1(e.y + 4)}" style="fill:${e.color}">${e.text}</text>`;
  return s + '</svg>';
}

// ---------- Columns with a line (weekly load and chronic load, same unit) ----------
function columnsLine({ labels, cols, line, w = 330, h = 220, max, lineName, colName }) {
  const x0 = 40, x1 = w - 10, y0 = 18, y1 = h - 26;
  const M = max || Math.max(...cols, ...line) * 1.1;
  const bw = ((x1 - x0) / labels.length) * 0.56;
  const X = (i) => x0 + ((i + 0.5) * (x1 - x0)) / labels.length;
  const Y = (v) => y1 - (v / M) * (y1 - y0);
  let s = svgOpen(w, h, t('Charge hebdomadaire', 'Weekly load'));
  for (const t of [0, 1000, 2000, 3000].filter((t) => t <= M)) {
    s += `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${x0}" x2="${x1}" y1="${f1(Y(t))}" y2="${f1(Y(t))}"/>`;
    s += `<text class="tick" x="${x0 - 6}" y="${f1(Y(t) + 3.5)}" text-anchor="end">${int(t)}</text>`;
  }
  cols.forEach((v, i) => {
    const last = i === cols.length - 1;
    s += `<rect class="${last ? 'bar-lead' : 'bar'}" x="${f1(X(i) - bw / 2)}" y="${f1(Y(v))}" width="${f1(bw)}" height="${f1(y1 - Y(v))}" rx="1"/>`;
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${labels[i]}</text>`;
    if (last || v === Math.max(...cols.slice(0, -1))) s += `<text class="value" x="${f1(X(i))}" y="${f1(Y(v) - 6)}" text-anchor="middle">${int(v)}</text>`;
  });
  s += `<polyline fill="none" stroke="var(--ink-2)" stroke-width="2" points="${line.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(' ')}"/>`;
  return s + '</svg>';
}

// ---------- Stacked columns (parts of a whole per day) ----------
// parts: [[a, b, c], ...] per column; classes in order; counts written inside when the segment is tall enough.
function stacked({ labels, parts, colors, w = 330, h = 220, total }) {
  const x0 = 6, x1 = w - 6, y0 = 8, y1 = h - 26;
  const T = total || Math.max(...parts.map((p) => p.reduce((s, x) => s + x, 0)));
  const bw = ((x1 - x0) / labels.length) * 0.66;
  const X = (i) => x0 + ((i + 0.5) * (x1 - x0)) / labels.length;
  const Hh = (v) => (v / T) * (y1 - y0);
  let s = svgOpen(w, h, t('Disponibilité par jour', 'Availability by day'));
  parts.forEach((p, i) => {
    let y = y1;
    p.forEach((v, k) => {
      if (!v) return;
      const hh = Hh(v);
      y -= hh;
      s += `<rect x="${f1(X(i) - bw / 2)}" y="${f1(y + 1)}" width="${f1(bw)}" height="${f1(hh - 2)}" fill="${colors[k]}"/>`;
      if (hh >= 14) s += `<text class="value" x="${f1(X(i))}" y="${f1(y + hh / 2 + 4)}" text-anchor="middle" style="fill:${k === 0 ? 'var(--ink)' : '#FFFFFF'}">${v}</text>`;
    });
    s += `<text class="tick" x="${f1(X(i))}" y="${y1 + 15}" text-anchor="middle">${labels[i]}</text>`;
  });
  return s + '</svg>';
}

// ---------- Timeline of absences (one row per athlete) ----------
// rows: [{ who, what, start, end, ongoing, phase }] in week numbers (decimals = days); now = current week
function timeline({ rows, from, to, now, w = 698, row = 34, labelW = 150 }) {
  const top = 20, h = top + rows.length * row + 6;
  const x0 = labelW, x1 = w - 8;
  const X = (wk) => x0 + ((wk - from) / (to - from)) * (x1 - x0);
  let s = svgOpen(w, h, t('Absences par joueur', 'Absences by player'));
  for (let wk = from; wk <= to; wk++) {
    s += `<line class="grid" x1="${f1(X(wk))}" x2="${f1(X(wk))}" y1="${top - 4}" y2="${h - 4}"/>`;
    if (wk < to) s += `<text class="tick" x="${f1((X(wk) + X(wk + 1)) / 2)}" y="${top - 8}" text-anchor="middle">${t('S', 'W')}${wk}</text>`;
  }
  const xn = X(now + 0.5);
  rows.forEach((r, i) => {
    const y = top + i * row;
    s += `<text class="label" x="0" y="${y + 14}" style="fill:var(--ink);font-weight:600">${r.who}</text>`;
    s += `<text class="tick" x="0" y="${y + 27}">${r.what}</text>`;
    const xa = X(Math.max(r.start, from)), xb = X(Math.min(r.end, to));
    if (r.ongoing) {
      s += `<rect x="${f1(xa)}" y="${y + 7}" width="${f1(Math.min(xn, xb) - xa)}" height="12" fill="var(--ink)"/>`;
      if (xb > xn) s += `<rect x="${f1(xn)}" y="${y + 7.75}" width="${f1(xb - xn)}" height="10.5" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    } else {
      s += `<rect x="${f1(xa)}" y="${y + 7}" width="${f1(xb - xa)}" height="12" fill="var(--reference)"/>`;
    }
    // phase label after the bar, or before it when it would cross the right edge (approx. 5.6 px per character)
    const fits = xb + 6 + r.phase.length * 5.6 <= w;
    s += `<text class="tick" x="${f1(fits ? xb + 6 : xa - 6)}" y="${y + 17}" text-anchor="${fits ? 'start' : 'end'}">${r.phase}</text>`;
  });
  s += `<line x1="${f1(xn)}" x2="${f1(xn)}" y1="${top - 4}" y2="${h - 2}" stroke="var(--accent)" stroke-width="1.5"/>`;
  s += `<text class="annot" x="${f1(xn + 4)}" y="${h - 4}" style="fill:var(--accent);font-weight:600">${t('aujourd’hui', 'today')}</text>`;
  return s + '</svg>';
}

// ---------- Dot strip: distribution of one measure across the squad ----------
// rows: [{ title, values: { label: value }, focus: [labels] }]; scale shared; median tick per row.
function dotStrip({ rows, dom, ticks, w = 698, row = 66, labelW = 110, note }) {
  const x0 = labelW, x1 = w - 20, h = rows.length * row + 30;
  const X = (v) => x0 + ((v - dom[0]) / (dom[1] - dom[0])) * (x1 - x0);
  let s = svgOpen(w, h, t('Distribution', 'Distribution'));
  rows.forEach((r, k) => {
    const yc = k * row + 36;
    s += `<text class="label" x="0" y="${yc + 4}" style="fill:var(--ink);font-weight:600">${r.title}</text>`;
    s += `<line class="axis" x1="${x0}" x2="${x1}" y1="${yc}" y2="${yc}"/>`;
    const vals = Object.values(r.values).sort((a, b) => a - b);
    const med = vals.length % 2 ? vals[vals.length >> 1] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    s += `<line x1="${f1(X(med))}" x2="${f1(X(med))}" y1="${yc - 12}" y2="${yc + 12}" stroke="var(--ink-2)" stroke-width="1.5"/>`;
    s += `<text class="tick" x="${f1(X(med))}" y="${yc + 24}" text-anchor="middle">${t('médiane', 'median')} ${fr(med, 1)}</text>`;
    // light jitter by rank to avoid overlaps
    const seen = {};
    for (const [label, v] of Object.entries(r.values)) {
      if (r.focus.includes(label)) continue;
      const kx = v.toFixed(1); seen[kx] = (seen[kx] || 0) + 1;
      const dy = (seen[kx] - 1) * 5 * (seen[kx] % 2 ? 1 : -1);
      s += `<circle cx="${f1(X(v))}" cy="${f1(yc + dy)}" r="4" fill="var(--reference)" fill-opacity="0.75"/>`;
    }
    let prevX = -999, lift = 0;
    [...r.focus].sort((a, b) => r.values[a] - r.values[b]).forEach((label) => {
      const v = r.values[label], x = X(v);
      lift = x - prevX < 95 ? lift + 12 : 0; prevX = x;
      s += `<circle cx="${f1(x)}" cy="${yc}" r="5" fill="var(--ink)" stroke="var(--surface)" stroke-width="1.5"/>`;
      s += `<text class="value" x="${f1(x)}" y="${yc - 10 - lift}" text-anchor="middle">${label} ${fr(v, 1)}</text>`;
    });
  });
  ticks.forEach((t) => { s += `<text class="tick" x="${f1(X(t))}" y="${h - 4}" text-anchor="middle">${t}</text>`; });
  if (note) s += `<text class="tick" x="${x1}" y="${h - 4}" text-anchor="end">${note}</text>`;
  return s + '</svg>';
}

// ---------- Heatmap matrix (HTML grid, cells styled by theme classes r0-r4 / p0-p4) ----------
const riskClass = (v) => (v >= 75 ? 'r4' : v >= 50 ? 'r3' : v >= 25 ? 'r2' : v >= 10 ? 'r1' : 'r0');
const perfClass = (v) => (v >= 65 ? 'p4' : v >= 55 ? 'p3' : v >= 45 ? 'p2' : v >= 35 ? 'p1' : 'p0');

module.exports = { sparkline, lineChart, hbars, deviation, smallMultiples, scatter, acwrChart, columnsLine, stacked, timeline, dotStrip, riskClass, perfClass, mean };
