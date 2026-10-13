import { PREMIUM_BLOCK_TYPE, isValueTransformOp } from '#constants/premium_report.constants'
import { applyValueTransform } from '#services/premium_report/premium_report_document'
import { readString, readStringList, FILTER_OPS } from '#services/premium_report/dataset_ops'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

import {
  coachAskedEveryPlayerLines,
  isSplitAthleteChunkTitle,
  softMutateReject,
  blockNotFoundError,
  filterChartBlock,
  filterTableBlock,
} from '#services/premium_report/tools_document_shared'

export const createMutateDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'filter_block',
      description:
        'Filter ONE existing chart/table by exact id. Charts: keepSeries (name contains, e.g. "Dupont") or keepSeriesIndexes. Tables: column+op+value on embedded rows (joueur contains). Idempotent if already filtered.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Exact block.id from current canvas' },
          keepSeries: { type: 'array', items: { type: 'string' } },
          keepSeriesIndexes: { type: 'array', items: { type: 'integer' } },
          column: { type: 'string' },
          op: { type: 'string', enum: [...FILTER_OPS] },
          value: {},
        },
        required: ['id'],
      },
    },
    execute: async (input) => {
      const id = readString(input.id)
      if (!id) {
        return JSON.stringify({
          error: 'id required — filter_block must target an exact block.id from current',
          skipped: true,
        })
      }
      const locked = softMutateReject(state, id)
      if (locked) return locked
      const index = state.document.blocks.findIndex((block) => block.id === id)
      const current = state.document.blocks[index]
      if (!current) return blockNotFoundError(state, id)
      if (current.type === PREMIUM_BLOCK_TYPE.CHART) {
        const filtered = filterChartBlock(current, input)
        if (typeof filtered === 'string') return filtered
        state.document.blocks[index] = filtered.block
        return JSON.stringify({
          ok: true,
          id,
          unchanged: filtered.unchanged,
          seriesKept: filtered.seriesKept,
        })
      }
      if (current.type === PREMIUM_BLOCK_TYPE.TABLE) {
        const filtered = filterTableBlock(current, input)
        if (typeof filtered === 'string') return filtered
        state.document.blocks[index] = filtered.block
        return JSON.stringify({
          ok: true,
          id,
          unchanged: filtered.unchanged,
          rowCount: filtered.block.rows.length,
        })
      }
      return JSON.stringify({ error: 'filter_block only supports chart or table' })
    },
  },
  {
    schema: {
      name: 'transform_values',
      description:
        'Numeric transform on ONE chart/table by exact id. op: round|floor|ceil|multiply|divide|add|subtract. round: omit value → integer; value=N → N decimals. m→km: multiply 0.001 on distance columns.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Exact block.id from current canvas' },
          columns: { type: 'array', items: { type: 'string' } },
          op: {
            type: 'string',
            enum: ['round', 'floor', 'ceil', 'multiply', 'divide', 'add', 'subtract'],
          },
          value: { type: 'number' },
        },
        required: ['id', 'op'],
      },
    },
    execute: async (input) => {
      const opRaw = readString(input.op)
      if (!opRaw || !isValueTransformOp(opRaw)) {
        return JSON.stringify({ error: 'op must be round|floor|ceil|multiply|divide|add|subtract' })
      }
      const value = typeof input.value === 'number' ? input.value : Number(input.value)
      const needsValue =
        opRaw === 'multiply' || opRaw === 'divide' || opRaw === 'add' || opRaw === 'subtract'
      if (needsValue && !Number.isFinite(value)) {
        return JSON.stringify({ error: 'value is required for this op' })
      }
      if (opRaw === 'round' && input.value != null && !Number.isFinite(value)) {
        return JSON.stringify({ error: 'value must be a number of decimals for round' })
      }
      if (opRaw === 'divide' && value === 0) return JSON.stringify({ error: 'cannot divide by 0' })
      const columns = readStringList(input.columns)
      const id = readString(input.id)
      if (!id) {
        return JSON.stringify({
          error: 'id required — transform_values must target an exact block.id from current',
          skipped: true,
        })
      }
      const locked = softMutateReject(state, id)
      if (locked) return locked
      const index = state.document.blocks.findIndex((block) => block.id === id)
      const block = state.document.blocks[index]
      if (!block) return blockNotFoundError(state, id)
      if (block.type !== PREMIUM_BLOCK_TYPE.CHART && block.type !== PREMIUM_BLOCK_TYPE.TABLE) {
        return JSON.stringify({ error: 'transform_values only supports chart or table', id })
      }
      const result = applyValueTransform(block, {
        columns: columns.length ? columns : undefined,
        op: opRaw,
        value: Number.isFinite(value) ? value : undefined,
      })
      if (typeof result === 'string') return result
      state.document.blocks[index] = result.block
      if (result.cells === 0) {
        return JSON.stringify({
          error: 'no matching columns',
          hint: 'For m→km omit columns (auto-detect Distance total (m) / distance_m) or pass the display header',
        })
      }
      return JSON.stringify({ ok: true, cells: result.cells, blocks: [id] })
    },
  },
  {
    schema: {
      name: 'remove_block',
      description: 'Remove a block by id.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
    execute: async (input) => {
      const id = readString(input.id)
      if (!id) return JSON.stringify({ error: 'id required' })
      const locked = softMutateReject(state, id)
      if (locked) return locked
      const target = state.document.blocks.find((block) => block.id === id)
      if (!target) return blockNotFoundError(state, id)
      if (
        !state.softPreserveCanvas &&
        target.type === PREMIUM_BLOCK_TYPE.CHART &&
        isSplitAthleteChunkTitle(String(target.title ?? '')) &&
        coachAskedEveryPlayerLines(state)
      ) {
        return JSON.stringify({
          error:
            'Coach asked individual athlete lines — keep chunked player charts. Use aggregate mean±minmax or charts_to_team overlay for squad band; do not remove individual chunks.',
          skipped: true,
        })
      }
      state.document.blocks = state.document.blocks.filter((block) => block.id !== id)
      return JSON.stringify({ ok: true, id })
    },
  }
]
