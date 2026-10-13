import { getSimilarSql } from '#services/vanna_client'
import type { AgentContext, AgentTool, TeamPartitionState } from '#contracts/agent'
import {
  DB_TOOL_FULL_DESCRIPTION_PREFIX,
  DB_TOOL_SERIES_DESCRIPTION_PREFIX,
  DB_TOOL_TEAM_PARTITION_FORMAT,
  MAX_RESULT_BYTES,
  MAX_RESULT_ROWS,
  SQL_PARTITION_AGGREGATED_MAX_CHARS,
  SQL_PARTITION_AGGREGATED_MAX_ROWS,
  SQL_PARTITION_TARGET_CHARS,
  SQL_PARTITION_TARGET_ROWS,
} from '#constants/agent.constants'
import { isSeriesChartQuestion, isSeriesMetadataQuery } from '#utils/agent/agent_series'
import { compactSeriesMetadataResult } from '#services/agent_series_service'
import { filterSchema } from '#utils/agent/agent_schema'
import {
  buildClubMetricsPromptBlocks,
  getUnusedHealthMetricNames,
  isSubjectiveDataQuestion,
} from '#utils/agent/agent_catalogue'
import {
  diagnoseOversizedResult,
  anchorDates,
  ensureMetricUnitInSql,
  executeSqlSelectRows,
  stripLeadingSqlNoise,
  suggestMetricMacro,
  validateReportSql,
  validateSql,
} from '#utils/agent/agent_sql'
import {
  buildTeamPartitionHint,
  buildTeamPartitionMeta,
  compactTeamRows,
  extractIsoDatesFromSql,
  isAggregatedSql,
  roundSqlRowValues,
} from '#utils/agent/agent_partition'

const buildDbToolDescription = (args: {
  seriesOnly: boolean
  schema: string
  clubMetricsBlock: string
  sqlExamples: string
  isTeam: boolean
}): string => {
  const { seriesOnly, schema, clubMetricsBlock, sqlExamples, isTeam } = args
  if (seriesOnly) return `${DB_TOOL_SERIES_DESCRIPTION_PREFIX}${schema}`
  return `${DB_TOOL_FULL_DESCRIPTION_PREFIX}${schema}${clubMetricsBlock}${sqlExamples}${
    isTeam ? DB_TOOL_TEAM_PARTITION_FORMAT : ''
  }`
}

const formatTeamResult = (args: {
  safeSql: string
  resultJson: string
  sqlDates: string[]
  seriesOnly: boolean
  teamPartitionState: TeamPartitionState
}): string => {
  const { safeSql, resultJson, sqlDates, seriesOnly, teamPartitionState } = args
  const overlapWithPrior = sqlDates.filter((d) => teamPartitionState.datesQueried.has(d))
  const parsed = JSON.parse(resultJson) as unknown[]
  if (!Array.isArray(parsed)) return resultJson

  const wrap = (rows: unknown[], chars: number): string => {
    if (rows.length > 0) for (const d of sqlDates) teamPartitionState.datesQueried.add(d)
    teamPartitionState.slices.push({
      dates: sqlDates,
      rowCount: rows.length,
      resultChars: chars,
    })
    return JSON.stringify({
      rows,
      partition_meta: {
        ...buildTeamPartitionMeta(teamPartitionState, sqlDates, rows.length, chars),
        ...(overlapWithPrior.length > 0
          ? { overlap_warning: `Date overlap on ${overlapWithPrior.join(', ')}.` }
          : {}),
      },
    })
  }

  if (seriesOnly) {
    if (parsed.length > 0) for (const d of sqlDates) teamPartitionState.datesQueried.add(d)
    teamPartitionState.slices.push({
      dates: sqlDates,
      rowCount: parsed.length,
      resultChars: resultJson.length,
    })
    return isSeriesMetadataQuery(safeSql)
      ? compactSeriesMetadataResult(parsed, safeSql)
      : resultJson
  }

  const aggregatedFits =
    isAggregatedSql(safeSql) &&
    parsed.length <= SQL_PARTITION_AGGREGATED_MAX_ROWS &&
    resultJson.length <= SQL_PARTITION_AGGREGATED_MAX_CHARS
  if (aggregatedFits) return wrap(parsed, resultJson.length)

  const overRows = parsed.length > SQL_PARTITION_TARGET_ROWS
  const overChars = resultJson.length > SQL_PARTITION_TARGET_CHARS
  if (!overRows && !overChars) return wrap(parsed, resultJson.length)

  const compacted = compactTeamRows(parsed)
  const compactedJson = JSON.stringify(compacted)
  if (
    compacted.length <= SQL_PARTITION_TARGET_ROWS &&
    compactedJson.length <= SQL_PARTITION_TARGET_CHARS
  ) {
    return wrap(compacted, compactedJson.length)
  }

  return buildTeamPartitionHint({
    reason: overChars && !overRows ? 'REDUCE_PAYLOAD' : 'REDUCE_SCOPE',
    hint: `Result too large (${parsed.length} rows / ${resultJson.length} chars). Rows were NOT returned. Rewrite SQL: GROUP BY one row per entity, or COUNT/FILTER on a smaller date range. Do not invent names, dates, scores, or counts.`,
    state: teamPartitionState,
    rowCount: parsed.length,
    resultChars: resultJson.length,
  })
}

const buildSubjectiveDataNotice = async (args: {
  question: string
  context?: AgentContext
  safeSql: string
  noticeState: { count: number }
}): Promise<string> => {
  const { question, context, safeSql, noticeState } = args
  if (noticeState.count >= 1 || !isSubjectiveDataQuestion(question)) return ''

  const names = await getUnusedHealthMetricNames(context, safeSql)
  if (!names.length) return ''

  noticeState.count += 1
  return `\n\nNOTICE: this club also has ${names.length} additional self-reported/subjective metric(s) not queried yet — ${names.join(', ')} (in health_metric_values, join via health_metrics.name). Since the question asks broadly about subjective data, consider a follow-up query_database call for these before finalizing your answer.`
}

const runDbToolExecute = async (
  input: Record<string, string>,
  args: {
    question: string
    context?: AgentContext
    onSuccessfulQuery?: (sql: string) => void
    teamPartitionState?: TeamPartitionState
    seriesOnly: boolean
    noticeState: { count: number }
    maxResultRows: number
    maxResultBytes: number
    skipTeamPartition: boolean
    reportSql: boolean
  }
): Promise<string> => {
  const {
    question,
    context,
    onSuccessfulQuery,
    teamPartitionState,
    seriesOnly,
    noticeState,
    maxResultRows,
    maxResultBytes,
    skipTeamPartition,
    reportSql,
  } = args
  const sql = (input.sql ?? '').trim()
  const forKindCheck = reportSql ? stripLeadingSqlNoise(sql).toUpperCase() : sql.toUpperCase()
  const isDescribe = forKindCheck.startsWith('DESCRIBE') || forKindCheck.startsWith('DESC ')
  const isSelect = reportSql
    ? /^(SELECT|WITH)\b/.test(forKindCheck)
    : forKindCheck.startsWith('SELECT')
  if (!isSelect && !isDescribe) {
    return JSON.stringify({
      error: reportSql
        ? 'Only SELECT / WITH … SELECT and DESCRIBE are permitted. Do not start with comments-only; WITH CTEs are allowed.'
        : 'Only SELECT and DESCRIBE statements are permitted',
    })
  }

  const anchored = context && !isDescribe ? anchorDates(sql, context.referenceDate) : sql
  const safeSql = reportSql && context && !isDescribe ? ensureMetricUnitInSql(anchored) : anchored
  if (seriesOnly && /\bdata_encoded\b/i.test(safeSql)) {
    return JSON.stringify({
      error: 'Blocked: never SELECT data_encoded. SELECT s.id, s.type, last_name only.',
    })
  }
  if (context && !isDescribe) {
    const violation = reportSql
      ? validateReportSql(safeSql, context)
      : validateSql(safeSql, context)
    if (violation) {
      if (!reportSql) return JSON.stringify({ error: violation })
      const macro = suggestMetricMacro(safeSql)
      return JSON.stringify({
        error: violation,
        ...(macro ? { suggestedMacro: macro } : {}),
      })
    }
  }

  const usePartition = Boolean(teamPartitionState) && !skipTeamPartition
  const sqlDates =
    context?.mode === 'team' && usePartition && !isDescribe ? extractIsoDatesFromSql(safeSql) : []

  try {
    const rawRows = await executeSqlSelectRows(safeSql)
    if (rawRows.length > maxResultRows) {
      return JSON.stringify(diagnoseOversizedResult(safeSql, rawRows, JSON.stringify(rawRows).length))
    }
    const rows = roundSqlRowValues(rawRows)
    const resultJson = JSON.stringify(rows)

    if (resultJson.length > maxResultBytes) {
      return JSON.stringify(diagnoseOversizedResult(safeSql, rows, resultJson.length))
    }

    if (rows.length > 0 && onSuccessfulQuery) onSuccessfulQuery(safeSql)

    let output: string
    if (usePartition && teamPartitionState) {
      output = formatTeamResult({
        safeSql,
        resultJson,
        sqlDates,
        seriesOnly,
        teamPartitionState,
      })
    } else if (seriesOnly) {
      const parsed = JSON.parse(resultJson) as unknown
      output =
        Array.isArray(parsed) && isSeriesMetadataQuery(safeSql)
          ? compactSeriesMetadataResult(parsed, safeSql)
          : resultJson
    } else {
      output = resultJson
    }

    if (!seriesOnly && rows.length > 0 && !isDescribe) {
      output += await buildSubjectiveDataNotice({ question, context, safeSql, noticeState })
    }

    return output
  } catch (err: unknown) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
  }
}

export const createDbTool = async (
  question: string = '',
  context?: AgentContext,
  onSuccessfulQuery?: (sql: string) => void,
  options?: {
    useVannaExamples?: boolean
    vannaRetrievalQuestion?: string
    teamPartitionState?: TeamPartitionState
    seriesOnly?: boolean
    maxResultRows?: number
    maxResultBytes?: number
    skipTeamPartition?: boolean
    forceDomainTitles?: string[]
    reportSql?: boolean
  }
): Promise<AgentTool> => {
  const teamPartitionState = options?.teamPartitionState
  const retrievalQuestion = options?.vannaRetrievalQuestion ?? question
  const seriesOnly = options?.seriesOnly ?? isSeriesChartQuestion(question)
  const maxResultRows = options?.maxResultRows ?? MAX_RESULT_ROWS
  const maxResultBytes = options?.maxResultBytes ?? MAX_RESULT_BYTES
  const skipTeamPartition = options?.skipTeamPartition === true
  const reportSql = options?.reportSql === true
  const schema = filterSchema(question, {
    seriesOnly,
    forceDomainTitles: options?.forceDomainTitles,
  })
  const [sqlExamples, clubMetrics] = await Promise.all([
    seriesOnly || options?.useVannaExamples === false
      ? Promise.resolve('')
      : getSimilarSql(retrievalQuestion),
    seriesOnly
      ? Promise.resolve({ block: '', stub: '' })
      : buildClubMetricsPromptBlocks(context, undefined, { reportSql }),
  ])
  const { block: clubMetricsBlock, stub: clubMetricsStub } = clubMetrics

  const description = buildDbToolDescription({
    seriesOnly,
    schema,
    clubMetricsBlock,
    sqlExamples,
    isTeam: context?.mode === 'team' && !skipTeamPartition,
  })

  const schemaObj = {
    name: 'query_database',
    description,
    input_schema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'A valid SQL SELECT statement' },
      },
      required: ['sql'],
    },
  }

  const fullDescription = description
  const slimDescription = clubMetricsBlock
    ? description.replace(clubMetricsBlock, clubMetricsStub)
    : description
  let slimmed = !clubMetricsBlock
  Object.defineProperty(schemaObj, 'description', {
    enumerable: true,
    get: () => (slimmed ? slimDescription : fullDescription),
  })

  const noticeState = { count: 0 }

  return {
    schema: schemaObj,
    execute: async (input) => {
      const result = await runDbToolExecute(input, {
        question,
        context,
        onSuccessfulQuery,
        teamPartitionState,
        seriesOnly,
        noticeState,
        maxResultRows,
        maxResultBytes,
        skipTeamPartition,
        reportSql,
      })
      if (!slimmed && clubMetricsBlock) slimmed = true
      return result
    },
  }
}
