import { PREMIUM_DOMAIN_CATALOG, } from '#constants/premium_report_domains';
import { elapsedSec } from '#services/premium_report/premium_report_log';
import { runVizGate } from '#services/premium_report/premium_report_viz_validator';
import { REPORT_FORMULA_IDS, } from '#constants/report_builder.constants';
import { isReportFormulaId, } from '#services/report_builder/formulas';
import { applyFormulaOnDataset, FORMULAS_FILL_REST_DAYS } from '#services/premium_report/apply_formula_op';
import { assertDatasetRowsCap, commitDataset, columnStats, correlateColumns, defaultGroupBy, densifyDailyDataset, filterRows, inferNumericColumns, joinOnKeys, looksLikeDateColumn, partitionRows, pickDateColumn, pruneEmptyMetricColumns, rankTopRows, readDateRange, readPositiveInt, readString, readStringList, requireDataset, round3, takeLatestRows, toNumber, uniqueColumns, } from '#services/premium_report/dataset_ops';
export const createPremiumDataTools = (state, opts) => {
    const allowed = allowedFormulaIds(opts?.domains);
    return [
        buildFillDailyZerosTool(state),
        buildTakeLatestTool(state),
        buildFilterDatasetTool(state),
        buildDropEmptyColumnsTool(state),
        buildJoinDatasetsTool(state),
        buildAggregateDatasetTool(state),
        buildApplyFormulaTool(state, allowed),
        buildTransformColumnsTool(state),
        buildCorrelateTool(state),
    ];
};
export const allowedFormulaIds = (domains) => {
    if (!domains?.length)
        return new Set(REPORT_FORMULA_IDS);
    const ids = new Set();
    for (const domain of domains) {
        for (const id of PREMIUM_DOMAIN_CATALOG[domain].formulaIds)
            ids.add(id);
    }
    return ids.size > 0 ? ids : new Set(REPORT_FORMULA_IDS);
};
const buildAggregateDatasetTool = (state) => ({
    schema: {
        name: 'aggregate_dataset',
        description: 'Group by a key (e.g. poste) and reduce numeric columns with mean|median|sum. Use for position/group comparisons before add_chart bar.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                groupBy: { type: 'string' },
                columns: { type: 'array', items: { type: 'string' } },
                op: { type: 'string', enum: ['mean', 'median', 'sum'] },
            },
            required: ['datasetId', 'groupBy'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const groupBy = readString(input.groupBy);
        if (!groupBy || !dataset.columns.includes(groupBy)) {
            return JSON.stringify({
                error: 'groupBy required and must exist',
                columns: dataset.columns,
            });
        }
        const opRaw = readString(input.op) ?? 'mean';
        const op = opRaw === 'median' || opRaw === 'sum' ? opRaw : 'mean';
        const requested = readStringList(input.columns);
        const valueColumns = (requested.length
            ? requested.filter((col) => dataset.columns.includes(col) && col !== groupBy)
            : inferNumericColumns(dataset, [groupBy])).slice(0, 12);
        if (!valueColumns.length) {
            return JSON.stringify({ error: 'no numeric columns to aggregate', columns: dataset.columns });
        }
        const groups = partitionRows(dataset.rows, groupBy);
        const rows = groups.flatMap((group) => {
            const key = group[0]?.[groupBy];
            if (key == null || String(key).trim() === '')
                return [];
            const out = { [groupBy]: key, n: group.length };
            for (const col of valueColumns) {
                const values = group
                    .map((row) => toNumber(row[col]))
                    .filter((n) => n != null);
                if (!values.length) {
                    out[col] = null;
                    continue;
                }
                if (op === 'sum') {
                    out[col] = round3(values.reduce((acc, n) => acc + n, 0));
                    continue;
                }
                if (op === 'median') {
                    const sorted = [...values].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    out[col] =
                        sorted.length % 2 === 1
                            ? sorted[mid]
                            : round3((sorted[mid - 1] + sorted[mid]) / 2);
                    continue;
                }
                const stats = columnStats(group, col);
                out[col] = stats?.mean ?? round3(values.reduce((acc, n) => acc + n, 0) / values.length);
            }
            return [out];
        });
        const next = {
            id: 'tmp',
            columns: uniqueColumns([groupBy, 'n', ...valueColumns]),
            rows,
            ...(dataset.units
                ? {
                    units: Object.fromEntries(Object.entries(dataset.units).filter(([column]) => valueColumns.includes(column))),
                }
                : {}),
        };
        const capError = assertDatasetRowsCap(next.rows.length);
        if (capError)
            return JSON.stringify({ error: capError });
        return commitDataset(state, next, { op, groupBy, columns: valueColumns });
    },
});
const buildApplyFormulaTool = (state, allowed) => {
    const ids = [...allowed];
    return {
        schema: {
            name: 'apply_formula',
            description: 'Apply formula (ewma/monotony/strain/acwr/zscore/…). Returns new datasetId.',
            input_schema: {
                type: 'object',
                properties: {
                    id: { type: 'string', enum: ids },
                    datasetId: { type: 'string' },
                    valueColumn: { type: 'string' },
                    groupBy: { type: 'string' },
                    orderBy: { type: 'string' },
                    outputColumn: { type: 'string' },
                    fillRestDays: { type: 'boolean' },
                    n: { type: 'number' },
                    acute: { type: 'number' },
                    chronic: { type: 'number' },
                    uncoupled: { type: 'boolean' },
                    minPoints: { type: 'number' },
                    minSd: { type: 'number' },
                },
                required: ['id', 'datasetId', 'valueColumn'],
            },
        },
        execute: async (input) => {
            const idRaw = readString(input.id);
            if (!idRaw || !isReportFormulaId(idRaw) || !allowed.has(idRaw)) {
                return JSON.stringify({ error: 'invalid or disallowed formula id', allowed: ids });
            }
            const valueColumn = readString(input.valueColumn);
            if (!readString(input.datasetId) || !valueColumn) {
                return JSON.stringify({ error: 'datasetId and valueColumn are required' });
            }
            const dataset = requireDataset(state, input);
            if (typeof dataset === 'string')
                return dataset;
            if (!dataset.columns.includes(valueColumn)) {
                return JSON.stringify({ error: `column "${valueColumn}" not in dataset`, columns: dataset.columns });
            }
            const groupBy = defaultGroupBy(dataset, readString(input.groupBy));
            const orderBy = readString(input.orderBy);
            const outputColumn = readString(input.outputColumn) ?? idRaw;
            const fillRestDays = typeof input.fillRestDays === 'boolean' ? input.fillRestDays : undefined;
            const params = readFormulaParams(input);
            const started = Date.now();
            const next = applyFormulaOnDataset({
                dataset,
                valueColumn,
                groupBy,
                orderBy,
                outputColumn,
                formulaId: idRaw,
                params,
                fillRestDays,
                dateRange: state.dateRange,
            });
            const didFill = (fillRestDays ?? FORMULAS_FILL_REST_DAYS.has(idRaw)) &&
                Boolean(orderBy && looksLikeDateColumn(orderBy, dataset));
            return commitDataset(state, next, {
                formula: idRaw,
                filledRestDays: didFill,
                durationSec: elapsedSec(started),
            });
        },
    };
};
const buildTransformColumnsTool = (state) => ({
    schema: {
        name: 'transform_columns',
        description: 'Row math: recipe=scale|srpe|relative_intensity|vmax_exposure or op=add|sub|mul|div.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                recipe: {
                    type: 'string',
                    enum: ['scale', 'srpe', 'relative_intensity', 'vmax_exposure'],
                },
                column: { type: 'string' },
                factor: { type: 'number' },
                op: { type: 'string', enum: ['add', 'sub', 'mul', 'div'] },
                leftColumn: { type: 'string' },
                rightColumn: { type: 'string' },
                rpeColumn: { type: 'string' },
                minutesColumn: { type: 'string' },
                durationSecondsColumn: { type: 'string' },
                numeratorColumn: { type: 'string' },
                speedColumn: { type: 'string' },
                vmaxColumn: { type: 'string' },
                outputColumn: { type: 'string' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const recipe = readString(input.recipe);
        const op = readString(input.op);
        const started = Date.now();
        const recipeResult = recipe ? applyTransformRecipe(dataset, recipe, input) : null;
        if (typeof recipeResult === 'string')
            return recipeResult;
        let outCol;
        let rows;
        if (recipeResult) {
            outCol = recipeResult.outCol;
            rows = recipeResult.rows;
        }
        else if (op && ['add', 'sub', 'mul', 'div'].includes(op)) {
            const left = readString(input.leftColumn);
            const right = readString(input.rightColumn);
            if (!left || !right) {
                return JSON.stringify({ error: 'leftColumn and rightColumn required for op' });
            }
            outCol = readString(input.outputColumn) ?? `${left}_${op}_${right}`;
            rows = dataset.rows.map((row) => {
                const a = toNumber(row[left]);
                const b = toNumber(row[right]);
                let value = null;
                if (a != null && b != null) {
                    if (op === 'add')
                        value = a + b;
                    else if (op === 'sub')
                        value = a - b;
                    else if (op === 'mul')
                        value = a * b;
                    else if (b !== 0)
                        value = a / b;
                }
                return { ...row, [outCol]: value == null ? null : round3(value) };
            });
        }
        else {
            return JSON.stringify({
                error: 'Pass recipe=scale|srpe|relative_intensity|vmax_exposure or op=add|sub|mul|div',
            });
        }
        if (!outCol)
            return JSON.stringify({ error: 'outputColumn required' });
        const columns = dataset.columns.includes(outCol) ? dataset.columns : [...dataset.columns, outCol];
        const next = {
            id: 'tmp',
            columns,
            rows,
            ...(dataset.units ? { units: dataset.units } : {}),
        };
        return commitDataset(state, next, {
            transform: recipe ?? op,
            outputColumn: outCol,
            durationSec: elapsedSec(started),
        });
    },
});
const rowMinutes = (row, minCol, durCol) => {
    const minutesFromDur = toNumber(row[durCol]);
    return toNumber(row[minCol]) ?? (minutesFromDur != null ? minutesFromDur / 60 : null);
};
const mapOut = (dataset, outCol, compute) => ({
    outCol,
    rows: dataset.rows.map((row) => ({ ...row, [outCol]: compute(row) })),
});
const applyTransformRecipe = (dataset, recipe, input) => {
    if (recipe === 'srpe') {
        const rpeCol = readString(input.rpeColumn) ?? 'rpe';
        const minCol = readString(input.minutesColumn) ?? 'minutes';
        const durCol = readString(input.durationSecondsColumn) ?? 'duration_seconds';
        return mapOut(dataset, readString(input.outputColumn) ?? 'srpe', (row) => {
            const rpe = toNumber(row[rpeCol]);
            const minutes = rowMinutes(row, minCol, durCol);
            return rpe == null || minutes == null ? null : round3(rpe * minutes);
        });
    }
    if (recipe === 'relative_intensity') {
        const numCol = readString(input.numeratorColumn);
        if (!numCol)
            return JSON.stringify({ error: 'numeratorColumn required' });
        const minCol = readString(input.minutesColumn) ?? 'minutes';
        const durCol = readString(input.durationSecondsColumn) ?? 'duration_seconds';
        return mapOut(dataset, readString(input.outputColumn) ?? 'relative_intensity', (row) => {
            const num = toNumber(row[numCol]);
            const minutes = rowMinutes(row, minCol, durCol);
            return num == null || minutes == null || minutes === 0 ? null : round3(num / minutes);
        });
    }
    if (recipe === 'vmax_exposure') {
        const speedCol = readString(input.speedColumn);
        const vmaxCol = readString(input.vmaxColumn);
        if (!speedCol || !vmaxCol)
            return JSON.stringify({ error: 'speedColumn and vmaxColumn required' });
        return mapOut(dataset, readString(input.outputColumn) ?? 'vmax_rel_pct', (row) => {
            const speed = toNumber(row[speedCol]);
            const vmax = toNumber(row[vmaxCol]);
            return speed == null || vmax == null || vmax === 0 ? null : round3((100 * speed) / vmax);
        });
    }
    if (recipe === 'scale') {
        const srcCol = readString(input.column) ?? readString(input.leftColumn);
        const factor = toNumber(input.factor);
        if (!srcCol)
            return JSON.stringify({ error: 'column required for recipe=scale' });
        if (factor == null)
            return JSON.stringify({ error: 'factor required (e.g. 0.001 for m→km)' });
        return mapOut(dataset, readString(input.outputColumn) ?? `${srcCol}_scaled`, (row) => {
            const v = toNumber(row[srcCol]);
            return v == null ? null : round3(v * factor);
        });
    }
    return null;
};
const buildCorrelateTool = (state) => ({
    schema: {
        name: 'correlate',
        description: 'Pearson/Spearman. mode=matrix → heatmap rows; mode=pair → one r.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                mode: { type: 'string', enum: ['matrix', 'pair'] },
                method: { type: 'string', enum: ['pearson', 'spearman'] },
                columns: { type: 'array', items: { type: 'string' } },
                xColumn: { type: 'string' },
                yColumn: { type: 'string' },
                groupBy: { type: 'string' },
                minPairs: { type: 'number' },
                outputColumn: { type: 'string' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const mode = readString(input.mode) === 'pair' ? 'pair' : 'matrix';
        const method = readString(input.method) === 'spearman' ? 'spearman' : 'pearson';
        const minPairs = readPositiveInt(input.minPairs, 5);
        const started = Date.now();
        const requestedColumns = readStringList(input.columns);
        const columnsToCorrelate = requestedColumns.length >= 2 ? requestedColumns : dataset.columns;
        const jevError = runVizGate(state, {
            toolName: 'correlate',
            datasetColumns: columnsToCorrelate,
            datasetRowCount: dataset.rows.length,
            mode,
        });
        if (jevError)
            return jevError;
        if (mode === 'pair') {
            const xColumn = readString(input.xColumn);
            const yColumn = readString(input.yColumn);
            if (!xColumn || !yColumn) {
                return JSON.stringify({ error: 'xColumn and yColumn required for mode=pair' });
            }
            const groupBy = readString(input.groupBy);
            const outputColumn = readString(input.outputColumn) ?? 'r';
            const groups = partitionRows(dataset.rows, groupBy);
            const rows = groups.map((group) => {
                const { r, n } = correlateColumns(group, xColumn, yColumn, method, minPairs);
                const out = {
                    x_column: xColumn,
                    y_column: yColumn,
                    [outputColumn]: r,
                    n,
                    method,
                };
                if (groupBy)
                    out[groupBy] = group[0]?.[groupBy] ?? null;
                return out;
            });
            const columns = uniqueColumns([
                ...(groupBy ? [groupBy] : []),
                'x_column',
                'y_column',
                outputColumn,
                'n',
                'method',
            ]);
            return commitDataset(state, { id: 'tmp', columns, rows }, {
                mode,
                method,
                durationSec: elapsedSec(started),
            });
        }
        const requested = readStringList(input.columns);
        const columns = requested.length >= 2 ? requested : inferNumericColumns(dataset);
        if (columns.length < 2) {
            return JSON.stringify({
                error: 'Need ≥2 numeric columns for correlation matrix',
                columns: dataset.columns,
            });
        }
        const finiteCounts = columns.map((col) => dataset.rows.reduce((n, row) => (toNumber(row[col]) != null ? n + 1 : n), 0));
        const rows = [];
        for (let i = 0; i < columns.length; i++) {
            const left = columns[i];
            rows.push({ x: left, y: left, r: 1, n: finiteCounts[i] });
            for (let j = i + 1; j < columns.length; j++) {
                const right = columns[j];
                const { r, n } = correlateColumns(dataset.rows, left, right, method, minPairs);
                rows.push({ x: left, y: right, r, n });
                rows.push({ x: right, y: left, r, n });
            }
        }
        return commitDataset(state, {
            id: 'tmp',
            columns: ['x', 'y', 'r', 'n'],
            rows,
        }, {
            mode: 'matrix',
            method,
            metrics: columns,
            durationSec: elapsedSec(started),
            note: 'add_chart chartType=heatmap (or omit — auto)',
        });
    },
});
const buildJoinDatasetsTool = (state) => ({
    schema: {
        name: 'join_datasets',
        description: 'Outer-join 2+ datasets on keys (default joueur).',
        input_schema: {
            type: 'object',
            properties: {
                datasetIds: { type: 'array', items: { type: 'string' } },
                keys: { type: 'array', items: { type: 'string' } },
            },
            required: ['datasetIds'],
        },
    },
    execute: async (input) => {
        const ids = readStringList(input.datasetIds);
        if (ids.length < 2)
            return JSON.stringify({ error: 'datasetIds needs at least 2 ids' });
        const datasets = ids.map((id) => state.datasets.get(id));
        if (datasets.some((d) => !d)) {
            return JSON.stringify({
                error: 'unknown datasetId',
                missing: ids.filter((id) => !state.datasets.has(id)),
            });
        }
        const requestedKeys = readStringList(input.keys);
        const keys = requestedKeys.length > 0
            ? requestedKeys
            : [defaultGroupBy(datasets[0]) ?? datasets[0].columns[0]];
        const started = Date.now();
        const merged = joinOnKeys(datasets, keys);
        return commitDataset(state, merged, {
            keys,
            durationSec: elapsedSec(started),
        });
    },
});
const buildFillDailyZerosTool = (state) => ({
    schema: {
        name: 'fill_daily_zeros',
        description: 'Densify daily series with 0 for valueColumns (rest days).',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                dateColumn: { type: 'string' },
                groupBy: { type: 'string' },
                valueColumns: { type: 'array', items: { type: 'string' } },
                from: { type: 'string' },
                to: { type: 'string' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const dateColumn = readString(input.dateColumn) ?? pickDateColumn(dataset.columns);
        if (!dateColumn) {
            return JSON.stringify({ error: 'dateColumn required', columns: dataset.columns });
        }
        const groupBy = defaultGroupBy(dataset, readString(input.groupBy));
        const { from, to } = readDateRange(input, state.dateRange);
        const valueColumnsRequested = readStringList(input.valueColumns);
        const valueColumns = valueColumnsRequested.length > 0
            ? valueColumnsRequested
            : inferNumericColumns(dataset, [dateColumn, ...(groupBy ? [groupBy] : [])]);
        const densified = densifyDailyDataset({
            dataset,
            dateColumn,
            groupBy,
            valueColumns,
            from,
            to,
        });
        const cap = assertDatasetRowsCap(densified.rows.length);
        if (cap)
            return JSON.stringify({ error: cap });
        return commitDataset(state, densified, {
            filledZeros: true,
            dateColumn,
            groupBy: groupBy ?? null,
            valueColumns,
            from,
            to,
        });
    },
});
const buildTakeLatestTool = (state) => ({
    schema: {
        name: 'take_latest',
        description: 'Last row per groupBy by orderBy, or topN+sortColumn ranking.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                groupBy: { type: 'string' },
                orderBy: { type: 'string' },
                columns: { type: 'array', items: { type: 'string' } },
                topN: { type: 'number' },
                sortColumn: { type: 'string' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const topN = typeof input.topN === 'number' ? input.topN : Number(input.topN);
        const sortColumn = readString(input.sortColumn);
        const groupBy = defaultGroupBy(dataset, readString(input.groupBy));
        const orderBy = readString(input.orderBy) ?? pickDateColumn(dataset.columns);
        const keep = readStringList(input.columns);
        if (!groupBy || !orderBy) {
            if (Number.isFinite(topN) && topN > 0 && sortColumn) {
                return commitDataset(state, {
                    ...dataset,
                    rows: rankTopRows(dataset.rows, sortColumn, topN),
                });
            }
            return JSON.stringify({
                error: 'groupBy or orderBy could not be detected',
                hint: 'Use filter_dataset(top, sortBy) for rankings',
                columns: dataset.columns,
            });
        }
        let next = takeLatestRows(dataset, groupBy, orderBy, keep.length ? keep : undefined);
        if (Number.isFinite(topN) && topN > 0 && sortColumn) {
            next = { ...next, rows: rankTopRows(next.rows, sortColumn, topN) };
        }
        return commitDataset(state, next);
    },
});
const buildFilterDatasetTool = (state) => ({
    schema: {
        name: 'filter_dataset',
        description: 'Filter/sort rows. top+sortBy for rankings; column+op+value for filters.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
                top: { type: 'number' },
                sortBy: { type: 'string' },
                sortDir: { type: 'string', enum: ['asc', 'desc'] },
                column: { type: 'string' },
                op: { type: 'string', enum: ['ne', 'eq', 'gt', 'gte', 'lt', 'lte', 'not_null'] },
                value: { type: 'number' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const top = typeof input.top === 'number' ? input.top : Number(input.top);
        const sortBy = readString(input.sortBy);
        if (Number.isFinite(top) && top > 0 && sortBy) {
            const dir = readString(input.sortDir) === 'asc' ? 'asc' : 'desc';
            return commitDataset(state, {
                ...dataset,
                rows: rankTopRows(dataset.rows, sortBy, top, dir),
            });
        }
        const column = readString(input.column);
        const op = readString(input.op);
        if (!column || !op) {
            return JSON.stringify({ error: 'Provide top+sortBy for top-N, or column+op(+value) for row filter.' });
        }
        const filterOp = op;
        if (!['ne', 'eq', 'gt', 'gte', 'lt', 'lte', 'not_null'].includes(filterOp)) {
            return JSON.stringify({ error: 'invalid op' });
        }
        const rawValue = typeof input.value === 'number' ? input.value : Number(input.value);
        if (filterOp !== 'not_null' && !Number.isFinite(rawValue)) {
            return JSON.stringify({ error: 'value required for this op' });
        }
        const next = filterRows(dataset, column, filterOp, Number.isFinite(rawValue) ? rawValue : undefined);
        return commitDataset(state, next);
    },
});
const buildDropEmptyColumnsTool = (state) => ({
    schema: {
        name: 'drop_empty_columns',
        description: 'Drop metric columns that are all 0/empty.',
        input_schema: {
            type: 'object',
            properties: {
                datasetId: { type: 'string' },
            },
            required: ['datasetId'],
        },
    },
    execute: async (input) => {
        const dataset = requireDataset(state, input);
        if (typeof dataset === 'string')
            return dataset;
        const { dataset: next, dropped } = pruneEmptyMetricColumns(dataset);
        if (next.columns.length === 0) {
            return JSON.stringify({ error: 'all columns would be dropped', dropped });
        }
        return commitDataset(state, next, {
            droppedEmptyColumns: dropped,
            note: dropped.length ? `Removed: ${dropped.join(', ')}` : 'No empty metrics',
        });
    },
});
const readFormulaParams = (input) => {
    const params = {};
    for (const key of ['n', 'acute', 'chronic', 'minPoints', 'minSd']) {
        const raw = input[key];
        if (typeof raw === 'number' && Number.isFinite(raw))
            params[key] = raw;
    }
    if (typeof input.uncoupled === 'boolean')
        params.uncoupled = input.uncoupled;
    return params;
};
//# sourceMappingURL=tools_data.js.map