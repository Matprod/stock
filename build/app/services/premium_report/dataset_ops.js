import { pickAthleteColumn } from '#constants/premium_report_metrics';
import { PREMIUM_REPORT_MAX_DATASET_ROWS, PREMIUM_REPORT_SAMPLE_ROWS, } from '#constants/premium_report.constants';
const IDENTITY_COLUMNS = new Set([
    'id',
    'athlete_id',
    'unit',
    'joueur',
    'player',
    'position',
    'name',
    'date',
    'date_of_day',
    'activity',
    'activity_type',
    'metric_name',
    'method',
    'x_column',
    'y_column',
    'n',
]);
export const storeDataset = (state, dataset) => {
    const id = `ds_${state.datasets.size + 1}`;
    const stored = {
        ...dataset,
        id,
        ...(dataset.units && Object.keys(dataset.units).length
            ? { units: { ...dataset.units } }
            : {}),
    };
    state.datasets.set(id, stored);
    return stored;
};
export const datasetToolResult = (dataset, extra) => JSON.stringify({
    ok: true,
    datasetId: dataset.id,
    columns: dataset.columns,
    rowCount: dataset.rows.length,
    sample: dataset.rows.slice(0, PREMIUM_REPORT_SAMPLE_ROWS),
    ...(dataset.units && Object.keys(dataset.units).length ? { units: dataset.units } : {}),
    ...extra,
});
export const commitDataset = (state, dataset, extra) => datasetToolResult(storeDataset(state, dataset), extra);
export const requireDataset = (state, input) => {
    const datasetId = readString(input.datasetId);
    if (!datasetId)
        return JSON.stringify({ error: 'datasetId required' });
    const dataset = state.datasets.get(datasetId);
    if (!dataset)
        return JSON.stringify({ error: `Unknown datasetId ${datasetId}` });
    return dataset;
};
export const defaultGroupBy = (dataset, preferred) => preferred ?? pickAthleteColumn(dataset.columns);
export const readDateRange = (input, fallback) => {
    const requested = {
        from: readString(input.from) ?? fallback.from,
        to: readString(input.to) ?? fallback.to,
    };
    return clampDateRange(requested, fallback);
};
export const clampDateRange = (requested, allowed) => {
    const from = requested.from > allowed.from ? requested.from : allowed.from;
    const to = requested.to < allowed.to ? requested.to : allowed.to;
    if (from <= to)
        return { from, to };
    return { from: allowed.from, to: allowed.to };
};
export const readString = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};
export const readStringList = (value) => Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim().length > 0)
    : [];
export const readPositiveInt = (value, fallback) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 2 ? Math.floor(n) : fallback;
};
export const toNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const compact = value
            .trim()
            .replace(/[\s\u202f\u00a0]/g, '')
            .replace(',', '.');
        if (!/^-?\d+(\.\d+)?$/.test(compact))
            return null;
        const n = Number(compact);
        return Number.isFinite(n) ? n : null;
    }
    return null;
};
export const round3 = (value) => Math.round(value * 1000) / 1000;
const numberFormatters = {
    fr: {
        int: new Intl.NumberFormat('fr'),
        float: new Intl.NumberFormat('fr', { maximumFractionDigits: 2 }),
    },
    en: {
        int: new Intl.NumberFormat('en'),
        float: new Intl.NumberFormat('en', { maximumFractionDigits: 2 }),
    },
};
export const formatDisplayNumber = (value, language = 'fr') => {
    if (!Number.isFinite(value))
        return '';
    const formatters = numberFormatters[language];
    return Number.isInteger(value) ? formatters.int.format(value) : formatters.float.format(value);
};
export const formatDisplayCell = (value, language = 'fr') => {
    if (value === null || value === undefined)
        return null;
    const numeric = toNumber(value);
    if (numeric != null &&
        (typeof value === 'number' ||
            (typeof value === 'string' && /^-?[\d\s\u202f\u00a0.,]+$/.test(value.trim())))) {
        return formatDisplayNumber(numeric, language);
    }
    if (typeof value === 'string' || typeof value === 'number')
        return value;
    return String(value);
};
export const columnStats = (rows, column) => {
    const values = [];
    const unique = new Set();
    for (const row of rows) {
        const n = toNumber(row[column]);
        if (n == null)
            continue;
        values.push(n);
        unique.add(n);
    }
    if (values.length < 2)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return {
        mean: round3(sum / values.length),
        median: round3(median),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        n: values.length,
        uniqueCount: unique.size,
    };
};
export const isOrdinalScore = (rows, column) => {
    const stats = columnStats(rows, column);
    if (!stats)
        return false;
    return stats.uniqueCount <= 6 && stats.n >= stats.uniqueCount * 2;
};
export const compareValues = (left, right) => {
    if (left == null && right == null)
        return 0;
    if (left == null)
        return -1;
    if (right == null)
        return 1;
    if (typeof left === 'number' && typeof right === 'number')
        return left - right;
    return String(left).localeCompare(String(right));
};
export const uniqueColumns = (columns) => [...new Set(columns.filter(Boolean))];
export const partitionRows = (rows, groupBy) => {
    if (!groupBy)
        return [rows];
    const map = new Map();
    for (const row of rows) {
        const key = String(row[groupBy] ?? '');
        const list = map.get(key) ?? [];
        list.push(row);
        map.set(key, list);
    }
    return [...map.values()];
};
export const pickDateColumn = (columns) => columns.find((column) => column === 'date' || column === 'date_of_day') ??
    columns.find((column) => /date/i.test(column));
export const sortDatasetByDate = (dataset) => {
    const dateColumn = pickDateColumn(dataset.columns);
    if (!dateColumn)
        return dataset;
    return {
        ...dataset,
        rows: [...dataset.rows].sort((left, right) => String(left[dateColumn] ?? '').localeCompare(String(right[dateColumn] ?? ''))),
    };
};
export const trimDatasetRows = (dataset, maxRows) => {
    if (maxRows < 1 || dataset.rows.length <= maxRows)
        return { dataset };
    const sorted = sortDatasetByDate(dataset);
    const dateColumn = pickDateColumn(sorted.columns);
    const rows = dateColumn ? sorted.rows.slice(-maxRows) : sorted.rows.slice(0, maxRows);
    return {
        dataset: { ...sorted, rows },
        trimmedFrom: dataset.rows.length,
    };
};
export const densifyDailyDataset = (args) => {
    const { dataset, dateColumn, groupBy, valueColumns, from, to } = args;
    const days = enumerateIsoDays(from, to);
    if (days.length === 0)
        return dataset;
    const outRows = [];
    for (const group of partitionRows(dataset.rows, groupBy)) {
        const byDate = new Map();
        for (const row of group) {
            const key = toIsoDate(row[dateColumn]);
            if (!key)
                continue;
            const prev = byDate.get(key);
            if (!prev) {
                byDate.set(key, { ...row });
                continue;
            }
            const merged = { ...prev };
            for (const col of valueColumns) {
                const a = toNumber(prev[col]);
                const b = toNumber(row[col]);
                merged[col] = a == null ? b : b == null ? a : a + b;
            }
            byDate.set(key, merged);
        }
        const template = group[0] ?? {};
        for (const day of days) {
            const existing = byDate.get(day);
            if (existing) {
                const row = { ...existing, [dateColumn]: day };
                for (const col of valueColumns) {
                    if (toNumber(row[col]) == null)
                        row[col] = 0;
                }
                outRows.push(row);
                continue;
            }
            outRows.push({
                [dateColumn]: day,
                ...(groupBy ? { [groupBy]: template[groupBy] ?? null } : {}),
                ...Object.fromEntries(valueColumns.map((col) => [col, 0])),
            });
        }
    }
    return {
        id: 'tmp',
        columns: uniqueColumns([
            ...(groupBy ? [groupBy] : []),
            dateColumn,
            ...valueColumns,
            ...dataset.columns,
        ]),
        rows: outRows,
        ...(dataset.units ? { units: dataset.units } : {}),
    };
};
export const takeLatestRows = (dataset, groupBy, orderBy, keep) => {
    const groups = partitionRows(dataset.rows, groupBy);
    const rows = groups.map((group) => {
        let last = group[0] ?? {};
        for (let i = 1; i < group.length; i++) {
            const row = group[i];
            if (compareValues(row[orderBy], last[orderBy]) >= 0)
                last = row;
        }
        if (!keep?.length)
            return { ...last };
        const out = { [groupBy]: last[groupBy] };
        for (const col of keep)
            out[col] = last[col] ?? null;
        return out;
    });
    const columns = keep?.length
        ? uniqueColumns([groupBy, ...keep])
        : uniqueColumns([groupBy, ...dataset.columns]);
    return { id: 'tmp', columns, rows, ...(dataset.units ? { units: dataset.units } : {}) };
};
export const rankTopRows = (rows, column, n, dir = 'desc') => {
    const desc = dir !== 'asc';
    return [...rows]
        .sort((a, b) => {
        const av = toNumber(a[column]) ?? -Infinity;
        const bv = toNumber(b[column]) ?? -Infinity;
        return desc ? bv - av : av - bv;
    })
        .slice(0, n);
};
export const filterRows = (dataset, column, op, value) => {
    const rows = dataset.rows.filter((row) => {
        const cell = row[column];
        if (op === 'not_null')
            return cell != null && String(cell).trim() !== '';
        const num = toNumber(cell);
        if (num == null || value == null)
            return false;
        if (op === 'gt')
            return num > value;
        if (op === 'gte')
            return num >= value;
        if (op === 'lt')
            return num < value;
        if (op === 'lte')
            return num <= value;
        if (op === 'eq')
            return num === value;
        if (op === 'ne')
            return num !== value;
        return false;
    });
    return { id: 'tmp', columns: dataset.columns, rows, ...(dataset.units ? { units: dataset.units } : {}) };
};
export const joinOnKeys = (datasets, keys) => {
    if (keys.length === 0)
        return datasets[0] ?? { id: 'tmp', columns: [], rows: [] };
    const map = new Map();
    const columns = new Set(keys);
    const units = {};
    for (const dataset of datasets) {
        for (const col of dataset.columns)
            columns.add(col);
        if (dataset.units)
            Object.assign(units, dataset.units);
        for (const row of dataset.rows) {
            const composite = keys.map((key) => String(row[key] ?? '')).join('\0');
            const prev = map.get(composite) ?? Object.fromEntries(keys.map((key) => [key, row[key] ?? null]));
            map.set(composite, { ...prev, ...row });
        }
    }
    return {
        id: 'tmp',
        columns: [...columns],
        rows: [...map.values()],
        ...(Object.keys(units).length ? { units } : {}),
    };
};
export const assertDatasetRowsCap = (rows) => rows > PREMIUM_REPORT_MAX_DATASET_ROWS
    ? `dataset has ${rows} rows (max ${PREMIUM_REPORT_MAX_DATASET_ROWS})`
    : null;
export const correlateColumns = (rows, xColumn, yColumn, method, minPairs) => {
    const xs = [];
    const ys = [];
    for (const row of rows) {
        const x = toNumber(row[xColumn]);
        const y = toNumber(row[yColumn]);
        if (x == null || y == null)
            continue;
        xs.push(x);
        ys.push(y);
    }
    const n = xs.length;
    if (n < minPairs)
        return { r: null, n };
    const r = method === 'spearman' ? pearson(rankValues(xs), rankValues(ys)) : pearson(xs, ys);
    return { r: r == null ? null : round3(r), n };
};
export const inferNumericColumns = (dataset, skip = []) => {
    const skipSet = new Set(skip.map((column) => column.toLowerCase()));
    return dataset.columns.filter((column) => {
        if (skipSet.has(column.toLowerCase()) || IDENTITY_COLUMNS.has(column.toLowerCase())) {
            return false;
        }
        return dataset.rows.some((row) => {
            const n = toNumber(row[column]);
            return n != null && n !== 0;
        });
    });
};
export const isIdColumnName = (column) => column === 'id' ||
    column === 'athlete_id' ||
    column === 'athleteId' ||
    column.toLowerCase().endsWith('_id');
export const isEmptyMetricColumn = (dataset, column) => {
    if (IDENTITY_COLUMNS.has(column.toLowerCase()))
        return false;
    for (const row of dataset.rows) {
        const raw = row[column];
        const n = toNumber(raw);
        if (n != null) {
            if (n !== 0)
                return false;
            continue;
        }
        if (raw != null && String(raw).trim() !== '' && String(raw).trim() !== '—')
            return false;
    }
    return true;
};
export const pruneEmptyMetricColumns = (dataset) => {
    const dropped = [];
    let columns = dataset.columns.filter((column) => {
        if (!isEmptyMetricColumn(dataset, column))
            return true;
        dropped.push(column);
        return false;
    });
    if (columns.some((column) => column.toLowerCase() === 'unit')) {
        const metricColumns = columns.filter((column) => !IDENTITY_COLUMNS.has(column.toLowerCase()) && column.toLowerCase() !== 'unit');
        if (metricColumns.length > 1) {
            columns = columns.filter((column) => {
                if (column.toLowerCase() !== 'unit')
                    return true;
                dropped.push(column);
                return false;
            });
        }
    }
    if (dropped.length === 0)
        return { dataset, dropped };
    return {
        dataset: {
            id: dataset.id,
            columns,
            rows: dataset.rows.map((row) => {
                const next = {};
                for (const column of columns)
                    next[column] = row[column];
                return next;
            }),
            ...(dataset.units
                ? {
                    units: Object.fromEntries(Object.entries(dataset.units).filter(([column]) => columns.includes(column))),
                }
                : {}),
        },
        dropped,
    };
};
const pearson = (xs, ys) => {
    const n = xs.length;
    if (n < 2 || n !== ys.length)
        return null;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
        sumX += xs[i];
        sumY += ys[i];
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
    }
    if (denX === 0 || denY === 0)
        return null;
    return num / Math.sqrt(denX * denY);
};
const rankValues = (values) => {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < indexed.length) {
        let j = i;
        while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value)
            j++;
        const avgRank = (i + j + 2) / 2;
        for (let k = i; k <= j; k++)
            ranks[indexed[k].index] = avgRank;
        i = j + 1;
    }
    return ranks;
};
const enumerateIsoDays = (from, to) => {
    const start = parseIsoDate(from);
    const end = parseIsoDate(to);
    if (!start || !end || start > end)
        return [];
    const days = [];
    const cursor = new Date(start.getTime());
    while (cursor <= end) {
        days.push(formatIsoDate(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
};
const parseIsoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};
const formatIsoDate = (date) => date.toISOString().slice(0, 10);
const toIsoDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return formatIsoDate(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed))
            return trimmed.slice(0, 10);
    }
    return null;
};
export const looksLikeDateColumn = (column, dataset) => {
    if (/date/i.test(column))
        return true;
    const sample = dataset.rows.slice(0, 5).map((row) => toIsoDate(row[column]));
    return sample.some((value) => value != null);
};
//# sourceMappingURL=dataset_ops.js.map