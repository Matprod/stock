import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'
import { executeAddTable } from '#services/premium_report/tools_document_table_add'
import { executeUpdateBlock } from '#services/premium_report/tools_document_table_update'

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
    execute: async (input) => executeAddTable(state, input),
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
    execute: async (input) => executeUpdateBlock(state, input),
  },
]
