import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_HEADING_LENGTH, PREMIUM_REPORT_MAX_TEXT_LENGTH } from '#constants/premium_report.constants'
import type { PremiumReportBlock } from '#contracts/premium_report'
import { newBlockId, stripMarkdownDecorations } from '#services/premium_report/premium_report_document'
import { readString } from '#services/premium_report/dataset_ops'
import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

import {
  commitInsert,
  gateTextCaption,
} from '#services/premium_report/tools_document_shared'

export const createTextDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'set_report_meta',
      description:
        'Set report title and/or date range (PDF cover + macro window). When the user asks a longer window (mois / 2 mois), set from/to here before fetch_*.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
    execute: async (input) => {
      const title = readString(input.title)
      if (title) state.document.title = title.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
      const from = readString(input.from)
      const to = readString(input.to)
      if (from && to && from <= to) {
        const next = { from, to }
        state.document.dateRange = next
        state.dateRange = next
      }
      return JSON.stringify({
        ok: true,
        title: state.document.title,
        dateRange: state.document.dateRange,
      })
    },
  },
  {
    schema: {
      name: 'add_heading',
      description: 'Add a section heading. after: start|end|<blockId>.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          level: { type: 'integer', enum: [1, 2] },
          after: { type: 'string' },
        },
        required: ['text'],
      },
    },
    execute: async (input) => {
      const text = stripMarkdownDecorations(readString(input.text) ?? '')
        .slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
        .trim()
      if (!text) return JSON.stringify({ error: 'text required' })
      const level = input.level === 2 ? 2 : 1
      const block: PremiumReportBlock = {
        id: newBlockId(),
        type: PREMIUM_BLOCK_TYPE.HEADING,
        text,
        level,
      }
      return commitInsert(state, block, readString(input.after))
    },
  },
  {
    schema: {
      name: 'add_text',
      description:
        'Add plain-text caption under a viz when it adds staff insight (no markdown). Server may reject filler via Jev. after: start|end|<blockId>.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          after: { type: 'string' },
        },
        required: ['text'],
      },
    },
    execute: async (input) => {
      const text = stripMarkdownDecorations(
        readString(input.text)?.replace(/\r\n/g, '\n') ?? ''
      ).trim()
      if (!text) return JSON.stringify({ error: 'text required' })
      const after = readString(input.after)
      const gated = await gateTextCaption(state, text, after)
      if (gated) return gated
      const block: PremiumReportBlock = {
        id: newBlockId(),
        type: PREMIUM_BLOCK_TYPE.TEXT,
        text: text.slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH),
      }
      return commitInsert(state, block, after)
    },
  }
]
