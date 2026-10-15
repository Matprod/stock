// Shared helpers for the reference pages: locale, number formats, page shell, small icons.
// Locale comes from REF_LOCALE (en | fr). English is the reference language; French is the variant.
const LOCALE = process.env.REF_LOCALE === 'fr' ? 'fr' : 'en';
const t = (fr, en) => (LOCALE === 'en' ? en : fr);

const NB = ' ';
const THOUSANDS = t(NB, ',');
// Decimal number in the page's locale (the name `fr` is kept: "format").
const fr = (x, d = 1) => (LOCALE === 'en' ? x.toFixed(d) : x.toFixed(d).replace('.', ','));
const int = (x) => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS);
const PCT = t(NB + '%', '%');
const pct = (x, d = 0) => fr(x, d) + PCT;
const signed = (x, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + fr(Math.abs(x), d);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (a) => a.reduce((s, x) => s + x, 0);
const day = (n) => t(`${n}${NB}mars`, `${n}${NB}March`);
const dayShort = (n) => t(`${n}${NB}mars`, `${n}${NB}Mar`);

const PERIOD = t(`Semaine du 2 au 8${NB}mars 2026`, `Week of 2–8${NB}March 2026`);
const TOTAL = 12;

const page = (title, body, n, { head = true, cls = '' } = {}) => `<!doctype html>
<html lang="${LOCALE}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="../../theme.css">
</head>
<body>
<div class="page${cls ? ' ' + cls : ''}">
${head ? `  <header class="runhead"><span class="brand">${t('Rapport staff · Équipe première', 'Staff report · First team')}</span><span class="period">${PERIOD}</span></header>\n` : ''}${body}
  <footer class="runfoot"><span>${t('MAUNA · Rapport staff, équipe première', 'MAUNA · Staff report, first team')}</span><span>${n} / ${TOTAL}</span></footer>
</div>
</body>
</html>
`;

const intro = (kicker, headline, lede, top = 22) => `
  <section class="stack-2" style="margin-top:${top}px">
    <div class="kicker">${kicker}</div>
    <h1 class="headline">${headline}</h1>
    <p class="lede">${lede}</p>
  </section>`;

const arrow = (dir) => dir === 'up'
  ? '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 9V1M1.5 4.5 5 1l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  : '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1v8M1.5 5.5 5 9l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

// Legend keys drawn in SVG (Barlow has no symbol glyphs).
const key = {
  risk: '<svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--risk)"/></svg>',
  perf: '<svg width="10" height="10"><rect x="1" y="1" width="8" height="8" fill="var(--perf)"/></svg>',
  session: '<svg width="10" height="10"><path d="M5 1l4 4-4 4-4-4z" fill="var(--ink-2)"/></svg>',
  ref: '<svg width="16" height="10"><line x1="0" x2="16" y1="5" y2="5" stroke="var(--reference)" stroke-width="1.5" stroke-dasharray="4 3"/></svg>',
  line: (c) => `<svg width="16" height="10"><line x1="0" x2="16" y1="5" y2="5" stroke="${c}" stroke-width="2"/></svg>`,
  box: (c) => `<svg width="10" height="10"><rect x="0.5" y="0.5" width="9" height="9" fill="${c}"/></svg>`,
  band: '<svg width="14" height="10"><rect x="0" y="0" width="14" height="10" fill="var(--surface-2)" stroke="var(--line)"/></svg>',
};

module.exports = { LOCALE, t, NB, fr, int, pct, PCT, signed, mean, median, sum, day, dayShort, PERIOD, TOTAL, page, intro, arrow, key };
