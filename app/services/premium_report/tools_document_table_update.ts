import { PREMIUM_BLOCK_TYPE } from '#constants/premium_report.constants'
import { stripMarkdownDecorations } from '#services/premium_report/premium_report_document'
import { readString, readStringList } from '#services/premium_report/dataset_ops'
import { logPremiumJev } from '#services/premium_report/premium_report_log'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'

import {
  softMutateReject,
  blockNotFoundError,
  isShortTextPatch,
  gateTextCaption,
  patchChartOrBlock,
  patchTables,
  readTableReshape,
  readTableStyle,
} from '#services/premium_report/tools_document_shared'

export const executeUpdateBlock = async (
  state: PremiumReportState,
  input: Record<string, unknown>
): Promise<string> => {
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
    }
