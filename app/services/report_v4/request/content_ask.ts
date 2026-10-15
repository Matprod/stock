import { foldAscii } from '#utils/html_text'

export type ContentFloors = {
  minCharts: number
  minTables: number
  minCombined: number
  mode: 'none' | 'default' | 'explicit'
}

const CONTENT_ASK_ALIASES = {
  table: ['table', 'tables', 'tableau', 'tableaux'],
  chart: ['chart', 'charts', 'graph', 'graphs', 'plot', 'plots', 'graphique', 'graphiques'],
} as const

const TABLE_ONLY_RE =
  /table\s+only|tables\s+only|only\s+(?:a\s+|one\s+)?tables?|tableau\s+uniquement|uniquement\s+(?:un\s+)?tableau/iu
const CHART_ONLY_RE =
  /chart\s+only|charts\s+only|only\s+(?:a\s+|one\s+)?(?:charts?|graphs?|plots?)|graphique\s+uniquement|uniquement\s+(?:un\s+)?graphique/iu

const countBeforeToken = (hay: string, tokens: readonly string[]): number | null => {
  for (const token of tokens) {
    const re = new RegExp(
      String.raw`(?:^|[^\p{L}\p{N}])(\d{1,2})\s+${token}(?:$|[^\p{L}\p{N}])`,
      'iu'
    )
    const match = hay.match(re)
    if (match?.[1]) return Number(match[1])
  }
  return null
}

const soleContentCue = (hay: string, tokens: readonly string[]): boolean => {
  for (const token of tokens) {
    const re = new RegExp(
      String.raw`(?:^|[^\p{L}\p{N}])(?:one|a|single|un|une|seul|seule|juste)\s+${token}(?:$|[^\p{L}\p{N}])`,
      'iu'
    )
    if (re.test(hay)) return true
  }
  return false
}

export const resolveContentFloors = (args: {
  prompt: string
  domainsWithDataCount: number
  preserveCanvas?: boolean
}): ContentFloors => {
  if (args.preserveCanvas) {
    return { minCharts: 0, minTables: 0, minCombined: 0, mode: 'none' }
  }

  const hay = foldAscii(args.prompt).toLowerCase()
  const tableCount = countBeforeToken(hay, CONTENT_ASK_ALIASES.table)
  const chartCount = countBeforeToken(hay, CONTENT_ASK_ALIASES.chart)
  const tableSole = tableCount === null && soleContentCue(hay, CONTENT_ASK_ALIASES.table)
  const chartSole = chartCount === null && soleContentCue(hay, CONTENT_ASK_ALIASES.chart)
  const wantsTables = tableCount !== null || tableSole || TABLE_ONLY_RE.test(hay)
  const wantsCharts = chartCount !== null || chartSole || CHART_ONLY_RE.test(hay)

  if (wantsTables || wantsCharts) {
    const minTables = wantsTables ? (tableCount ?? 1) : 0
    const minCharts = wantsCharts ? (chartCount ?? 1) : 0
    return {
      minCharts,
      minTables,
      minCombined: 0,
      mode: 'explicit',
    }
  }

  const minCombined = Math.max(0, args.domainsWithDataCount)
  if (minCombined === 0) {
    return { minCharts: 0, minTables: 0, minCombined: 0, mode: 'none' }
  }
  return { minCharts: 0, minTables: 0, minCombined, mode: 'default' }
}

export const contentFloorsThin = (floors: ContentFloors, charts: number, tables: number): boolean =>
  charts < floors.minCharts || tables < floors.minTables || charts + tables < floors.minCombined
