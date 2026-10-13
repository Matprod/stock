import { SQL_PARTITION_TARGET_CHARS, SQL_PARTITION_TARGET_ROWS, } from '#constants/agent.constants';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const createTeamPartitionState = () => ({
    datesQueried: new Set(),
    slices: [],
});
export const extractIsoDatesFromSql = (sql) => {
    const dates = new Set();
    const re = /'(\d{4}-\d{2}-\d{2})'/g;
    let m;
    while ((m = re.exec(sql)) !== null)
        dates.add(m[1]);
    return [...dates].sort();
};
export const isAggregatedSql = (sql) => /\bGROUP\s+BY\b/i.test(sql) || /\bCOUNT\s*\(\s*(?:\*|DISTINCT)/i.test(sql);
export const compactTeamRows = (rows) => rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row))
        return {};
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && UUID_RE.test(value))
            continue;
        if (typeof value === 'string' && value.length > 80) {
            out[key] = `${value.slice(0, 80)}…`;
            continue;
        }
        out[key] = value;
    }
    return out;
});
export const buildTeamPartitionHint = (args) => {
    const datesCovered = args.state ? [...args.state.datesQueried].sort() : [];
    return JSON.stringify({
        partition_hint: args.reason,
        row_count: args.rowCount,
        target_rows: SQL_PARTITION_TARGET_ROWS,
        target_chars: SQL_PARTITION_TARGET_CHARS,
        result_chars: args.resultChars,
        hint: args.hint,
        dates_covered_so_far: datesCovered,
    });
};
export const buildTeamPartitionMeta = (state, sliceDates, rowCount, resultChars) => {
    const avgChars = state.slices.length > 0
        ? Math.round(state.slices.reduce((s, x) => x.resultChars + s, 0) / state.slices.length)
        : resultChars;
    return {
        dates_this_slice: sliceDates,
        dates_covered_so_far: [...state.datesQueried].sort(),
        slice_rows: rowCount,
        slice_chars: resultChars,
        target_rows: SQL_PARTITION_TARGET_ROWS,
        target_chars: SQL_PARTITION_TARGET_CHARS,
        avg_slice_chars: avgChars,
    };
};
//# sourceMappingURL=agent_partition.js.map