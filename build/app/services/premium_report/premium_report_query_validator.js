const CANVAS_TOOLS = new Set([
    'add_chart',
    'add_table',
    'add_heading',
    'add_text',
    'update_block',
    'filter_dataset',
    'transform_columns',
    'join_datasets',
    'drop_empty_columns',
    'remove_block',
    'fill_daily_zeros',
    'apply_formula',
]);
const VIZ_RETRY_TOOLS = new Set([
    'add_chart',
    'add_table',
    'filter_dataset',
    'remove_block',
    'fill_daily_zeros',
    'apply_formula',
]);
export const detectToolLoop = (args) => {
    if (args.toolHistory.length < 6)
        return { isStuck: false, suggestion: '' };
    const recent = args.toolHistory.slice(-8);
    const sqlQueries = [];
    for (const e of recent) {
        if (e.name === 'query_database') {
            sqlQueries.push(String(e.input.sql || '').toLowerCase().replace(/\s+/g, ' ').trim());
        }
    }
    if (sqlQueries.length >= 3) {
        const last = sqlQueries.slice(-3);
        if (last.every((sql) => sql === last[0] && sql.length > 50)) {
            return {
                isStuck: true,
                suggestion: 'Same SQL query repeated 3 times—use existing datasets or stop.',
            };
        }
    }
    const vizSpam = recent.filter((e) => VIZ_RETRY_TOOLS.has(e.name));
    if (vizSpam.length >= 6) {
        const adds = vizSpam.filter((e) => e.name === 'add_chart' || e.name === 'add_table').length;
        if (adds >= 3) {
            return {
                isStuck: true,
                suggestion: 'Viz retry loop. Ship current canvas with existing blocks/datasetIds — stop filter/add/remove cycles.',
            };
        }
    }
    const len = recent.length;
    if (len >= 4) {
        const a = recent[len - 4].name;
        const b = recent[len - 3].name;
        const c = recent[len - 2].name;
        const d = recent[len - 1].name;
        if (a === c && b === d && a !== b && !CANVAS_TOOLS.has(a) && !CANVAS_TOOLS.has(b)) {
            return {
                isStuck: true,
                suggestion: `Circular SQL pattern ${a}→${b}→${a}→${b}. Use existing datasets instead of re-fetching.`,
            };
        }
    }
    return { isStuck: false, suggestion: '' };
};
//# sourceMappingURL=premium_report_query_validator.js.map