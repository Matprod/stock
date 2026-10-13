import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'

export const buildReportPackCss = (pack: ReportDesignPack): string => {
  const t = pack.tokens
  return `
:root {
  --ink: ${t.ink}; --ink-soft: ${t.inkSoft}; --muted: ${t.muted};
  --line: ${t.line}; --primary: ${t.primary}; --light: ${t.lightPrimary};
  --paper: ${t.paper}; --bg: ${t.bg}; --navy: ${t.bg};
  --cover: ${t.coverGradient}; --band: ${t.bandGradient};
  --season: ${t.season}; --club-mark: ${t.clubMark};
  --comment-bg: ${t.commentBg}; --comment-border: ${t.commentBorder};
  --cherry: ${t.cherry}; --cherry-soft: ${t.cherrySoft};
  --saffron: ${t.saffron}; --saffron-soft: ${t.saffronSoft};
  --font-body: ${pack.fonts.body}; --font-display: ${pack.fonts.display};
}
* { box-sizing: border-box; }
[id] { scroll-margin-top: 14px; }
body {
  margin: 0; color: var(--ink); background: #eef1f5;
  font-family: var(--font-body);
  font-size: 12px; line-height: 1.45;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.page.cover {
  min-height: 279mm; padding: 0; background: #fff;
  page-break-after: always; break-after: page;
}
.cover-panel {
  min-height: 279mm; padding: 20mm 16mm 16mm;
  background: var(--cover);
  color: #e8eaf2; position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.cover-panel::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--primary);
}
.brand {
  font-size: 11px; font-weight: 700; letter-spacing: .28em;
  text-transform: uppercase; color: var(--light);
}
.season {
  margin-top: 14px; color: var(--season); font-weight: 600;
  font-size: 12px; letter-spacing: .1em;
}
.cover-title {
  margin: 32px 0 0; max-width: 168mm;
  font-family: var(--font-display);
  font-size: 28px; font-weight: 700; letter-spacing: .01em;
  text-transform: none; line-height: 1.18; color: #f8fafc;
}
.cover-sub {
  margin-top: 12px; max-width: 150mm; color: var(--club-mark);
  font-size: 13px; line-height: 1.45; font-weight: 500;
}
.date-pill {
  margin-top: 20px; align-self: flex-start;
  background: color-mix(in srgb, var(--cover) 78%, #fff);
  border: 1px solid color-mix(in srgb, var(--light) 40%, transparent);
  color: #dbeafe; font-weight: 600; padding: 8px 14px; border-radius: 4px; font-size: 11px;
}
.club-mark {
  margin-top: auto; padding-top: 24px;
  color: var(--club-mark); font-weight: 700; letter-spacing: .18em;
  text-transform: uppercase; font-size: 10px;
}
.report-flow { padding: 14px 14px 28px; max-width: 192mm; margin: 0 auto; background: #fff; }
.section-block { margin: 0 0 18px; }
.band {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  background: var(--band);
  color: #fff; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px;
}
.band h1, .band h2, .band-title {
  margin: 0; font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
  font-family: var(--font-display); color: #fff; font-weight: 650;
}
.band .meta { color: var(--light); font-size: 10px; font-weight: 600; }
.band:has(.card), .band:has(.chart-card), .band:has(.kpi), .band:has(.kpi-grid), .band:has(.chart-box) {
  display: block; background: transparent; color: var(--ink); padding: 0; gap: 0;
}
.band:has(.card) > .band-title,
.band:has(.chart-card) > .band-title,
.band:has(.kpi) > .band-title,
.band:has(.kpi-grid) > .band-title,
.band:has(.chart-box) > .band-title,
.band:has(.card) > h1,
.band:has(.card) > h2,
.band:has(.kpi-grid) > h1,
.band:has(.kpi-grid) > h2 {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--band); color: #fff; border-radius: 4px; padding: 8px 12px; margin: 0 0 12px;
}
.coach-brief {
  background: var(--comment-bg); border: 1px solid var(--comment-border); border-left: 2px solid var(--primary);
  border-radius: 4px; padding: 12px 14px; margin: 0 0 14px;
}
.coach-brief .label {
  margin: 0 0 6px; font-size: 9.5px; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--muted);
}
.coach-brief blockquote {
  margin: 0; color: var(--ink-soft); font-size: 12.5px; line-height: 1.45; font-style: normal;
}
.toc-list { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 6px; }
.toc-list a {
  display: flex; justify-content: space-between; gap: 12px; text-decoration: none;
  background: var(--paper); border: 1px solid var(--line); border-left: 2px solid var(--primary);
  border-radius: 4px; padding: 9px 12px; color: var(--ink); font-weight: 600; font-size: 12px;
}
.toc-list .hint { color: var(--muted); font-size: 10px; font-weight: 600; }
.kpi-row, .kpi-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 0 0 14px;
}
.kpi {
  background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 12px 14px;
  color: var(--ink);
}
.kpi .label, .kpi-label {
  font-size: 9px; font-weight: 700; letter-spacing: .05em;
  text-transform: uppercase; color: var(--muted); margin: 0 0 4px;
}
.kpi .value, .kpi-value {
  margin: 0; font-size: 18px; font-weight: 700; color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.kpi .hint { margin: 4px 0 0; font-size: 10px; color: var(--muted); }
.section-intro {
  display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start;
  margin: 0 0 12px;
}
.athlete-banner {
  display: flex; gap: 8px; align-items: center; min-width: 140px;
  background: var(--paper); border: 1px solid var(--line); border-radius: 4px; padding: 8px 10px;
}
.athlete-banner .avatar-fallback {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center; background: var(--navy); color: #e2e8f0;
  font-weight: 700; font-size: 11px;
}
.athlete-banner .name { font-weight: 700; font-size: 13px; color: var(--ink); }
.athlete-banner .meta { font-size: 10px; color: var(--muted); margin-top: 1px; }
.intro-prose { color: var(--ink-soft); font-size: 12.5px; line-height: 1.45; }
.card, .chart-card {
  background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 12px 14px;
  margin: 0 0 12px; overflow: visible; break-inside: avoid; page-break-inside: avoid;
  color: var(--ink);
}
.card p, .chart-card p { color: var(--ink-soft); }
.card h3, .chart-card h3 {
  margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .03em;
  text-transform: none; color: var(--ink);
}
.chart-caption {
  margin: 0 0 8px; font-size: 10.5px; color: var(--muted); line-height: 1.35;
}
.prose { color: var(--ink-soft); font-size: 12px; line-height: 1.45; margin: 0 0 8px; }
.callout {
  border: 1px solid var(--comment-border); background: var(--comment-bg); border-radius: 4px;
  padding: 10px 12px; margin: 0 0 12px; color: var(--ink-soft); font-size: 12px; line-height: 1.4;
}
.split-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 0 12px;
}
.split-row.split-chart-table { grid-template-columns: minmax(120px, 55%) 1fr; }
.chart-box { width: 100%; height: 260px; max-height: 260px; }
.chart-box.line-chart { height: 320px; max-height: 320px; }
.chart-box.bar-rank { height: 290px; max-height: 290px; }
.chart-box.compact { height: 160px; max-height: 160px; }
.chart-box.radar { height: 300px; max-height: 300px; }
.chart-box.tall { height: 340px; max-height: 340px; }
.chart-box.wide { height: 320px; max-height: 320px; }
table.report-table {
  width: 100%; border-collapse: collapse;
  font-size: 10.5px;
}
table.report-table thead th {
  background: var(--paper); color: var(--ink); font-weight: 700; letter-spacing: .03em;
  text-transform: uppercase; font-size: 9px;
  border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left;
}
table.report-table thead th.num,
table.report-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
table.report-table td {
  border-bottom: 1px solid var(--line); padding: 7px 10px; color: var(--ink-soft);
  background: transparent;
}
table.report-table td.lvl-hi,
table.report-table td.lvl-mid,
table.report-table td.lvl-lo {
  color: var(--ink) !important;
  font-weight: 500 !important;
}
table.report-table td.lvl-hi { background: var(--cherry-soft) !important; }
table.report-table td.lvl-mid { background: var(--saffron-soft) !important; }
table.report-table td.lvl-lo { background: color-mix(in srgb, #34d399 22%, #fff) !important; }
table.report-table tbody tr:last-child td {
  border-bottom: 1px solid var(--line);
}
.report-footer {
  margin-top: 18px; padding-top: 10px; border-top: 1px solid var(--line);
  display: flex; justify-content: space-between; gap: 12px;
  color: var(--muted); font-size: 9.5px; letter-spacing: .04em; text-transform: uppercase;
}
.staff-read-lead { color: var(--ink-soft); font-size: 12.5px; line-height: 1.45; margin: 0 0 12px; }
.staff-read-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 0 12px; }
.staff-read-panel {
  background: var(--paper); border: 1px solid var(--line); border-radius: 4px;
  padding: 12px; break-inside: avoid; page-break-inside: avoid;
}
.staff-read-panel h3 {
  margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .04em;
  text-transform: uppercase; color: var(--ink); font-family: var(--font-display);
}
.staff-read-panel ul { margin: 0; padding-left: 16px; color: var(--ink-soft); font-size: 12px; line-height: 1.4; }
.staff-read-panel li { margin: 0 0 6px; }

@media print {
  body { background: #fff; font-size: 10.5pt; margin: 0; }
  .page.cover {
    width: 210mm; max-width: 210mm;
    min-height: 297mm; height: 297mm; max-height: 297mm;
    margin: 0; padding: 0; overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .cover-panel {
    width: 210mm; max-width: 210mm;
    min-height: 297mm; height: 297mm; max-height: 297mm;
    margin: 0; box-sizing: border-box; overflow: hidden; border-radius: 0;
  }
  .report-flow {
    width: 210mm; max-width: 210mm; margin: 0;
    padding: 10mm 12mm 12mm; box-sizing: border-box;
  }
  .chart-box { height: 260px !important; max-height: 280px !important; max-width: 100%; }
  .chart-box.line-chart { height: 320px !important; max-height: 340px !important; }
}
`.trim()
}

export const buildClubTemplateExtraCss = (): string => `
[id] { scroll-margin-top: 12px; }
.artifact-shell { min-height: 100vh; position: relative; z-index: 1; }
.artifact-main { max-width: 980px; margin: 0 auto; padding: 16px 16px 40px; }
.page.cover, .page.toc-page {
  width: 100%; max-width: 192mm; min-height: auto; margin: 0 auto 16px;
  page-break-after: always; break-after: page;
}
.page.content-page, .report-flow {
  width: 100%; max-width: 192mm; margin: 0 auto;
  page-break-inside: auto; break-inside: auto;
}
.cover-panel { min-height: min(72vh, 279mm); border-radius: 10px; }
.wm {
  position: absolute; inset: 0; display: grid; place-items: center;
  opacity: .04; font-size: 88px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; pointer-events: none;
}
.brand, .season, .cover-title, .date-pill, .club-mark { z-index: 1; }
.section-intro {
  display: grid; grid-template-columns: minmax(120px, 30%) 1fr; gap: 10px;
  align-items: start; margin: 0 0 10px; break-inside: avoid; page-break-inside: avoid;
}
.section-intro .athlete-banner { margin: 0; }
.chart-box.radar { height: 300px; max-height: 300px; }
.chart-box.tall { height: 340px; max-height: 340px; }
.chart-box.wide { height: 320px; max-height: 320px; }
.chart-legend-html {
  display: flex; flex-wrap: wrap; gap: 5px 10px; margin-top: 6px;
  font-size: 9.5px; color: var(--ink-soft);
}
.chart-legend-html i {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  margin-right: 4px; vertical-align: middle;
}
.athlete-banner .avatar-wrap { position: relative; width: 56px; height: 56px; flex: 0 0 56px; }
.athlete-banner img {
  width: 56px; height: 56px; border-radius: 50%; object-fit: cover; background: #e2e8f0;
}
.athlete-banner .avatar-fallback {
  width: 56px; height: 56px; border-radius: 50%;
  display: none; place-items: center; font-weight: 700; color: #fff;
  background: var(--primary); font-size: 14px;
}
.athlete-banner.no-photo img { display: none; }
.athlete-banner.no-photo .avatar-fallback { display: grid; }
.footer-inline {
  display: flex; justify-content: space-between; color: var(--muted);
  font-size: 9px; letter-spacing: .04em; text-transform: uppercase;
  margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--line);
}
.staff-read-lead { color: var(--ink-soft); font-size: 12px; line-height: 1.45; margin: 0 0 10px; }
.staff-read-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 10px; }
.staff-read-panel {
  background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
  padding: 10px; break-inside: avoid; page-break-inside: avoid;
}
.staff-read-panel h3 {
  margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em;
  text-transform: uppercase; color: var(--ink); font-family: var(--font-display);
}
.staff-read-panel ul { margin: 0; padding-left: 16px; color: var(--ink-soft); font-size: 11.5px; line-height: 1.4; }
.staff-read-panel li { margin: 0 0 5px; }
.insight-science-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.insight-science-list li { margin: 0; padding: 0 0 6px; border-bottom: 1px solid var(--line); }
.insight-science-list li:last-child { border-bottom: 0; padding-bottom: 0; }
.insight-science-head { display: flex; justify-content: space-between; gap: 8px; font-weight: 650; color: var(--ink); margin-bottom: 2px; }
.insight-science-list p { margin: 0; color: var(--ink-soft); font-size: 11px; line-height: 1.35; }
.insight-science-head .kind { color: var(--muted); font-size: 10px; font-weight: 600; }
.signal-roster { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.signal-roster a { color: inherit; text-decoration: none; }
.signal-roster a:hover .signal-body { color: var(--primary); }
.signal-roster li {
  display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start;
  padding: 7px 8px; border-radius: 6px; border: 1px solid var(--line); background: #fff;
}
.signal-badge {
  font-size: 8.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  border-radius: 999px; padding: 3px 7px; white-space: nowrap;
}
.signal-badge.watch { background: var(--cherry-soft); color: #9f1239; border: 1px solid var(--cherry); }
.signal-badge.review { background: var(--saffron-soft); color: #92400e; border: 1px solid var(--saffron); }
.signal-badge.info { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--ink); border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); }
.signal-body { font-size: 11px; line-height: 1.35; color: var(--ink-soft); }
.signal-meta { font-size: 9.5px; color: var(--muted); margin-top: 3px; font-weight: 600; }
#staff-read { page-break-after: always; break-after: page; margin-bottom: 4mm; }
@media print {
  .artifact-main { max-width: none; margin: 0; padding: 0; }
  .card:has(table.report-table) { break-inside: auto; page-break-inside: auto; }
  table.report-table thead { display: table-header-group; }
  table.report-table tr { break-inside: avoid; page-break-inside: avoid; }
}
`.trim()

export const buildReportPrintCss = (): string => `
@page { size: A4; margin: 0; }
html, body { position: relative; }
body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.card, .chart-card, .frame, .coach-brief, .section-block > .card,
article.card, article.chart-card {
  border: 1.75px solid #94a3b8 !important;
  border-radius: 8px;
}
.toc-list a {
  border: 1.5px solid #94a3b8 !important;
  border-left: 3px solid var(--primary, #4f6ef7) !important;
}
table.report-table {
  border-collapse: collapse !important;
}
table.report-table thead th,
table thead th {
  background: var(--paper, #dce8f6) !important;
  color: var(--navy, #0b1f3a) !important;
  border-bottom: 2px solid color-mix(in srgb, var(--primary, #4f6ef7) 55%, var(--line, #cbd5e1)) !important;
  text-transform: uppercase;
  font-size: 9.5px !important;
}
table.report-table th.num,
table.report-table td.num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}
table.report-table th,
table.report-table td,
table th, table td {
  border-bottom: 1px solid var(--line, #c5d4e8) !important;
}
table.report-table tbody tr:nth-child(even) td:not(.lvl-hi):not(.lvl-mid):not(.lvl-lo):not([data-mauna-heat]) {
  background: transparent !important;
}
table td[data-mauna-heat],
table.report-table td.lvl-hi,
table.report-table td.lvl-mid,
table.report-table td.lvl-lo {
  color: var(--ink, #1e3a5f) !important;
  font-weight: 500 !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
table.report-table tbody tr:last-child td {
  border-bottom: 1.5px solid color-mix(in srgb, var(--primary, #4f6ef7) 55%, var(--line, #cbd5e1)) !important;
}
.report-flow [style*="gradient"],
.content-page [style*="gradient"] {
  background-image: none !important;
}
.kpi, .kpi-row > * {
  background: #fff !important;
  color: var(--ink, #0f172a) !important;
  border: 1.5px solid #94a3b8 !important;
}
@media print {
  .no-print, .artifact-nav, .artifact-toolbar, .table-toolbar { display: none !important; }
  html, body {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 210mm !important;
    max-width: 210mm !important;
    overflow-x: hidden !important;
  }
  body {
    font-size: 10.5pt !important;
    line-height: 1.35 !important;
  }
  .page.cover {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: 297mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .cover-panel {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: 297mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    border-radius: 0 !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  .report-flow,
  .page.content-page {
    width: 210mm !important;
    max-width: 210mm !important;
    margin: 0 !important;
    padding: 10mm 12mm 12mm !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }
  h1 { font-size: 1.35rem !important; margin: 0 0 0.35em !important; }
  h2 { font-size: 1.1rem !important; margin: 0.55em 0 0.3em !important; }
  h3 { font-size: 0.98rem !important; margin: 0.4em 0 0.25em !important; }
  p, li { margin: 0.25em 0 !important; }
  section, .section, .chart-card, article {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 8px !important;
  }
  .card, .chart-card, article.chart-card {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    padding: 8px 10px !important;
  }
  .chart-box {
    break-inside: avoid;
    page-break-inside: avoid;
    height: 260px !important;
    max-height: 280px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .chart-box.line-chart,
  .chart-box[data-chart-kind="line"] {
    height: 340px !important;
    max-height: 360px !important;
  }
  .chart-box.bar-rank,
  .chart-box[data-chart-kind="bar"] {
    height: 300px !important;
    max-height: 320px !important;
  }
  table { break-inside: auto; font-size: 9pt !important; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .chart-card + .chart-card { margin-top: 4px !important; }
}
`.trim()
