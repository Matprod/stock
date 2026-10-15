import type { PremiumTool } from '#services/premium_report/premium_report_tools'
import { CHART_SVG_TYPE, renderChartSvg } from '#services/report_v4/chart_svg/index'
import { blankImputedCells } from '#services/report_v4/imputed_cells'
import {
  assembleFreeDesignerHtml,
  countFreeDesignerPages,
  extractFreeDesignerPagesBody,
  freeDesignerHtmlLooksValid,
  mergeFreeDesignerPagesHtml,
} from '#services/report_v4/free_designer/assemble_document'
import type { ReportV4RunState } from '#services/report_v4/orchestrator_helpers'
import { ARTIFACT_MIN_HTML_BYTES } from '#services/report_v4/report_v4_constants'
import { injectDataFactsInHtml } from '#services/report_v4/report_facts'
import { dedupeAdjacentUnitSpans } from '#services/report_v4/metrics/column_labels'
import type { AppLanguage } from '#utils/localize'

const CHART_TYPES = Object.values(CHART_SVG_TYPE)
const APPEND_MIN_HTML_BYTES = 120

export type FreeDesignerToolArgs = {
  run: ReportV4RunState
  language: AppLanguage
  clubName?: string
}

const pagesLookValid = (html: string, mode: 'replace' | 'append'): boolean => {
  if (!/\bclass=["'][^"']*\bpage\b/i.test(html)) return false
  const min = mode === 'append' ? APPEND_MIN_HTML_BYTES : ARTIFACT_MIN_HTML_BYTES
  return html.trim().length >= min
}

export const createFreeDesignerTools = (args: FreeDesignerToolArgs): PremiumTool[] => {
  const { run, language } = args

  return [
    {
      schema: {
        name: 'chart_svg',
        description:
          'Render an inline SVG chart from a Linker datasetId and type. Returns SVG markup (or error). Use these SVGs inside set_report_pages HTML.',
        input_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: CHART_TYPES },
            datasetId: { type: 'string' },
            options: { type: 'object' },
          },
          required: ['type', 'datasetId'],
        },
      },
      execute: async (input) => {
        const type = typeof input.type === 'string' ? input.type.trim() : ''
        const datasetId = typeof input.datasetId === 'string' ? input.datasetId.trim() : ''
        const options =
          input.options && typeof input.options === 'object' && !Array.isArray(input.options)
            ? (input.options as Record<string, unknown>)
            : {}
        if (!datasetId) return JSON.stringify({ error: 'datasetId is required' })
        const stored = run.agentState.datasets.get(datasetId)
        if (!stored) return JSON.stringify({ error: `unknown datasetId: ${datasetId}` })
        const blanked = blankImputedCells(stored)
        const dataset: Record<string, unknown> = {
          id: blanked.id,
          columns: blanked.columns,
          rows: blanked.rows,
          units: blanked.units,
          labels: blanked.labels,
          dateRange: blanked.dateRange,
        }
        const result = renderChartSvg({ type, datasetId, dataset, options })
        if (result.error) return JSON.stringify({ error: result.error, svg: result.svg })
        return result.svg
      },
    },
    {
      schema: {
        name: 'set_report_pages',
        description:
          'Commit page body HTML (div.page…). Prefer 1–3 pages per call. Use mode=replace for the first batch, mode=append for the next batches. Never send the whole report in one call when there are many athlete sheets. Server embeds theme.css and stamps data-block-id.',
        input_schema: {
          type: 'object',
          properties: {
            html: {
              type: 'string',
              minLength: APPEND_MIN_HTML_BYTES,
              description:
                'Body pages HTML with at least one div.page. No full document head. Keep each call under ~3 pages.',
            },
            mode: {
              type: 'string',
              enum: ['replace', 'append'],
              description:
                'replace = start fresh (default). append = add pages after existing ones.',
            },
            style: {
              type: 'string',
              description:
                'Optional page-specific layout CSS using theme variables only (replace only).',
            },
            done: {
              type: 'boolean',
              description: 'true when this batch is the last pages of the report.',
            },
          },
          required: ['html'],
        },
      },
      execute: async (input) => {
        const raw = typeof input.html === 'string' ? input.html.trim() : ''
        const mode = input.mode === 'append' ? 'append' : 'replace'
        const style = typeof input.style === 'string' ? input.style : undefined
        const done = input.done === true
        if (!pagesLookValid(raw, mode)) {
          if (mode === 'replace') run.htmlArtifact = null
          return JSON.stringify({
            ok: false,
            error:
              mode === 'append'
                ? 'append html missing .page — send 1–3 div.page bodies'
                : 'html too short or missing .page — send body pages with at least one div.page',
          })
        }
        const existingPages = countFreeDesignerPages(
          extractFreeDesignerPagesBody(run.htmlArtifact)
        )
        const incomingPages = countFreeDesignerPages(raw)
        if (mode === 'replace' && existingPages >= 4 && incomingPages < existingPages) {
          return JSON.stringify({
            ok: false,
            error: `replace would drop pages (${existingPages} → ${incomingPages}). Use mode=append for new pages, or send all pages in replace.`,
          })
        }
        const mergedPages = mergeFreeDesignerPagesHtml({
          existingArtifact: run.htmlArtifact,
          incomingPagesHtml: raw,
          mode,
        })
        let assembled = assembleFreeDesignerHtml({
          pagesHtml: mergedPages,
          layoutStyle: mode === 'replace' ? style : undefined,
          language,
        })
        const injected = injectDataFactsInHtml({
          html: assembled,
          facts: run.facts,
          language,
        })
        assembled = dedupeAdjacentUnitSpans(injected.html)
        if (!freeDesignerHtmlLooksValid(assembled)) {
          if (mode === 'replace') run.htmlArtifact = null
          return JSON.stringify({
            ok: false,
            error: 'assembled HTML failed validation',
          })
        }
        run.htmlArtifact = assembled
        const pageCount = countFreeDesignerPages(mergedPages)
        return JSON.stringify({
          ok: true,
          mode,
          done,
          pageCount,
          bytes: assembled.length,
          factsFilled: injected.filled,
          factsMissing: injected.missing.slice(0, 20),
          next:
            done || pageCount >= 2
              ? done
                ? 'Pages committed. End turn when the report is complete.'
                : 'Pages saved. Continue with set_report_pages mode=append for the next 1–3 pages, or set done=true if finished.'
              : 'Pages saved. Continue with set_report_pages mode=append for remaining pages.',
        })
      },
    },
  ]
}
