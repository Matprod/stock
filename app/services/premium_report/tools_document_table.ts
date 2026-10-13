import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_TABLE_ROWS } from '#constants/premium_report.constants'
import { runVizGate } from '#services/premium_report/premium_report_viz_validator'
import type { PremiumReportBlock, PremiumTableBlock } from '#contracts/premium_report'
import { implausibleMetricWarning, newBlockId, reshapePremiumTable, stripMarkdownDecorations, tableFromDataset, applyTableHeat, projectDatasetColumns, shouldHeatStaffTable } from '#services/premium_report/premium_report_document'
import { relabelTableColumns } from '#services/premium_report/column_labels'
import { readString, readStringList, requireDatasetColumns, trimDatasetRows } from '#services/premium_report/dataset_ops'
import { logPremiumJev } from '#services/premium_report/premium_report_log'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

import {
  softMutateReject,
  listAvailableBlockIds,
  blockNotFoundError,
  commitInsert,
  isShortTextPatch,
  gateTextCaption,
  patchChartOrBlock,
  patchTables,
  readTableReshape,
  readTableStyle,
  readTableRows,
} from '#services/premium_report/tools_document_shared'

export const createTableDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'add_table',
      description:
        'Add table from datasetId or sourceTableId (or columns+rows). Heat is automatic on staff signal columns (ACWR, EWMA, sRPE, wellness/mood/stress/soreness/sleep quality, injury risk) — including daily tables that also have a date column. INTERDICTION: GPS meters + wellness scores in the same table. With datasetId/sourceTableId, columns= keep ONLY those headers (partition for split tables — never add the same full-width dataset twice). Pass heatColors only to override (#RRGGBB).',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          datasetId: { type: 'string' },
          sourceTableId: {
            type: 'string',
            description: 'Copy an existing canvas table block, then optionally keep columns=',
          },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description:
              'With datasetId/sourceTableId: keep only these columns (must include joueur/key). Without: manual header list + rows.',
          },
          rows: { type: 'array' },
          option: { type: 'object' },
          heatColors: { type: 'object' },
          after: { type: 'string' },
        },
      },
    },
    execute: async (input) => {
      const datasetId = readString(input.datasetId)
      const sourceTableId = readString(input.sourceTableId)
      const columns = readStringList(input.columns)
      const sourceTable = sourceTableId
        ? state.document.blocks.find(
            (block): block is PremiumTableBlock =>
              block.type === PREMIUM_BLOCK_TYPE.TABLE && block.id === sourceTableId
          )
        : undefined
      if (sourceTableId && !sourceTable) {
        return JSON.stringify({
          error: `Block id '${sourceTableId}' not found.`,
          available_ids: listAvailableBlockIds(state),
        })
      }
      if (datasetId && !state.datasets.has(datasetId)) {
        return JSON.stringify({
          error: `Unknown datasetId '${datasetId}'`,
          available_ids: [...state.datasets.keys()],
        })
      }

      let fromDataset = datasetId ? state.datasets.get(datasetId) : undefined
      let trimmedFrom: number | undefined
      if (fromDataset) {
        const capped = trimDatasetRows(fromDataset, PREMIUM_REPORT_MAX_TABLE_ROWS)
        fromDataset = capped.dataset
        trimmedFrom = capped.trimmedFrom
        if (columns.length) {
          const colError = requireDatasetColumns(fromDataset, columns)
          if (colError) return colError
          const projected = projectDatasetColumns(fromDataset, columns)
          if (typeof projected === 'string') return projected
          fromDataset = projected
        }
      }

      if (state.limits?.requireLiveDatasetId && !fromDataset && !sourceTable) {
        return JSON.stringify({
          error: 'report_v4 requires live datasetId (or sourceTableId) for add_table',
          hint: 'Do not invent columns+rows — reuse linker datasetIds.',
        })
      }

      let built: Pick<PremiumTableBlock, 'columns' | 'rows'> & {
        droppedEmptyColumns?: string[]
      }
      const tableTitle = readString(input.title)?.trim() || undefined
      const topNMatch = tableTitle ? /top\s*(\d+)/i.exec(tableTitle) : null
      const topN =
        topNMatch && Number.isFinite(Number(topNMatch[1]))
          ? Math.max(1, Math.trunc(Number(topNMatch[1])))
          : null

      if (fromDataset) {
        built = tableFromDataset(fromDataset, state.language)
        if (topN != null && built.rows.length > topN) {
          built = { ...built, rows: built.rows.slice(0, topN) }
        }
      } else if (sourceTable) {
        const reshaped = columns.length
          ? reshapePremiumTable(sourceTable, { columns })
          : sourceTable
        if (typeof reshaped === 'string') return reshaped
        built = { columns: reshaped.columns, rows: reshaped.rows }
      } else {
        built = {
          columns: relabelTableColumns(columns, state.language),
          rows: readTableRows(input.rows, columns.length),
        }
      }
      if (built.columns.length === 0) {
        return JSON.stringify({ error: 'datasetId, sourceTableId, or columns required' })
      }

      if (fromDataset) {
        const jevError = runVizGate(state, {
          toolName: 'add_table',
          title: readString(input.title),
          datasetColumns: fromDataset.columns,
          datasetRowCount: fromDataset.rows.length,
        })
        if (jevError) return jevError
        const metricWarning = implausibleMetricWarning(fromDataset, state.dateRange)
        if (metricWarning) return JSON.stringify({ error: metricWarning })
      }

      const option = readTableStyle(input)
      if (typeof option === 'string') return option
      if (topN != null && built.rows.length > topN) {
        built = { ...built, rows: built.rows.slice(0, topN) }
      }
      const rawBlock: PremiumTableBlock = {
        id: newBlockId(),
        type: PREMIUM_BLOCK_TYPE.TABLE,
        title: tableTitle,
        columns: built.columns,
        rows: built.rows,
        ...(option ? { option } : {}),
      }
      const forceHeat = Boolean(
        input.heatColors != null ||
        (option && (option.heatColors != null || option.heatLegend != null))
      )
      const heat = forceHeat || shouldHeatStaffTable(rawBlock)
      const block: PremiumReportBlock = applyTableHeat(rawBlock, state.language, {
        heat,
        scales: state.heatScales,
      })
      const inserted = commitInsert(state, block, readString(input.after))
      const dropped = 'droppedEmptyColumns' in built ? built.droppedEmptyColumns : undefined
      const heatNote = heat
        ? undefined
        : {
            heat: false,
            note: 'Plain table (Jev: cell coloring not insightful here).',
          }
      if (!dropped?.length && !trimmedFrom) {
        if (!heatNote) return inserted
        try {
          return JSON.stringify({
            ...(JSON.parse(inserted) as Record<string, unknown>),
            ...heatNote,
          })
        } catch {
          return inserted
        }
      }
      try {
        return JSON.stringify({
          ...(JSON.parse(inserted) as Record<string, unknown>),
          ...(dropped?.length ? { droppedEmptyColumns: dropped } : {}),
          ...(trimmedFrom
            ? {
                trimmedRows: trimmedFrom,
                note: `Kept last ${fromDataset?.rows.length ?? 0} rows for table readability.`,
              }
            : {}),
          ...heatNote,
        })
      } catch {
        return inserted
      }
    },
  },
  {
    schema: {
      name: 'update_block',
      description:
        'Patch ONE block by exact id from current.canvas. Surgical only (title/color/seriesLabel/text). Cosmetic chart patches deep-merge — never resend full xAxis/yAxis/dataset/series data. Rebuild series only with a live datasetId (+ optional chartType).',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Exact block.id from current canvas (required)' },
          text: { type: 'string' },
          title: { type: 'string' },
          level: { type: 'integer', enum: [1, 2] },
          datasetId: { type: 'string' },
          datasetIds: { type: 'array', items: { type: 'string' } },
          chartType: {
            type: 'string',
            enum: ['donut', 'bar', 'line', 'bar-line', 'heatmap', 'radar', 'scatter'],
          },
          category: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
          seriesIndex: { type: 'integer' },
          seriesName: { type: 'string', description: 'Match existing series.name to patch' },
          color: { type: 'string', description: 'Series color #RRGGBB' },
          seriesLabel: { type: 'string', description: 'Rename series.name' },
          option: { type: 'object' },
          header: { type: 'object' },
          columnStyles: { type: 'object' },
          heatColors: { type: 'object' },
          columns: { type: 'array', items: { type: 'string' } },
          dropColumns: { type: 'array', items: { type: 'string' } },
          pruneEmptyColumns: { type: 'boolean' },
          renameColumns: { type: 'object' },
          border: {},
        },
        required: ['id'],
      },
    },
    execute: async (input) => {
      const id = readString(input.id)
      const reshape = readTableReshape(input)
      const pruneEmpty = input.pruneEmptyColumns === true

      if (!id) {
        return JSON.stringify({
          error: 'id required — soft/canvas mutate must target an exact block.id from current',
          skipped: true,
        })
      }
      const allowDatasetRebuild =
        Boolean(readString(input.datasetId)) || readStringList(input.datasetIds).length > 0
      const locked = softMutateReject(state, id, { allowDatasetRebuild })
      if (locked) return locked
      const index = state.document.blocks.findIndex((block) => block.id === id)
      const current = state.document.blocks[index]
      if (!current) return blockNotFoundError(state, id)

      if (current.type === PREMIUM_BLOCK_TYPE.TABLE) {
        const style = readTableStyle(input)
        if (typeof style === 'string') return style
        if (style || reshape || pruneEmpty) {
          return patchTables(state, { id, style, reshape, pruneEmpty })
        }
      } else if (reshape || pruneEmpty) {
        return JSON.stringify({
          error: 'columns/dropColumns/renameColumns/pruneEmptyColumns only apply to tables',
          hint: 'For charts use title, datasetId, chartType, option, seriesName, color',
        })
      }

      if (current.type === PREMIUM_BLOCK_TYPE.TEXT && readString(input.text)) {
        const text = stripMarkdownDecorations(
          readString(input.text)?.replace(/\r\n/g, '\n') ?? ''
        ).trim()
        if (text && !isShortTextPatch(text)) {
          const gated = await gateTextCaption(state, text, id)
          if (gated) return gated
        } else if (text) {
          logPremiumJev({
            kind: 'text_caption',
            durationSec: 0,
            ok: true,
            decision: 'skip',
            provider: 'skip',
            detail: `update_block short patch len=${text.length}`,
          })
        }
      }
      const patched = await patchChartOrBlock(current, input, state)
      if (typeof patched === 'string') return patched
      state.document.blocks[index] = patched
      return JSON.stringify({
        ok: true,
        id,
        ...(patched.type === PREMIUM_BLOCK_TYPE.TABLE
          ? { columns: patched.columns, option: patched.option }
          : {}),
      })
    },
  }
]
