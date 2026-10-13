import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_HEADING_LENGTH, PREMIUM_REPORT_MAX_TABLE_ROWS, PREMIUM_REPORT_MAX_TEXT_LENGTH, isPremiumChartPreset, isValueTransformOp, } from '#constants/premium_report.constants';
import { chartDisplayRowCap, precedingHeadingMismatch, runVizGate, } from '#services/premium_report/premium_report_viz_validator';
import { applyValueTransform, bindChartDataset, implausibleMetricWarning, insertBlock, mergeChartDatasets, newBlockId, pruneEmptyTableColumns, reshapePremiumTable, sanitizePlainObject, stripMarkdownDecorations, tableFromDataset, applyTableHeat, } from '#services/premium_report/premium_report_document';
import { buildPresetFromDataset, inferChartType, inferRefLines, pickCategoryColumn, uniqueColumnCount, } from '#services/premium_report/chart_presets';
import { relabelTableColumns } from '#services/premium_report/column_labels';
import { pickDateColumn, readString, readStringList, trimDatasetRows } from '#services/premium_report/dataset_ops';
import { jevTextCaption } from '#services/premium_report/jev_text_caption';
export const createPremiumDocumentTools = (state) => [
    {
        schema: {
            name: 'set_report_meta',
            description: 'Set the report title and/or date range shown on the PDF cover.',
            input_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    from: { type: 'string', description: 'YYYY-MM-DD' },
                    to: { type: 'string', description: 'YYYY-MM-DD' },
                },
            },
        },
        execute: async (input) => {
            const title = readString(input.title);
            if (title)
                state.document.title = title.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH);
            const from = readString(input.from);
            const to = readString(input.to);
            if (from && to && from <= to)
                state.document.dateRange = { from, to };
            return JSON.stringify({
                ok: true,
                title: state.document.title,
                dateRange: state.document.dateRange,
            });
        },
    },
    {
        schema: {
            name: 'add_heading',
            description: 'Add a section heading. after: start|end|<blockId>.',
            input_schema: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    level: { type: 'integer', enum: [1, 2] },
                    after: { type: 'string' },
                },
                required: ['text'],
            },
        },
        execute: async (input) => {
            const text = stripMarkdownDecorations(readString(input.text) ?? '')
                .slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH)
                .trim();
            if (!text)
                return JSON.stringify({ error: 'text required' });
            const level = input.level === 2 ? 2 : 1;
            const block = {
                id: newBlockId(),
                type: PREMIUM_BLOCK_TYPE.HEADING,
                text,
                level,
            };
            return commitInsert(state, block, readString(input.after));
        },
    },
    {
        schema: {
            name: 'add_text',
            description: 'Add plain-text caption under a viz when it adds staff insight (no markdown). Server may reject filler via Jev. after: start|end|<blockId>.',
            input_schema: {
                type: 'object',
                properties: {
                    text: { type: 'string' },
                    after: { type: 'string' },
                },
                required: ['text'],
            },
        },
        execute: async (input) => {
            const text = stripMarkdownDecorations(readString(input.text)?.replace(/\r\n/g, '\n') ?? '')
                .trim();
            if (!text)
                return JSON.stringify({ error: 'text required' });
            const after = readString(input.after);
            const gated = await gateTextCaption(state, text, after);
            if (gated)
                return gated;
            const block = {
                id: newBlockId(),
                type: PREMIUM_BLOCK_TYPE.TEXT,
                text: text.slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH),
            };
            return commitInsert(state, block, after);
        },
    },
    {
        schema: {
            name: 'add_chart',
            description: 'Add chart from datasetId. chartType optional (auto). Scatter only continuous metrics. refLines optional — omit to auto (see prompt: not systematic mean/median).',
            input_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    datasetId: { type: 'string' },
                    datasetIds: { type: 'array', items: { type: 'string' } },
                    chartType: {
                        type: 'string',
                        enum: ['donut', 'bar', 'line', 'bar-line', 'heatmap', 'radar', 'scatter'],
                    },
                    category: { type: 'string' },
                    values: { type: 'array', items: { type: 'string' } },
                    refLines: {
                        type: 'string',
                        enum: ['none', 'mean', 'mean_median', 'full'],
                    },
                    option: { type: 'object' },
                    after: { type: 'string' },
                },
                required: ['title'],
            },
        },
        execute: async (input) => {
            const title = readString(input.title)?.trim() || 'Chart';
            const resolved = resolveToolDataset(state, input);
            if (typeof resolved === 'string')
                return resolved;
            const chartTypeRaw = readString(input.chartType);
            const chartType = chartTypeRaw && isPremiumChartPreset(chartTypeRaw)
                ? chartTypeRaw
                : resolved
                    ? inferChartType(resolved)
                    : undefined;
            let dataset = resolved;
            let trimmedFrom;
            if (dataset) {
                const capped = trimDatasetRows(dataset, chartDisplayRowCap(chartTypeRaw || chartType || 'auto', dataset.columns));
                dataset = capped.dataset;
                trimmedFrom = capped.trimmedFrom;
                const categoryCol = pickCategoryColumn(dataset, readString(input.category) ?? undefined);
                const uniqueCategories = uniqueColumnCount(dataset, categoryCol);
                const jevError = runVizGate(state, {
                    toolName: 'add_chart',
                    title,
                    datasetColumns: dataset.columns,
                    datasetRowCount: dataset.rows.length,
                    chartType: chartTypeRaw || chartType || 'auto',
                    uniqueCategories,
                });
                if (jevError)
                    return jevError;
                const headingError = precedingHeadingMismatch(state.document.blocks, dataset.columns, readString(input.after));
                if (headingError)
                    return headingError;
            }
            const incoming = sanitizePlainObject(input.option);
            const refRaw = readString(input.refLines);
            const refLines = refRaw === 'none' || refRaw === 'mean' || refRaw === 'full' || refRaw === 'mean_median'
                ? refRaw
                : inferRefLines({
                    chartType: chartTypeRaw || chartType,
                    rowCount: dataset?.rows.length ?? 0,
                    hasDate: Boolean(dataset && pickDateColumn(dataset.columns)),
                });
            const built = dataset && chartType
                ? buildPresetFromDataset(chartType, dataset, readString(input.category), readStringList(input.values), refLines, state.language)
                : undefined;
            if (typeof built === 'string')
                return built;
            const option = built ?? incoming;
            if (!option) {
                return JSON.stringify({
                    error: 'Pass datasetId (chartType optional — auto-inferred) or option.',
                });
            }
            if (!dataset && !hasInlineChartData(option)) {
                return JSON.stringify({
                    error: 'Pass datasetId from query_database, or put dataset.source / series.data in option.',
                });
            }
            if (dataset) {
                const metricWarning = implausibleMetricWarning(dataset, state.dateRange);
                if (metricWarning)
                    return JSON.stringify({ error: metricWarning });
            }
            const block = {
                id: newBlockId(),
                type: PREMIUM_BLOCK_TYPE.CHART,
                title: title.slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH),
                option: dataset ? bindChartDataset(option, dataset, state.language) : option,
            };
            const inserted = commitInsert(state, block, readString(input.after));
            if (!trimmedFrom)
                return inserted;
            try {
                return JSON.stringify({
                    ...JSON.parse(inserted),
                    trimmedRows: trimmedFrom,
                    note: `Kept last ${dataset?.rows.length ?? 0} rows for chart readability.`,
                });
            }
            catch {
                return inserted;
            }
        },
    },
    {
        schema: {
            name: 'add_table',
            description: 'Add table from datasetId (or columns+rows). Server auto-applies relative heat (top ~35% / top ~15% per column). Optional heatColors={volumeMid,volumeHigh,riskMid?,riskHigh?} as #RRGGBB (same as classic series.color).',
            input_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    datasetId: { type: 'string' },
                    columns: { type: 'array', items: { type: 'string' } },
                    rows: { type: 'array' },
                    option: { type: 'object' },
                    heatColors: { type: 'object' },
                    after: { type: 'string' },
                },
            },
        },
        execute: async (input) => {
            const datasetId = readString(input.datasetId);
            const fromDatasetRaw = datasetId ? state.datasets.get(datasetId) : undefined;
            let fromDataset = fromDatasetRaw;
            let trimmedFrom;
            if (fromDataset) {
                const capped = trimDatasetRows(fromDataset, PREMIUM_REPORT_MAX_TABLE_ROWS);
                fromDataset = capped.dataset;
                trimmedFrom = capped.trimmedFrom;
            }
            const columns = readStringList(input.columns);
            const built = fromDataset
                ? tableFromDataset(fromDataset, state.language)
                : {
                    columns: relabelTableColumns(columns, state.language),
                    rows: readTableRows(input.rows, columns.length),
                };
            if (built.columns.length === 0) {
                return JSON.stringify({ error: 'datasetId or columns required' });
            }
            if (fromDataset) {
                const jevError = runVizGate(state, {
                    toolName: 'add_table',
                    title: readString(input.title),
                    datasetColumns: fromDataset.columns,
                    datasetRowCount: fromDataset.rows.length,
                });
                if (jevError)
                    return jevError;
                const headingError = precedingHeadingMismatch(state.document.blocks, fromDataset.columns, readString(input.after));
                if (headingError)
                    return headingError;
                const metricWarning = implausibleMetricWarning(fromDataset, state.dateRange);
                if (metricWarning)
                    return JSON.stringify({ error: metricWarning });
            }
            const option = readTableStyle(input);
            if (typeof option === 'string')
                return option;
            const rawBlock = {
                id: newBlockId(),
                type: PREMIUM_BLOCK_TYPE.TABLE,
                title: readString(input.title)?.trim() || undefined,
                columns: built.columns,
                rows: built.rows,
                ...(option ? { option } : {}),
            };
            const block = applyTableHeat(rawBlock, state.language);
            const inserted = commitInsert(state, block, readString(input.after));
            const dropped = 'droppedEmptyColumns' in built ? built.droppedEmptyColumns : undefined;
            if (!dropped?.length && !trimmedFrom)
                return inserted;
            try {
                return JSON.stringify({
                    ...JSON.parse(inserted),
                    ...(dropped?.length ? { droppedEmptyColumns: dropped } : {}),
                    ...(trimmedFrom
                        ? {
                            trimmedRows: trimmedFrom,
                            note: `Kept last ${fromDataset?.rows.length ?? 0} rows for table readability.`,
                        }
                        : {}),
                });
            }
            catch {
                return inserted;
            }
        },
    },
    {
        schema: {
            name: 'update_block',
            description: 'Patch block by id (title/renameColumns/dropColumns/heatColors…). Skip if already correct — no-op returns ok. Prefer correct add_table over rename loops. Recolor table heat like classic updateSeries color: heatColors={volumeMid,volumeHigh} #RRGGBB.',
            input_schema: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    title: { type: 'string' },
                    level: { type: 'integer', enum: [1, 2] },
                    datasetId: { type: 'string' },
                    datasetIds: { type: 'array', items: { type: 'string' } },
                    chartType: {
                        type: 'string',
                        enum: ['donut', 'bar', 'line', 'bar-line', 'heatmap', 'radar', 'scatter'],
                    },
                    category: { type: 'string' },
                    values: { type: 'array', items: { type: 'string' } },
                    option: { type: 'object' },
                    header: { type: 'object' },
                    columnStyles: { type: 'object' },
                    heatColors: { type: 'object' },
                    columns: { type: 'array', items: { type: 'string' } },
                    dropColumns: { type: 'array', items: { type: 'string' } },
                    pruneEmptyColumns: { type: 'boolean' },
                    renameColumns: { type: 'object' },
                    border: {},
                },
                required: [],
            },
        },
        execute: async (input) => {
            const style = readTableStyle(input);
            if (typeof style === 'string')
                return style;
            const reshape = readTableReshape(input);
            const pruneEmpty = input.pruneEmptyColumns === true;
            const id = readString(input.id);
            if (!id && (style || reshape || pruneEmpty)) {
                return patchTables(state, { style, reshape, pruneEmpty });
            }
            if (!id)
                return JSON.stringify({ error: 'id required' });
            const index = state.document.blocks.findIndex((block) => block.id === id);
            const current = state.document.blocks[index];
            if (!current)
                return JSON.stringify({ error: 'block not found' });
            if ((style || reshape || pruneEmpty) && current.type !== PREMIUM_BLOCK_TYPE.TABLE) {
                return JSON.stringify({ error: 'table fields only apply to tables' });
            }
            if (current.type === PREMIUM_BLOCK_TYPE.TABLE && (style || reshape || pruneEmpty)) {
                return patchTables(state, { id, style, reshape, pruneEmpty });
            }
            if (current.type === PREMIUM_BLOCK_TYPE.TEXT && readString(input.text)) {
                const text = stripMarkdownDecorations(readString(input.text)?.replace(/\r\n/g, '\n') ?? '').trim();
                if (text) {
                    const gated = await gateTextCaption(state, text, id);
                    if (gated)
                        return gated;
                }
            }
            const patched = patchChartOrBlock(current, style ? { ...input, option: style } : input, state);
            if (typeof patched === 'string')
                return patched;
            state.document.blocks[index] = patched;
            return JSON.stringify({
                ok: true,
                id,
                ...(patched.type === PREMIUM_BLOCK_TYPE.TABLE
                    ? { columns: patched.columns, option: patched.option }
                    : {}),
            });
        },
    },
    {
        schema: {
            name: 'transform_values',
            description: 'Numeric transform on canvas charts/tables (works with empty datasets). op: round|floor|ceil|multiply|divide|add|subtract. m→km: multiply 0.001 on distance columns; omit id to apply to all viz.',
            input_schema: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    columns: { type: 'array', items: { type: 'string' } },
                    op: {
                        type: 'string',
                        enum: ['round', 'floor', 'ceil', 'multiply', 'divide', 'add', 'subtract'],
                    },
                    value: { type: 'number' },
                },
                required: ['op'],
            },
        },
        execute: async (input) => {
            const opRaw = readString(input.op);
            if (!opRaw || !isValueTransformOp(opRaw)) {
                return JSON.stringify({ error: 'op must be round|floor|ceil|multiply|divide|add|subtract' });
            }
            const value = typeof input.value === 'number' ? input.value : Number(input.value);
            const needsValue = opRaw === 'multiply' || opRaw === 'divide' || opRaw === 'add' || opRaw === 'subtract';
            if (needsValue && !Number.isFinite(value)) {
                return JSON.stringify({ error: 'value is required for this op' });
            }
            if (opRaw === 'divide' && value === 0)
                return JSON.stringify({ error: 'cannot divide by 0' });
            const columns = readStringList(input.columns);
            const id = readString(input.id);
            const targets = id
                ? state.document.blocks.filter((block) => block.id === id)
                : state.document.blocks.filter((block) => block.type === PREMIUM_BLOCK_TYPE.CHART || block.type === PREMIUM_BLOCK_TYPE.TABLE);
            if (id && targets.length === 0)
                return JSON.stringify({ error: 'block not found' });
            if (targets.length === 0)
                return JSON.stringify({ error: 'no chart or table to transform' });
            const blockIndexMap = new Map(state.document.blocks.map((b, i) => [b.id, i]));
            let cells = 0;
            for (const block of targets) {
                const result = applyValueTransform(block, {
                    columns: columns.length ? columns : undefined,
                    op: opRaw,
                    value: Number.isFinite(value) ? value : undefined,
                });
                if (typeof result === 'string')
                    return result;
                const idx = blockIndexMap.get(block.id);
                if (idx !== undefined)
                    state.document.blocks[idx] = result.block;
                cells += result.cells;
            }
            return JSON.stringify({
                ok: true,
                cells,
                blocks: targets.map((block) => block.id),
            });
        },
    },
    {
        schema: {
            name: 'remove_block',
            description: 'Remove a block by id.',
            input_schema: {
                type: 'object',
                properties: { id: { type: 'string' } },
                required: ['id'],
            },
        },
        execute: async (input) => {
            const id = readString(input.id);
            if (!id)
                return JSON.stringify({ error: 'id required' });
            const before = state.document.blocks.length;
            state.document.blocks = state.document.blocks.filter((block) => block.id !== id);
            if (state.document.blocks.length === before) {
                return JSON.stringify({ error: 'block not found' });
            }
            return JSON.stringify({ ok: true, id });
        },
    },
];
const resolveToolDataset = (state, input) => {
    const single = readString(input.datasetId);
    const ids = [...new Set([...readStringList(input.datasetIds), ...(single ? [single] : [])])];
    if (ids.length === 0)
        return undefined;
    const datasets = [];
    for (const id of ids) {
        const dataset = state.datasets.get(id);
        if (!dataset)
            return JSON.stringify({ error: `Unknown datasetId ${id}` });
        datasets.push(dataset);
    }
    return mergeChartDatasets(datasets);
};
const commitInsert = (state, block, after) => {
    const result = insertBlock(state.document, block, resolveAfter(state, after));
    if (result.includes('"ok":true'))
        state.lastInsertedId = block.id;
    return result;
};
const gateTextCaption = async (state, text, afterId) => {
    state.jevValidations++;
    const judgment = await jevTextCaption({
        request: state.requestPrompt,
        caption: text,
        blocks: state.document.blocks,
        afterId,
        lastInsertedId: state.lastInsertedId,
    });
    if (judgment.allow)
        return null;
    state.jevBlocked++;
    return JSON.stringify({
        error: 'Caption rejected: not useful enough for the canvas (Jev).',
        suggestion: 'Skip add_text, or write 2–4 sentences tied to the nearby chart/table data — no generic advice.',
        score: judgment.score,
        jevBlocked: true,
    });
};
const resolveAfter = (state, after) => after === 'start' && state.lastInsertedId
    ? state.lastInsertedId
    : after || state.lastInsertedId || state.defaultAfter;
const hasInlineChartData = (option) => {
    const dataset = option.dataset;
    if (dataset && typeof dataset === 'object' && !Array.isArray(dataset)) {
        const source = dataset.source;
        if (Array.isArray(source) && source.length > 0)
            return true;
    }
    return (Array.isArray(option.series) &&
        option.series.some((item) => item &&
            typeof item === 'object' &&
            !Array.isArray(item) &&
            Array.isArray(item.data)));
};
const patchChartOrBlock = (current, input, state) => {
    switch (current.type) {
        case 'heading': {
            const heading = current;
            const raw = readString(input.text);
            const text = raw
                ? stripMarkdownDecorations(raw).slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH).trim()
                : undefined;
            const level = input.level === 2 ? 2 : input.level === 1 ? 1 : heading.level;
            return { ...heading, ...(text ? { text } : {}), ...(level ? { level } : {}) };
        }
        case 'text': {
            const raw = readString(input.text)?.replace(/\r\n/g, '\n');
            const text = raw ? stripMarkdownDecorations(raw).trim() : undefined;
            return {
                ...current,
                ...(text ? { text: text.slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH) } : {}),
            };
        }
        case 'table': {
            const table = current;
            const title = readString(input.title)?.trim();
            const dataset = resolveToolDataset(state, input);
            if (typeof dataset === 'string')
                return dataset;
            const built = dataset ? tableFromDataset(dataset, state.language) : undefined;
            const next = {
                ...table,
                ...(title ? { title } : {}),
                ...(built
                    ? { columns: built.columns, rows: built.rows }
                    : table.columns.some((col) => /_/.test(col))
                        ? { columns: relabelTableColumns(table.columns, state.language) }
                        : {}),
            };
            return applyTableHeat(next, state.language);
        }
        case 'chart': {
            const chart = current;
            const title = readString(input.title)?.trim();
            const incoming = sanitizePlainObject(input.option);
            const dataset = resolveToolDataset(state, input);
            if (typeof dataset === 'string')
                return dataset;
            if (dataset) {
                const metricWarning = implausibleMetricWarning(dataset, state.dateRange);
                if (metricWarning)
                    return JSON.stringify({ error: metricWarning });
            }
            const chartTypeRaw = readString(input.chartType);
            const chartType = chartTypeRaw && isPremiumChartPreset(chartTypeRaw) ? chartTypeRaw : undefined;
            const refLines = inferRefLines({
                chartType: chartTypeRaw || chartType,
                rowCount: typeof dataset === 'object' && dataset ? dataset.rows.length : 0,
                hasDate: Boolean(typeof dataset === 'object' && dataset && pickDateColumn(dataset.columns)),
            });
            const built = dataset && chartType
                ? buildPresetFromDataset(chartType, dataset, readString(input.category), readStringList(input.values), refLines, state.language)
                : undefined;
            if (typeof built === 'string')
                return built;
            let option = built ?? (incoming ? { ...chart.option, ...incoming } : chart.option);
            if (dataset)
                option = bindChartDataset(option, dataset, state.language);
            return {
                ...chart,
                ...(title ? { title } : {}),
                option,
            };
        }
        default: {
            const _exhaustive = current;
            return _exhaustive;
        }
    }
};
const parseJsonValue = (value) => {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
        return value;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
};
const parsePlainObject = (value) => sanitizePlainObject(parseJsonValue(value));
const applyTablePatch = (table, style, reshape, pruneEmpty, language = 'fr') => {
    let next = style ? { ...table, option: { ...table.option, ...style } } : table;
    if (reshape) {
        const reshaped = reshapePremiumTable(next, reshape);
        if (typeof reshaped === 'string')
            return reshaped;
        next = reshaped;
    }
    if (!pruneEmpty)
        return { block: applyTableHeat(next, language), dropped: [] };
    const pruned = pruneEmptyTableColumns(next);
    return { block: applyTableHeat(pruned.block, language), dropped: pruned.dropped };
};
const patchTables = (state, opts) => {
    const tables = state.document.blocks.filter((block) => block.type === PREMIUM_BLOCK_TYPE.TABLE && (!opts.id || block.id === opts.id));
    if (tables.length === 0) {
        return JSON.stringify({ error: opts.id ? 'block not found' : 'no table to update' });
    }
    const blockIndex = new Map(state.document.blocks.map((b, i) => [b.id, i]));
    const ids = [];
    const droppedAll = [];
    for (const table of tables) {
        const before = opts.id ? JSON.stringify(table) : null;
        const patched = applyTablePatch(table, opts.style, opts.reshape, opts.pruneEmpty, state.language);
        if (typeof patched === 'string')
            return patched;
        if (before && JSON.stringify(patched.block) === before && !patched.dropped.length) {
            return JSON.stringify({
                ok: true,
                unchanged: true,
                id: table.id,
                hint: 'No-op rename/style — continue, do not retry update_block.',
            });
        }
        const index = blockIndex.get(table.id);
        if (index !== undefined)
            state.document.blocks[index] = patched.block;
        ids.push(table.id);
        droppedAll.push(...patched.dropped);
    }
    const dropped = droppedAll.length ? { droppedEmptyColumns: [...new Set(droppedAll)] } : {};
    if (opts.id) {
        const block = state.document.blocks.find((b) => b.id === opts.id);
        return JSON.stringify({ ok: true, id: opts.id, columns: block.columns, option: block.option, ...dropped });
    }
    return JSON.stringify({ ok: true, blocks: ids, ...dropped });
};
const readTableReshape = (input) => {
    const columns = readStringList(input.columns);
    const dropColumns = readStringList(input.dropColumns);
    const renameRaw = parsePlainObject(input.renameColumns);
    const renameColumns = renameRaw
        ? Object.fromEntries(Object.entries(renameRaw).flatMap(([from, to]) => typeof to === 'string' && to.trim() ? [[from, to.trim()]] : []))
        : undefined;
    if (!columns.length && !dropColumns.length && !Object.keys(renameColumns ?? {}).length)
        return undefined;
    return {
        ...(columns.length ? { columns } : {}),
        ...(dropColumns.length ? { dropColumns } : {}),
        ...(renameColumns && Object.keys(renameColumns).length ? { renameColumns } : {}),
    };
};
const readTableStyle = (input) => {
    const hasStyleIntent = input.option != null ||
        input.header != null ||
        input.columnStyles != null ||
        input.border != null ||
        input.heatColors != null;
    const fromOption = parsePlainObject(input.option);
    const header = parsePlainObject(input.header) ?? parsePlainObject(fromOption?.header);
    const columnStyles = parsePlainObject(input.columnStyles) ?? parsePlainObject(fromOption?.columnStyles);
    const heatColors = parsePlainObject(input.heatColors) ??
        parsePlainObject(fromOption?.heatColors) ??
        parsePlainObject(parsePlainObject(fromOption?.heatLegend)?.colors);
    const out = { ...(fromOption ?? {}) };
    delete out.cellRules;
    if (header)
        out.header = header;
    if (columnStyles)
        out.columnStyles = columnStyles;
    if (heatColors) {
        const prevLegend = parsePlainObject(out.heatLegend) ?? {};
        out.heatLegend = { ...prevLegend, colors: heatColors };
    }
    delete out.heatColors;
    if (input.border != null)
        out.border = parseJsonValue(input.border);
    if (Object.keys(out).length === 0) {
        if (!hasStyleIntent)
            return undefined;
        return JSON.stringify({ error: 'Pass header, columnStyles, heatColors, and/or border=true' });
    }
    return out;
};
const readTableRows = (value, columnCount) => {
    if (!Array.isArray(value) || columnCount === 0)
        return [];
    return value.flatMap((row) => {
        if (!Array.isArray(row))
            return [];
        const cells = row.slice(0, columnCount).map((cell) => {
            if (cell === null || cell === undefined)
                return null;
            if (typeof cell === 'number')
                return Number.isFinite(cell) ? cell : null;
            if (typeof cell === 'string')
                return cell;
            if (cell instanceof Date && !Number.isNaN(cell.getTime()))
                return cell.toISOString().slice(0, 10);
            return String(cell);
        });
        return [cells];
    });
};
//# sourceMappingURL=tools_document.js.map