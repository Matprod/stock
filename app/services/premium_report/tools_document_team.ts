import type { PremiumReportState, PremiumTool } from '#services/premium_report/premium_report_tools'

import {
  applyChartsToTeam,
} from '#services/premium_report/tools_document_shared'

export const createTeamDocumentTools = (state: PremiumReportState): PremiumTool[] => [
  {
    schema: {
      name: 'charts_to_team',
      description:
        'Add a team mean/sum line on evolution charts, keeping player series. mode=replace only when the coach wants the chart to become team-only (drop players). Never plot n. REQUIRED: id or ids[] of exact chart block(s) from current canvas — never all charts.',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Exact chart block.id from current' },
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exact chart block ids from current (use instead of id for several)',
          },
          mode: {
            type: 'string',
            enum: ['overlay', 'replace'],
            description:
              'overlay = keep players and add one team line (default). replace = drop players.',
          },
          op: { type: 'string', enum: ['mean', 'sum'], description: 'Default mean' },
          seriesLabel: { type: 'string', description: 'Legend label (default Équipe moy.)' },
        },
        required: [],
      },
    },
    execute: async (input) => {
      const result = await applyChartsToTeam(state, input)
      return JSON.stringify(result)
    },
  }
]
