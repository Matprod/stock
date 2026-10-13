import { bindFactsInUnknown, type StaffFact } from '#services/report_v4/staff_render/facts_bind'
import { renderStaffBlock } from '#services/report_v4/staff_render/render_block'
import { renderStaffPage, staffPageChromeCss } from '#services/report_v4/staff_render/page'
import type { StaffReportDocument } from '#services/report_v4/staff_render/schema'
import { STAFF_FONTS } from '#services/report_v4/staff_render/tokens'

export type RenderStaffReportResult = {
  html: string
  warnings: string[]
  missingFacts: string[]
  chartCount: number
  pageCount: number
}

const countCharts = (html: string): number =>
  (
    html.match(
      /data-component="(?:LineChart|Heatmap|BarPanels)"(?![^>]*data-empty="true")/g
    ) ?? []
  ).length

export const renderStaffReportHtml = (args: {
  document: StaffReportDocument
  facts?: Map<string, StaffFact> | Iterable<StaffFact>
  fontFaceCss?: string
}): RenderStaffReportResult => {
  const language = args.document.language === 'en' ? 'en' : 'fr'
  const facts =
    args.facts instanceof Map
      ? args.facts
      : new Map([...(args.facts ?? [])].map((fact) => [fact.id, fact]))
  const warnings: string[] = []
  const missingFacts: string[] = []
  const pages = args.document.pages.map((page, index) => {
    const boundBlocks = page.blocks.map((block) => {
      const bound = bindFactsInUnknown(block.data, facts)
      missingFacts.push(...bound.missing)
      warnings.push(...bound.warnings)
      return { ...block, data: bound.value as Record<string, unknown> }
    })
    const contentHtml = boundBlocks.map((block) => renderStaffBlock(block, language)).join('\n')
    return renderStaffPage({
      pageNumber: index + 1,
      pageTotal: args.document.pages.length,
      headerLeft: page.headerLeft,
      headerRight: page.headerRight,
      contentHtml,
    })
  })

  const body = pages.join('\n')
  const fontCss = args.fontFaceCss?.trim()
    ? `<style id="staff-fonts">${args.fontFaceCss}</style>`
    : ''
  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8"/>
<title>${args.document.clubName ? `${args.document.clubName} — ` : ''}staff report</title>
${fontCss}
<style id="staff-chrome">${staffPageChromeCss()}
body{margin:0;background:#eef1f5;font-family:${STAFF_FONTS.body},ui-sans-serif,sans-serif}
</style>
</head>
<body>
${body}
</body>
</html>`

  return {
    html,
    warnings: [...new Set(warnings)],
    missingFacts: [...new Set(missingFacts)],
    chartCount: countCharts(html),
    pageCount: args.document.pages.length,
  }
}
