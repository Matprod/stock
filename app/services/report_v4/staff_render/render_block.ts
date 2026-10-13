import {
  renderBarPanels,
  renderCallout,
  renderCoverageTable,
  renderDataTable,
  renderFindings,
  renderHeatmap,
  renderKeyFigures,
  renderLineChart,
  renderMasthead,
  renderNotProducedBlock,
  renderReferenceBlock,
  renderWatchCard,
} from '#services/report_v4/staff_render/components/index'
import type { StaffReportBlock } from '#services/report_v4/staff_render/schema'
import type { StaffTrend } from '#services/report_v4/staff_render/svg_scale'

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string') : []
const asNumberArray = (value: unknown): Array<number | null> =>
  Array.isArray(value)
    ? value.map((row) => (typeof row === 'number' && Number.isFinite(row) ? row : null))
    : []

export const renderStaffBlock = (
  block: StaffReportBlock,
  language: 'fr' | 'en'
): string => {
  const data = block.data
  switch (block.component) {
    case 'Masthead':
      return renderMasthead({
        eyebrow: asString(data.eyebrow) || null,
        title: asString(data.title),
        subtitle: asString(data.subtitle) || null,
      })
    case 'KeyFigures':
      return renderKeyFigures({
        figures: Array.isArray(data.figures)
          ? data.figures.map((row) => {
              const item = (row ?? {}) as Record<string, unknown>
              return {
                label: asString(item.label),
                value: asString(item.value),
                unit: asString(item.unit) || null,
              }
            })
          : [],
      })
    case 'Findings':
      return renderFindings({
        items: Array.isArray(data.items)
          ? data.items.map((row) => ({
              text: asString((row as Record<string, unknown>)?.text),
            }))
          : [],
      })
    case 'WatchCard':
      return renderWatchCard({
        name: asString(data.name),
        position: asString(data.position) || null,
        valueLabel: asString(data.valueLabel),
        value: asString(data.value),
        trend: (['up', 'down', 'flat'].includes(asString(data.trend))
          ? asString(data.trend)
          : 'flat') as StaffTrend,
        series: asNumberArray(data.series).filter((n): n is number => n !== null),
        note: asString(data.note) || null,
        sheetHref: asString(data.sheetHref) || null,
      })
    case 'LineChart':
      return renderLineChart({
        title: asString(data.title) || null,
        categories: asStringArray(data.categories),
        series: Array.isArray(data.series)
          ? data.series.map((row) => {
              const item = (row ?? {}) as Record<string, unknown>
              return {
                id: asString(item.id) || 'series',
                label: asString(item.label),
                kind: asString(item.kind) === 'performance' ? 'performance' : 'risk',
                values: asNumberArray(item.values),
              }
            })
          : [],
        sessionIndexes: Array.isArray(data.sessionIndexes)
          ? data.sessionIndexes.filter((n): n is number => typeof n === 'number')
          : [],
        annotations: Array.isArray(data.annotations)
          ? (data.annotations as Array<Record<string, unknown>>).flatMap((ann) => {
              if (ann.type === 'vline' && typeof ann.index === 'number') {
                return [
                  {
                    type: 'vline' as const,
                    index: ann.index,
                    label: asString(ann.label) || undefined,
                  },
                ]
              }
              if (
                ann.type === 'brace' &&
                typeof ann.fromIndex === 'number' &&
                typeof ann.toIndex === 'number'
              ) {
                return [
                  {
                    type: 'brace' as const,
                    fromIndex: ann.fromIndex,
                    toIndex: ann.toIndex,
                    label: asString(ann.label) || undefined,
                  },
                ]
              }
              return []
            })
          : [],
      })
    case 'Heatmap':
      return renderHeatmap({
        title: asString(data.title) || null,
        days: asStringArray(data.days),
        rows: Array.isArray(data.rows)
          ? data.rows.map((row) => {
              const item = (row ?? {}) as Record<string, unknown>
              return { label: asString(item.label), values: asNumberArray(item.values) }
            })
          : [],
        teamValues: Array.isArray(data.teamValues) ? asNumberArray(data.teamValues) : undefined,
      })
    case 'BarPanels':
      return renderBarPanels({
        panels: Array.isArray(data.panels)
          ? data.panels.map((row) => {
              const item = (row ?? {}) as Record<string, unknown>
              return {
                title: asString(item.title),
                unit: asString(item.unit) || null,
                items: Array.isArray(item.items)
                  ? item.items.map((entry) => {
                      const cell = (entry ?? {}) as Record<string, unknown>
                      return {
                        label: asString(cell.label),
                        value:
                          typeof cell.value === 'number' && Number.isFinite(cell.value)
                            ? cell.value
                            : null,
                      }
                    })
                  : [],
              }
            })
          : [],
      })
    case 'DataTable':
      return renderDataTable({
        title: asString(data.title) || null,
        columns: Array.isArray(data.columns)
          ? data.columns.map((row) => {
              const item = (row ?? {}) as Record<string, unknown>
              return {
                key: asString(item.key),
                label: asString(item.label),
                numeric: Boolean(item.numeric),
                align: item.align === 'right' ? 'right' : item.align === 'left' ? 'left' : undefined,
              }
            })
          : [],
        rows: Array.isArray(data.rows)
          ? (data.rows as Array<Record<string, string | number | null | undefined>>)
          : [],
        showMeanRow: Boolean(data.showMeanRow),
        meanLabel: asString(data.meanLabel) || undefined,
      })
    case 'Callout':
      return renderCallout(
        {
          kind:
            asString(data.kind) === 'staff_leads' || asString(data.kind) === 'verify'
              ? (asString(data.kind) as 'staff_leads' | 'verify')
              : 'data_show',
          title: asString(data.title) || null,
          body: asString(data.body),
        },
        language
      )
    case 'CoverageTable':
      return renderCoverageTable(
        {
          title: asString(data.title) || null,
          rows: Array.isArray(data.rows)
            ? data.rows.map((row) => {
                const item = (row ?? {}) as Record<string, unknown>
                const statusRaw = asString(item.status)
                const status =
                  statusRaw === 'complete' || statusRaw === 'limited' ? statusRaw : 'partial'
                return {
                  domain: asString(item.domain),
                  status,
                  source: asString(item.source) || null,
                  available: asString(item.available) || null,
                  missing: asString(item.missing) || null,
                }
              })
            : [],
        },
        language
      )
    case 'NotProducedBlock':
      return renderNotProducedBlock(
        {
          title: asString(data.title),
          reason: asString(data.reason) || null,
        },
        language
      )
    case 'ReferenceBlock':
      return renderReferenceBlock(
        {
          title: asString(data.title),
          body: asString(data.body),
        },
        language
      )
    default:
      return `<div data-component="Unknown" data-empty="true"></div>`
  }
}
