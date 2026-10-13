const CANVAS_TOOLS = new Set([
  'add_chart',
  'add_table',
  'add_heading',
  'add_text',
  'update_block',
  'charts_to_team',
  'filter_block',
  'filter_dataset',
  'transform_columns',
  'transform_values',
  'join_datasets',
  'drop_empty_columns',
  'remove_block',
  'fill_daily_zeros',
  'apply_formula',
  'aggregate_dataset',
])

const fingerprint = (entry: { name: string; input: Record<string, unknown> }): string => {
  const input = entry.input ?? {}
  const parts = [
    entry.name,
    String(input.datasetId ?? ''),
    String(input.title ?? ''),
    String(input.chartType ?? ''),
    Array.isArray(input.athletes) ? input.athletes.join('|') : '',
    String(input.sql ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180),
  ]
  return parts.join('::')
}

export const detectToolLoop = (args: {
  toolHistory: Array<{ name: string; input: Record<string, unknown> }>
}): { isStuck: boolean } => {
  const recent = args.toolHistory.slice(-8)

  const sqlQueries: string[] = []
  for (const e of recent) {
    if (e.name === 'query_database') {
      sqlQueries.push(
        String(e.input.sql || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
      )
    }
  }
  if (sqlQueries.length >= 4 && recent.slice(-4).every((e) => e.name === 'query_database')) {
    return { isStuck: true }
  }

  if (args.toolHistory.length < 6) return { isStuck: false }

  if (sqlQueries.length >= 3) {
    const last = sqlQueries.slice(-3)
    if (last.every((sql) => sql === last[0] && sql.length > 50)) {
      return { isStuck: true }
    }
  }

  const last4 = recent.slice(-4)
  if (last4.length === 4) {
    const prints = last4.map(fingerprint)
    if (prints.every((p) => p === prints[0] && p.length > 8)) {
      return { isStuck: true }
    }
    const [a, b, c, d] = last4
    const [fa, fb, fc, fd] = prints
    if (
      a.name === c.name &&
      b.name === d.name &&
      a.name !== b.name &&
      !CANVAS_TOOLS.has(a.name) &&
      !CANVAS_TOOLS.has(b.name) &&
      fa === fc &&
      fb === fd
    ) {
      return { isStuck: true }
    }
  }

  return { isStuck: false }
}
