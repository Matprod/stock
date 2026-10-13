import { contrastRatio, STAFF_MIN_TEXT_CONTRAST } from '#services/report_v4/staff_render/contrast'
import { STAFF_COLORS, STAFF_PAGE } from '#services/report_v4/staff_render/tokens'

export type StaffVisualWarning = {
  page: number
  code:
    | 'empty_page'
    | 'cover_without_content'
    | 'chart_count_mismatch'
    | 'large_vertical_gap'
    | 'low_contrast_token'
    | 'overflow_risk'
  message: string
}

export type StaffVisualAuditInput = {
  html: string
  announcedChartCount?: number
}

const pageChunks = (html: string): string[] => {
  const matches = html.match(
    /<section\b[^>]*\bdata-staff-page=["']\d+["'][^>]*>[\s\S]*?<\/section>/g
  )
  return matches ?? []
}

export const auditStaffReportVisual = (input: StaffVisualAuditInput): StaffVisualWarning[] => {
  const warnings: StaffVisualWarning[] = []
  const pages = pageChunks(input.html)
  if (pages.length === 0) {
    warnings.push({
      page: 0,
      code: 'empty_page',
      message: 'No staff-page sections found',
    })
    return warnings
  }

  const presentCharts = (
    input.html.match(
      /data-component="(?:LineChart|Heatmap|BarPanels)"(?![^>]*data-empty="true")/g
    ) ?? []
  ).length
  if (
    typeof input.announcedChartCount === 'number' &&
    input.announcedChartCount !== presentCharts
  ) {
    warnings.push({
      page: 0,
      code: 'chart_count_mismatch',
      message: `announced charts=${input.announcedChartCount}, present=${presentCharts}`,
    })
  }

  const tokenPairs: Array<[string, string]> = [
    [STAFF_COLORS.ink, STAFF_COLORS.paper],
    [STAFF_COLORS.inkSoft, STAFF_COLORS.paper],
    [STAFF_COLORS.muted, STAFF_COLORS.paper],
  ]
  for (const [text, background] of tokenPairs) {
    if (contrastRatio(text, background) < STAFF_MIN_TEXT_CONTRAST) {
      warnings.push({
        page: 0,
        code: 'low_contrast_token',
        message: `${text} on ${background}`,
      })
    }
  }

  for (const [index, pageHtml] of pages.entries()) {
    const page = index + 1
    const hasComponent = /data-component=/.test(pageHtml)
    const bodyOpen = pageHtml.indexOf('class="staff-page-body"')
    const footerOpen = pageHtml.indexOf('class="staff-page-footer"')
    const bodySlice =
      bodyOpen >= 0 && footerOpen > bodyOpen
        ? pageHtml.slice(bodyOpen, footerOpen).trim()
        : ''
    if (!bodySlice || !hasComponent) {
      warnings.push({ page, code: 'empty_page', message: `page ${page} body is empty` })
      continue
    }
    if (page === 1 && !hasComponent) {
      warnings.push({
        page,
        code: 'cover_without_content',
        message: 'first page has no staff components',
      })
    }
    const spacerMatches = bodySlice.match(/margin(?:-top|-bottom)?:\s*(\d+)px/gi) ?? []
    for (const spacer of spacerMatches) {
      const px = Number(/(\d+)/.exec(spacer)?.[1] ?? 0)
      if (px > STAFF_PAGE.heightPx * 0.25) {
        warnings.push({
          page,
          code: 'large_vertical_gap',
          message: `spacer ${px}px exceeds 25% of useful height`,
        })
      }
    }
    if (bodySlice.length > 80_000) {
      warnings.push({
        page,
        code: 'overflow_risk',
        message: 'page body HTML is unusually large; check overflow at étape 6 screenshot pass',
      })
    }
  }

  return warnings
}

export const formatStaffVisualAuditReport = (warnings: StaffVisualWarning[]): string => {
  if (warnings.length === 0) return 'Visual audit: no warnings'
  const lines = warnings.map((row) => `p${row.page} · ${row.code} · ${row.message}`)
  return `Visual audit warnings (${warnings.length}):\n${lines.join('\n')}`
}
