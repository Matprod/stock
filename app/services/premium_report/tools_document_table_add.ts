import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_TABLE_ROWS } from '#constants/premium_report.constants'
import { runVizGate } from '#services/premium_report/premium_report_viz_validator'
import type { PremiumReportBlock, PremiumTableBlock } from '#contracts/premium_report'
import { implausibleMetricWarning, newBlockId, reshapePremiumTable, tableFromDataset, applyTableHeat, projectDatasetColumns, shouldHeatStaffTable } from '#services/premium_report/premium_report_document'
import { relabelTableColumns } from '#services/premium_report/column_labels'
import { readString, readStringList, requireDatasetColumns, trimDatasetRows } from '#services/premium_report/dataset_ops'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'

import {
  listAvailableBlockIds,
  commitInsert,
  readTableStyle,
  readTableRows,
} from '#services/premium_report/tools_document_shared'

export const executeAddTable = async (
  state: PremiumReportState,
  input: Record<string, unknown>
): Promise<string> => {
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
    }
