import vine from '@vinejs/vine'

export const STAFF_COMPONENT_NAMES = [
  'Masthead',
  'KeyFigures',
  'Findings',
  'WatchCard',
  'LineChart',
  'Heatmap',
  'BarPanels',
  'DataTable',
  'Callout',
  'CoverageTable',
  'NotProducedBlock',
  'ReferenceBlock',
] as const

export type StaffComponentName = (typeof STAFF_COMPONENT_NAMES)[number]

export type StaffReportBlock = {
  component: StaffComponentName
  data: Record<string, unknown>
}

export type StaffReportPage = {
  headerLeft?: string
  headerRight?: string
  blocks: StaffReportBlock[]
}

export type StaffReportDocument = {
  clubName?: string
  language?: 'fr' | 'en'
  pages: StaffReportPage[]
}

export type StaffSchemaRefusal = {
  ok: false
  code:
    | 'invalid_json'
    | 'missing_pages'
    | 'empty_pages'
    | 'unknown_component'
    | 'invalid_block'
    | 'vine_error'
  reason: string
  detail?: unknown
}

export type StaffSchemaAccept = {
  ok: true
  document: StaffReportDocument
}

const blockSchema = vine.object({
  component: vine.enum(STAFF_COMPONENT_NAMES),
  data: vine.record(vine.any()),
})

const pageSchema = vine.object({
  headerLeft: vine.string().trim().optional(),
  headerRight: vine.string().trim().optional(),
  blocks: vine.array(blockSchema.clone()).minLength(0).maxLength(40),
})

export const staffReportDocumentVine = vine.compile(
  vine.object({
    clubName: vine.string().trim().optional(),
    language: vine.enum(['fr', 'en'] as const).optional(),
    pages: vine.array(pageSchema.clone()).minLength(1).maxLength(40),
  })
)

export const staffReportToolInputSchema = {
  type: 'object',
  properties: {
    document: {
      type: 'object',
      description:
        'Staff report schema: pages of typed component blocks. No free HTML. Numbers via {{fait:id}} tokens only.',
      properties: {
        clubName: { type: 'string' },
        language: { type: 'string', enum: ['fr', 'en'] },
        pages: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              headerLeft: { type: 'string' },
              headerRight: { type: 'string' },
              blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    component: { type: 'string', enum: [...STAFF_COMPONENT_NAMES] },
                    data: { type: 'object' },
                  },
                  required: ['component', 'data'],
                },
              },
            },
            required: ['blocks'],
          },
        },
      },
      required: ['pages'],
    },
  },
  required: ['document'],
} as const

export const parseStaffReportDocument = async (
  raw: unknown
): Promise<StaffSchemaAccept | StaffSchemaRefusal> => {
  if (raw === null || raw === undefined) {
    return { ok: false, code: 'missing_pages', reason: 'document is required' }
  }
  try {
    const document = (await staffReportDocumentVine.validate(raw)) as StaffReportDocument
    if (!document.pages.length) {
      return { ok: false, code: 'empty_pages', reason: 'pages must not be empty' }
    }
    for (const [pageIndex, page] of document.pages.entries()) {
      for (const [blockIndex, block] of page.blocks.entries()) {
        if (!(STAFF_COMPONENT_NAMES as readonly string[]).includes(block.component)) {
          return {
            ok: false,
            code: 'unknown_component',
            reason: `page ${pageIndex + 1} block ${blockIndex + 1}: unknown component`,
            detail: block.component,
          }
        }
        if (!block.data || typeof block.data !== 'object' || Array.isArray(block.data)) {
          return {
            ok: false,
            code: 'invalid_block',
            reason: `page ${pageIndex + 1} block ${blockIndex + 1}: data must be an object`,
          }
        }
      }
    }
    return { ok: true, document }
  } catch (error) {
    return {
      ok: false,
      code: 'vine_error',
      reason: 'staff report schema validation failed',
      detail: error instanceof Error ? error.message : error,
    }
  }
}
