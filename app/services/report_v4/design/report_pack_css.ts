import type { ReportDesignPack } from '#services/report_v4/design/report_design_pack'
import {
  buildReportPackBandCss,
  buildReportPackContentCss,
  buildReportPackCoverCss,
  buildReportPackRootCss,
  buildReportPackTableCss,
} from '#services/report_v4/design/report_pack_css_tokens'

export const buildReportPackCss = (pack: ReportDesignPack): string =>
  [
    buildReportPackRootCss(pack),
    buildReportPackCoverCss(),
    buildReportPackBandCss(),
    buildReportPackContentCss(),
    buildReportPackTableCss(),
  ].join('\n')

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
table.report-table th.date,
table.report-table td.date,
table.report-table td[data-col-kind="date"] {
  white-space: nowrap !important;
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
