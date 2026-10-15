import { test } from '@japa/runner'
import { REPORT_SQL_DB_TOOL_DESCRIPTION } from '#constants/agent.constants'
import {
  PREMIUM_DOMAIN,
  allPremiumMacroDomains,
} from '#constants/premium_report_domains'
import { createDbTool } from '#services/agent_db_tool'
import {
  resolveActiveTools,
  resolvePremiumToolChoice,
  stampLastMessageCache,
  toolsWithCache,
} from '#services/premium_report/premium_report_agent'
import { emptyPremiumDocument } from '#services/premium_report/premium_report_document'
import { createPremiumMacroTools } from '#services/premium_report/tools_macros'
import type { PremiumReportState } from '#services/premium_report/premium_report_tools'
import type { Message } from '#utils/agent/agent_logger'
import { PREMIUM_CANVAS_ASK } from '#constants/premium_report.constants'
import { defaultPremiumIntent } from '#constants/premium_report_intent'

const stubState = (blockSql = false): PremiumReportState => ({
  document: emptyPremiumDocument({ from: '2026-03-01', to: '2026-03-07' }, []),
  datasets: new Map(),
  defaultAfter: 'end',
  dateRange: { from: '2026-03-01', to: '2026-03-07' },
  clubId: 'club-test',
  athleteIds: [],
  language: 'en',
  sqlFailures: new Map(),
  blockSql,
  toolHistory: [],
  harvestTried: [],
  jevValidations: 0,
  jevBlocked: 0,
  requestPrompt: '',
  mustUseTools: false,
  explanationAsk: false,
  canvasAsk: { kind: PREMIUM_CANVAS_ASK.NEW_VIZ, provider: 'skip' },
  intent: defaultPremiumIntent(),
  templateMetaCache: new Map(),
})

test.group('R7.6 §2 prompt cache', () => {
  test('reportSql query_database description is short and immutable after execute', async ({
    assert,
  }) => {
    const tool = await createDbTool('any ask', undefined, undefined, { reportSql: true })
    const before = tool.schema.description
    assert.equal(before, REPORT_SQL_DB_TOOL_DESCRIPTION)
    assert.isBelow(before.length, 220)
    assert.notInclude(before.toLowerCase(), 'database schema')
    assert.notInclude(before.toLowerCase(), 'club period metrics')
    assert.notInclude(before, 'CREATE TABLE')

    await tool.execute({ sql: 'NOT_A_SELECT' })
    assert.equal(tool.schema.description, before)
    assert.equal(tool.schema.description, REPORT_SQL_DB_TOOL_DESCRIPTION)
  })

  test('stampLastMessageCache moves ephemeral breakpoint to last message only', ({ assert }) => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'first', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'mid' },
        ],
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'reply' }],
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'follow' },
          { type: 'tool_result', tool_use_id: '1', content: 'ok' },
        ],
      },
    ]
    stampLastMessageCache(messages)
    const first = messages[0].content as Array<Record<string, unknown>>
    const last = messages[2].content as Array<Record<string, unknown>>
    assert.isUndefined(first[0].cache_control)
    assert.isUndefined(first[1].cache_control)
    assert.isUndefined((messages[1].content as Array<Record<string, unknown>>)[0].cache_control)
    assert.isUndefined(last[0].cache_control)
    assert.deepEqual(last[1].cache_control, { type: 'ephemeral' })
  })

  test('toolsWithCache + resolveActiveTools keep tools at force-answer (tool_choice none)', ({
    assert,
  }) => {
    const tools = [
      {
        schema: { name: 'query_database', description: 'sql', input_schema: { type: 'object' } },
        execute: async () => '{}',
      },
      {
        schema: { name: 'fetch_daily_scores', description: 'scores', input_schema: { type: 'object' } },
        execute: async () => '{}',
      },
    ]
    const active = resolveActiveTools(tools, stubState(false))
    assert.lengthOf(active, 2)
    const schemas = toolsWithCache(active.map((t) => t.schema))
    assert.lengthOf(schemas, 2)
    assert.isUndefined(schemas[0].cache_control)
    assert.deepEqual(schemas[1].cache_control, { type: 'ephemeral' })
    assert.deepEqual(resolvePremiumToolChoice({ toolsEnabled: false, forceToolUse: false }), {
      type: 'none',
    })
    assert.deepEqual(resolvePremiumToolChoice({ toolsEnabled: true, forceToolUse: true }), {
      type: 'any',
    })
    assert.isUndefined(resolvePremiumToolChoice({ toolsEnabled: true, forceToolUse: false }))

    const blocked = resolveActiveTools(tools, stubState(true))
    assert.lengthOf(blocked, 1)
    assert.equal(blocked[0].schema.name, 'fetch_daily_scores')
  })

  test('createPremiumMacroTools with all domains has stable count ≥ hamburg subset', ({
    assert,
  }) => {
    const runSql = async () => '[]'
    const state = stubState()
    const hamburgSubset = [
      PREMIUM_DOMAIN.LOAD,
      PREMIUM_DOMAIN.GPS,
      PREMIUM_DOMAIN.WELLNESS,
      PREMIUM_DOMAIN.SLEEP,
      PREMIUM_DOMAIN.SCORES,
    ]
    const subsetCount = createPremiumMacroTools({
      state,
      runSql,
      domains: hamburgSubset,
    }).length
    const allCount = createPremiumMacroTools({
      state,
      runSql,
      domains: allPremiumMacroDomains(),
    }).length
    assert.isAtLeast(allCount, subsetCount)
    assert.isAbove(allCount, subsetCount)
    assert.deepEqual(allPremiumMacroDomains(), [
      PREMIUM_DOMAIN.LOAD,
      PREMIUM_DOMAIN.GPS,
      PREMIUM_DOMAIN.MATCH,
      PREMIUM_DOMAIN.WELLNESS,
      PREMIUM_DOMAIN.SLEEP,
      PREMIUM_DOMAIN.VALD,
      PREMIUM_DOMAIN.BIOMARKERS,
      PREMIUM_DOMAIN.BODY,
      PREMIUM_DOMAIN.SCORES,
      PREMIUM_DOMAIN.INJURY,
    ])
  })
})
