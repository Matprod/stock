import { randomUUID } from 'node:crypto';
import { PREMIUM_BLOCK_TYPE, PREMIUM_REPORT_MAX_BLOCKS, PREMIUM_REPORT_MAX_CHARTS, PREMIUM_REPORT_MAX_DATASET_ROWS, PREMIUM_REPORT_MAX_HEADING_LENGTH, PREMIUM_REPORT_MAX_TABLE_COLS, PREMIUM_REPORT_MAX_TABLE_ROWS, PREMIUM_REPORT_MAX_TEXT_LENGTH, isPremiumBlockType, } from '#constants/premium_report.constants';
import { parseReportColor } from '#constants/report_builder.constants';
import { aggregateRowsByCategory, pickCategoryColumn, pickValueColumns } from '#services/premium_report/chart_presets';
import { relabelDatasetColumns, relabelTableColumns } from '#services/premium_report/column_labels';
import { columnStats, formatDisplayCell, isIdColumnName, pruneEmptyMetricColumns, sortDatasetByDate, toNumber, } from '#services/premium_report/dataset_ops';
export const implausibleMetricWarning = (dataset, dateRange) => {
    const days = daysInRange(dateRange.from, dateRange.to);
    const checks = [
        { match: isMinutesColumnName, cap: days * 180, unit: 'min' },
        { match: isDistanceKmColumn, cap: days * 30, unit: 'km' },
        { match: isDistanceMetersColumn, cap: days * 30_000, unit: 'm' },
    ];
    for (const check of checks) {
        for (const column of dataset.columns) {
            if (!check.match(column))
                continue;
            const median = columnStats(dataset.rows, column)?.median;
            if (median === undefined || median <= check.cap)
                continue;
            return `"${column}" implausible (median ${Math.round(median)} ${check.unit} / ${days}d, cap ${check.cap}). Prefer fetch_* macros; avoid multi JOIN SUM.`;
        }
    }
    return undefined;
};
const daysInRange = (from, to) => {
    const start = Date.parse(from);
    const end = Date.parse(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return 31;
    return Math.round((end - start) / 86_400_000) + 1;
};
const isMinutesColumnName = (column) => /(^|_)min(ute|utes|s)?(_|$)|duree_min|minutes_jou|temps_de_jeu/i.test(column);
export const isDistanceMetersColumn = (column) => /total_?distance(_m)?|distance(_m)?|distance\s*\(m\)|distance totale\s*\(m\)|^distance$/i.test(column) && !/\bkm\b|_km\b|distance\s*\(km\)|per_?min|hsr|band|rel/i.test(column);
const isDistanceKmColumn = (column) => /distance.*_?km|km.*distance|total_distance_km|distance\s*\(km\)/i.test(column);
export const emptyPremiumDocument = (dateRange, athleteIds) => ({
    title: '',
    dateRange: { from: dateRange.from, to: dateRange.to },
    ...(athleteIds?.length ? { athleteIds: [...athleteIds] } : {}),
    blocks: [],
});
export const clonePremiumDocument = (document) => structuredClone(document);
export const compactPremiumDocument = (document) => ({
    title: document.title,
    dateRange: document.dateRange,
    ...(document.athleteIds?.length ? { athleteCount: document.athleteIds.length } : {}),
    blocks: document.blocks.map((block) => {
        if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
            return { id: block.id, type: block.type, title: block.title, series: seriesTypes(block.option) };
        }
        if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
            return {
                id: block.id,
                type: block.type,
                title: block.title,
                columns: block.columns,
                rowCount: block.rows.length,
                option: block.option ?? {},
            };
        }
        return {
            id: block.id,
            type: block.type,
            text: block.text.slice(0, 120),
            ...(block.type === PREMIUM_BLOCK_TYPE.HEADING ? { level: block.level ?? 1 } : {}),
        };
    }),
});
export const insertBlock = (document, block, after) => {
    if (document.blocks.length >= PREMIUM_REPORT_MAX_BLOCKS) {
        return JSON.stringify({
            error: `Report already has ${PREMIUM_REPORT_MAX_BLOCKS} blocks`,
        });
    }
    if (block.type === PREMIUM_BLOCK_TYPE.CHART &&
        document.blocks.filter((item) => item.type === PREMIUM_BLOCK_TYPE.CHART).length >=
            PREMIUM_REPORT_MAX_CHARTS) {
        return JSON.stringify({
            error: `Report already has ${PREMIUM_REPORT_MAX_CHARTS} charts`,
        });
    }
    const index = insertIndex(document.blocks, after);
    document.blocks = [...document.blocks.slice(0, index), block, ...document.blocks.slice(index)];
    return JSON.stringify({ ok: true, id: block.id });
};
export const sanitizeIncomingDocument = (raw, fallbackRange, language = 'fr') => {
    if (!raw)
        return emptyPremiumDocument(fallbackRange);
    const dateRange = {
        from: raw.dateRange?.from || fallbackRange.from,
        to: raw.dateRange?.to || fallbackRange.to,
    };
    const blocks = (raw.blocks ?? [])
        .flatMap((block) => sanitizeBlock(block, language))
        .slice(0, PREMIUM_REPORT_MAX_BLOCKS);
    return {
        title: raw.title?.trim() ?? '',
        dateRange,
        ...(raw.athleteIds?.length ? { athleteIds: [...raw.athleteIds] } : {}),
        blocks,
    };
};
export const newBlockId = () => randomUUID();
const ISO_DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const pad2 = (n) => String(n).padStart(2, '0');
const formatUtcDate = (value) => {
    const date = `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
    if (!value.getUTCHours() && !value.getUTCMinutes() && !value.getUTCSeconds())
        return date;
    return `${date} ${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
};
const toDisplayDate = (value) => {
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? value : formatUtcDate(value);
    if (typeof value !== 'string')
        return value;
    const match = ISO_DATE_TIME_RE.exec(value.trim());
    if (!match)
        return value;
    const date = match[1];
    const hour = match[2];
    const minute = match[3];
    const second = match[4];
    if (!hour || (hour === '00' && minute === '00' && (!second || second === '00')))
        return date;
    return `${date} ${hour}:${minute}`;
};
export const sanitizePlainObject = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 12)
        return undefined;
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype')
            continue;
        const cleaned = sanitizeJsonValue(entry, depth + 1);
        if (cleaned !== undefined)
            out[key] = cleaned;
    }
    return out;
};
export const datasetToSource = (dataset) => {
    const rows = dataset.rows.slice(0, PREMIUM_REPORT_MAX_DATASET_ROWS);
    return [
        dataset.columns,
        ...rows.map((row) => dataset.columns.map((column) => toCell(row[column]))),
    ];
};
export const toDisplayChartDataset = (dataset) => {
    const rows = dataset.rows.map((row) => {
        const next = { ...row };
        const joueur = playerLabel(row);
        if (joueur)
            next.joueur = joueur;
        const seconds = firstDurationSeconds(next);
        if (seconds != null && next.minutes == null)
            next.minutes = Math.round(seconds / 60);
        for (const column of Object.keys(next)) {
            next[column] = toDisplayDate(next[column]);
            if (shouldHideColumn(column, next[column], joueur))
                delete next[column];
        }
        return next;
    });
    const columns = [];
    const seen = new Set();
    for (const row of rows) {
        for (const column of Object.keys(row)) {
            if (seen.has(column))
                continue;
            seen.add(column);
            columns.push(column);
        }
    }
    if (seen.has('joueur')) {
        columns.splice(columns.indexOf('joueur'), 1);
        columns.unshift('joueur');
    }
    return { ...dataset, columns, rows };
};
export const mergeChartDatasets = (datasets) => {
    const prepared = datasets.map(toDisplayChartDataset);
    if (prepared.length === 1)
        return prepared[0];
    const category = pickCategoryColumn(prepared[0]);
    const columns = [category];
    const columnSet = new Set(columns);
    const units = {};
    const rowsByKey = new Map();
    for (const dataset of prepared) {
        if (dataset.units)
            Object.assign(units, dataset.units);
        const cat = pickCategoryColumn(dataset, category);
        for (const column of dataset.columns) {
            if (column !== cat && column !== category && !columnSet.has(column)) {
                columnSet.add(column);
                columns.push(column);
            }
        }
        for (const row of dataset.rows) {
            const key = String(row[cat] ?? '').trim();
            if (!key || isUuidText(key))
                continue;
            const current = rowsByKey.get(key) ?? { [category]: key };
            for (const column of dataset.columns) {
                if (column === cat)
                    continue;
                current[column] = row[column];
            }
            current[category] = key;
            rowsByKey.set(key, current);
        }
    }
    return {
        id: prepared.map((dataset) => dataset.id).join('+'),
        columns,
        rows: [...rowsByKey.values()],
        ...(Object.keys(units).length ? { units } : {}),
    };
};
export const bindChartDataset = (option, dataset, language = 'fr') => {
    if (hasPrebuiltSeriesData(option)) {
        return stripUuidLabels({
            ...option,
            animation: false,
            backgroundColor: option.backgroundColor ?? '#ffffff',
        });
    }
    let display = sortDatasetByDate(relabelDatasetColumns(toDisplayChartDataset(dataset), language));
    const category = pickCategoryColumn(display);
    const columns = new Set(display.columns);
    if (isBarLikeOption(option) && display.rows.length > 0) {
        const valueColumns = pickValueColumns(display, category);
        const aggregated = aggregateRowsByCategory(display.rows, category, valueColumns);
        if (aggregated.length !== display.rows.length) {
            display = { ...display, rows: aggregated };
        }
    }
    const series = Array.isArray(option.series)
        ? option.series.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item))
                return item;
            const next = { ...item };
            next.encode = remapEncode(next.encode, columns, category);
            const encode = next.encode;
            const boundY = encode?.y ?? encode?.value;
            if (typeof boundY === 'string' && columns.has(boundY))
                delete next.data;
            return next;
        })
        : option.series;
    return stripUuidLabels({
        ...option,
        animation: false,
        backgroundColor: option.backgroundColor ?? '#ffffff',
        dataset: { source: datasetToSource(display) },
        ...(series !== undefined ? { series } : {}),
    });
};
const isBarLikeOption = (option) => {
    const series = option.series;
    const items = Array.isArray(series) ? series : series ? [series] : [];
    if (items.length === 0)
        return false;
    return items.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return false;
        const type = item.type;
        return type === 'bar' || type === 'line';
    }) && items.some((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return false;
        return item.type === 'bar';
    });
};
const hasPrebuiltSeriesData = (option) => {
    const xAxis = option.xAxis;
    const xData = xAxis && typeof xAxis === 'object' && !Array.isArray(xAxis)
        ? xAxis.data
        : undefined;
    const series = option.series;
    const items = Array.isArray(series) ? series : series ? [series] : [];
    if (Array.isArray(xData) && xData.length > 0) {
        const hasLineData = items.some((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item))
                return false;
            const typed = item;
            return typed.type === 'line' && Array.isArray(typed.data) && typed.data.length > 0;
        });
        if (hasLineData)
            return true;
    }
    return items.some((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return false;
        const type = item.type;
        const data = item.data;
        return ((type === 'heatmap' || type === 'radar') && Array.isArray(data) && data.length > 0);
    });
};
export const stripUuidLabels = (option) => sanitizePlainObject(replaceUuidValues(option)) ?? option;
export const tableFromDataset = (dataset, language = 'fr') => {
    const pruned = pruneEmptyMetricColumns(dataset);
    const display = relabelDatasetColumns(toDisplayChartDataset(pruned.dataset), language);
    return {
        columns: display.columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS),
        rows: display.rows
            .slice(0, PREMIUM_REPORT_MAX_TABLE_ROWS)
            .map((row) => display.columns
            .slice(0, PREMIUM_REPORT_MAX_TABLE_COLS)
            .map((column) => toCell(row[column]))),
        ...(pruned.dropped.length ? { droppedEmptyColumns: pruned.dropped } : {}),
    };
};
const COUNT_COLUMN_RE = /^(jours?|nuits?|entrees?|entries?|nb_?\s*sessions?|nb_|n_|count|nb |n$)/i;
const LABEL_COLUMN_RE = /^(joueur|player|name|athlete|athlète|biomarqueur|biomarker|test_type|type de test|poste|position|unit|unité|label|date|activité|activite|activity)$/i;
const RISK_COLUMN_RE = /risque|risk|courbature|soreness|stress|qualite_sommeil|qualité_sommeil|qualité sommeil|monoton|strain|acwr|fatigue/i;
export const PREMIUM_HEAT_COLORS = {
    volumeMid: '#C8E6D5',
    volumeHigh: '#2F9E6F',
    riskMid: '#F5D0A9',
    riskHigh: '#E07070',
};
export const resolveHeatColors = (option) => {
    const legend = isPlainRecord(option?.heatLegend) ? option.heatLegend : undefined;
    const raw = isPlainRecord(legend?.colors)
        ? legend.colors
        : isPlainRecord(option?.heatColors)
            ? option.heatColors
            : undefined;
    const pick = (key, fallback) => {
        const value = raw?.[key];
        return typeof value === 'string' ? (parseReportColor(value) ?? fallback) : fallback;
    };
    return {
        volumeMid: pick('volumeMid', PREMIUM_HEAT_COLORS.volumeMid),
        volumeHigh: pick('volumeHigh', PREMIUM_HEAT_COLORS.volumeHigh),
        riskMid: pick('riskMid', PREMIUM_HEAT_COLORS.riskMid),
        riskHigh: pick('riskHigh', PREMIUM_HEAT_COLORS.riskHigh),
    };
};
export const applyTableHeat = (block, language = 'fr') => {
    const colors = resolveHeatColors(block.option);
    const cells = block.rows.map(() => []);
    let heated = false;
    let hasRisk = false;
    for (let c = 0; c < block.columns.length; c++) {
        const col = block.columns[c] ?? '';
        if (LABEL_COLUMN_RE.test(col) || COUNT_COLUMN_RE.test(col))
            continue;
        const values = [];
        for (let r = 0; r < block.rows.length; r++) {
            const n = toNumber(block.rows[r]?.[c]);
            if (n != null)
                values.push({ row: r, value: n });
        }
        if (values.length < 3)
            continue;
        const invert = RISK_COLUMN_RE.test(col);
        if (invert)
            hasRisk = true;
        const ranked = [...values].sort((left, right) => invert ? left.value - right.value : right.value - left.value);
        const highCount = Math.max(1, Math.ceil(ranked.length * 0.15));
        const midCount = Math.max(highCount + 1, Math.ceil(ranked.length * 0.35));
        for (let i = 0; i < midCount; i++) {
            const entry = ranked[i];
            if (!entry)
                continue;
            heated = true;
            cells[entry.row][c] = {
                background: heatColor(i < highCount, invert, colors),
            };
        }
    }
    const prev = isPlainRecord(block.option) ? { ...block.option } : {};
    delete prev.cellRules;
    delete prev.heatColors;
    const formattedRows = block.rows.map((row) => row.map((cell) => formatDisplayCell(cell, language)));
    return {
        ...block,
        rows: formattedRows,
        option: {
            ...prev,
            cells,
            border: prev.border ?? true,
            ...(heated
                ? {
                    heatLegend: {
                        mode: 'relative',
                        hasRisk,
                        colors,
                    },
                }
                : { heatLegend: undefined }),
        },
    };
};
const heatColor = (high, invert, colors) => {
    if (invert)
        return high ? colors.riskHigh : colors.riskMid;
    return high ? colors.volumeHigh : colors.volumeMid;
};
export const applyValueTransform = (block, args) => {
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
        const option = applyTransformToChartOption(block.option, args);
        if (typeof option === 'string')
            return option;
        return { block: { ...block, option: option.option }, cells: option.cells };
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
        const next = mapTransformCells(block.rows, block.columns, args);
        if (typeof next === 'string')
            return next;
        return { block: { ...block, rows: next.rows }, cells: next.cells };
    }
    return JSON.stringify({ error: 'transform_values only applies to charts and tables' });
};
const mapTransformCells = (rows, columns, args) => {
    const wanted = args.columns?.length ? new Set(args.columns) : null;
    const indexes = columns.flatMap((column, index) => (!wanted || wanted.has(column) ? [index] : []));
    if (indexes.length === 0)
        return JSON.stringify({ error: 'no matching columns' });
    const indexSet = new Set(indexes);
    let cells = 0;
    const nextRows = rows.map((row) => row.map((cell, index) => {
        if (!indexSet.has(index))
            return cell;
        const next = transformNumber(cell, args.op, args.value);
        if (next === undefined)
            return cell;
        cells += 1;
        return next;
    }));
    return { rows: nextRows, cells };
};
const applyTransformToChartOption = (option, args) => {
    const dataset = option.dataset;
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
        return JSON.stringify({ error: 'chart has no dataset.source to transform' });
    }
    const source = dataset.source;
    if (!Array.isArray(source) || source.length < 2 || !Array.isArray(source[0])) {
        return JSON.stringify({ error: 'chart has no dataset.source to transform' });
    }
    const header = source[0].map((cell) => String(cell ?? ''));
    const wanted = args.columns?.length
        ? new Set(args.columns)
        : new Set(header.filter((_, index) => source.slice(1).some((row) => Array.isArray(row) && toNumber(row[index]) != null)));
    const mapped = mapTransformCells(source.slice(1).map((row) => (Array.isArray(row) ? row : [])), header, { ...args, columns: [...wanted] });
    if (typeof mapped === 'string')
        return mapped;
    return {
        cells: mapped.cells,
        option: {
            ...option,
            dataset: {
                ...dataset,
                source: [header, ...mapped.rows],
            },
        },
    };
};
export const reshapePremiumTable = (block, args) => {
    let cols = block.columns.map((name, index) => ({ index, name }));
    const rename = args.renameColumns ?? {};
    for (const [from, to] of Object.entries(rename)) {
        if (!to.trim())
            continue;
        for (const col of cols) {
            if (sameColumnName(col.name, from))
                col.name = to.trim();
        }
    }
    if (args.dropColumns?.length) {
        const next = cols.filter((col) => !args.dropColumns.some((name) => sameColumnName(name, col.name)));
        if (next.length === cols.length) {
            return JSON.stringify({ error: `no columns to drop (have: ${block.columns.join(', ')})` });
        }
        cols = next;
    }
    if (args.columns?.length) {
        const picked = [];
        const missing = [];
        for (const wanted of args.columns) {
            const found = cols.find((col) => !picked.some((item) => item.index === col.index) && sameColumnName(col.name, wanted));
            if (!found) {
                missing.push(wanted);
                continue;
            }
            picked.push({ index: found.index, name: found.name });
        }
        if (missing.length > 0) {
            return JSON.stringify({
                error: 'columns must match current headers (use renameColumns for labels)',
                missing,
                have: cols.map((col) => col.name),
            });
        }
        cols = picked;
    }
    if (cols.length === 0)
        return JSON.stringify({ error: 'table would have no columns' });
    const renameMap = new Map();
    for (const col of cols) {
        renameMap.set(block.columns[col.index], col.name);
    }
    return {
        ...block,
        columns: cols.map((col) => col.name),
        rows: block.rows.map((row) => cols.map((col) => row[col.index] ?? null)),
        ...(block.option ? { option: remapTableOptionNames(block.option, renameMap) } : {}),
    };
};
export const pruneEmptyTableColumns = (block) => {
    const asDataset = {
        id: 'tmp',
        columns: block.columns,
        rows: block.rows.map((row) => Object.fromEntries(block.columns.map((col, i) => [col, row[i] ?? null]))),
    };
    const { dataset, dropped } = pruneEmptyMetricColumns(asDataset);
    if (dropped.length === 0)
        return { block, dropped };
    return {
        block: {
            ...block,
            columns: dataset.columns,
            rows: dataset.rows.map((row) => dataset.columns.map((col) => {
                const cell = row[col];
                if (cell == null)
                    return null;
                if (typeof cell === 'string' || typeof cell === 'number')
                    return cell;
                return String(cell);
            })),
        },
        dropped,
    };
};
export const resolveTableBorder = (option) => {
    if (!option || option.border === false || option.border == null)
        return undefined;
    if (option.border === true)
        return { color: '#94a3b8', width: 1 };
    if (typeof option.border === 'string') {
        const color = sanitizeCssColor(option.border);
        return color ? { color, width: 1 } : { color: '#94a3b8', width: 1 };
    }
    if (!isPlainRecord(option.border))
        return undefined;
    const color = sanitizeCssColor(option.border.color) ?? '#94a3b8';
    const width = typeof option.border.width === 'number' && option.border.width > 0 ? option.border.width : 1;
    return { color, width };
};
const sameColumnName = (left, right) => columnKey(left) === columnKey(right);
const columnKey = (value) => value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[_\s-]+/g, '');
const remapTableOptionNames = (option, renameMap) => {
    const next = { ...option };
    delete next.cellRules;
    if (isPlainRecord(option.columnStyles)) {
        const columnStyles = {};
        for (const [key, value] of Object.entries(option.columnStyles)) {
            columnStyles[renameMap.get(key) ?? key] = value;
        }
        next.columnStyles = columnStyles;
    }
    return next;
};
export const resolveTableHeaderStyle = (option) => readCellStyle(option?.header);
export const resolveTableCellStyle = (args) => {
    const option = args.option ?? {};
    const columnMap = isPlainRecord(option.columnStyles) ? option.columnStyles : undefined;
    const fromColumn = columnMap ? readCellStyle(columnMap[args.column]) : {};
    const fromCell = readSparseCellStyle(option.cells, args.rowIndex, args.colIndex);
    return { ...fromColumn, ...fromCell };
};
const readSparseCellStyle = (cells, rowIndex, colIndex) => {
    if (!Array.isArray(cells) || !Array.isArray(cells[rowIndex]))
        return {};
    return readCellStyle(cells[rowIndex][colIndex]);
};
const readCellStyle = (value) => {
    if (!isPlainRecord(value))
        return {};
    const style = {};
    const background = sanitizeCssColor(value.background);
    const text = sanitizeCssColor(value.color);
    if (background)
        style.background = background;
    else if (text)
        style.background = text;
    if (background && text) {
        style.color = text;
    }
    else if (background) {
        style.color = isLightColor(background) ? '#111827' : '#ffffff';
    }
    if (value.bold === true)
        style.bold = true;
    if (value.align === 'left' || value.align === 'center' || value.align === 'right') {
        style.align = value.align;
    }
    return style;
};
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const isLightColor = (hex) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.35;
};
const isPlainRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_COLOR_NAMES = {
    red: '#ef4444',
    rouge: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    jaune: '#eab308',
    green: '#22c55e',
    vert: '#22c55e',
    blue: '#3b82f6',
    bleu: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    white: '#ffffff',
    black: '#111827',
    gray: '#6b7280',
    grey: '#6b7280',
};
const sanitizeCssColor = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim().toLowerCase();
    if (HEX_COLOR_RE.test(trimmed))
        return trimmed;
    return CSS_COLOR_NAMES[trimmed];
};
const transformNumber = (value, op, factor) => {
    const numeric = toNumber(value);
    if (numeric == null)
        return undefined;
    if (op === 'round')
        return Math.round(numeric);
    if (op === 'floor')
        return Math.floor(numeric);
    if (op === 'ceil')
        return Math.ceil(numeric);
    if (factor == null || !Number.isFinite(factor))
        return undefined;
    if (op === 'multiply')
        return numeric * factor;
    if (op === 'divide')
        return factor === 0 ? undefined : numeric / factor;
    if (op === 'add')
        return numeric + factor;
    return numeric - factor;
};
export const stripMarkdownDecorations = (value) => value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1');
const sanitizeBlock = (block, language = 'fr') => {
    if (!isPremiumBlockType(block.type) || !block.id)
        return [];
    if (block.type === PREMIUM_BLOCK_TYPE.HEADING) {
        const text = stripMarkdownDecorations(block.text ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, PREMIUM_REPORT_MAX_HEADING_LENGTH);
        if (!text)
            return [];
        const level = block.level === 2 ? 2 : 1;
        return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.HEADING, text, level }];
    }
    if (block.type === PREMIUM_BLOCK_TYPE.TEXT) {
        const text = stripMarkdownDecorations(block.text ?? '')
            .replace(/\r\n/g, '\n')
            .trim()
            .slice(0, PREMIUM_REPORT_MAX_TEXT_LENGTH);
        if (!text)
            return [];
        return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.TEXT, text }];
    }
    if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
        const option = stripUuidLabels(sanitizePlainObject(block.option) ?? {});
        const title = stripMarkdownDecorations(block.title ?? '')
            .replace(/\s+/g, ' ')
            .trim() || 'Chart';
        if (Object.keys(option).length === 0)
            return [];
        return [{ id: block.id, type: PREMIUM_BLOCK_TYPE.CHART, title, option }];
    }
    const columns = relabelTableColumns((block.columns ?? []).map((column) => String(column).trim()).filter(Boolean), language);
    if (columns.length === 0)
        return [];
    const option = sanitizeTableOption(block);
    const table = {
        id: block.id,
        type: PREMIUM_BLOCK_TYPE.TABLE,
        title: block.title?.trim() || undefined,
        columns: columns.slice(0, PREMIUM_REPORT_MAX_TABLE_COLS),
        rows: (block.rows ?? [])
            .slice(0, PREMIUM_REPORT_MAX_TABLE_ROWS)
            .map((row) => columns
            .slice(0, PREMIUM_REPORT_MAX_TABLE_COLS)
            .map((_, index) => toCell(row[index]))),
        ...(option ? { option } : {}),
    };
    if (isPlainRecord(option?.heatLegend)) {
        return [
            {
                ...table,
                rows: table.rows.map((row) => row.map((cell) => formatDisplayCell(cell, language))),
            },
        ];
    }
    return [applyTableHeat(table, language)];
};
const sanitizeTableOption = (block) => {
    const fromOption = sanitizePlainObject(block.option);
    return fromOption && Object.keys(fromOption).length > 0 ? fromOption : undefined;
};
const insertIndex = (blocks, after) => {
    if (!after || after === 'end')
        return blocks.length;
    if (after === 'start')
        return 0;
    const index = blocks.findIndex((block) => block.id === after);
    return index === -1 ? blocks.length : index + 1;
};
const seriesTypes = (option) => Array.isArray(option.series)
    ? option.series.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return [];
        const type = item.type;
        return typeof type === 'string' ? [type] : [];
    })
    : [];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRST_NAME_KEYS = ['first_name', 'firstname', 'firstName'];
const LAST_NAME_KEYS = ['last_name', 'lastname', 'lastName'];
const NAME_KEYS = ['joueur', 'player', 'name', 'athlete', 'full_name', 'athlete_name'];
const isUuidText = (value) => UUID_RE.test(value.trim());
const playerLabel = (row) => {
    const first = FIRST_NAME_KEYS.map((key) => row[key]).find((v) => typeof v === 'string');
    const last = LAST_NAME_KEYS.map((key) => row[key]).find((v) => typeof v === 'string');
    const fromParts = `${first ?? ''} ${last ?? ''}`.replace(/\s+/g, ' ').trim();
    if (fromParts && !isUuidText(fromParts))
        return fromParts;
    for (const key of NAME_KEYS) {
        const value = row[key];
        if (typeof value === 'string' && value.trim() && !isUuidText(value))
            return value.trim();
    }
    return undefined;
};
const shouldHideColumn = (column, value, joueur) => {
    if (FIRST_NAME_KEYS.includes(column) || LAST_NAME_KEYS.includes(column))
        return Boolean(joueur);
    if (isIdColumnName(column))
        return true;
    if (isDurationSecondsColumn(column))
        return true;
    if (typeof value === 'string' && isUuidText(value))
        return true;
    return false;
};
const isDurationSecondsColumn = (column) => /duration_seconds|duree_seconds|duration_sec/i.test(column);
const firstDurationSeconds = (row) => {
    for (const column of Object.keys(row)) {
        if (!isDurationSecondsColumn(column))
            continue;
        const value = toNumber(row[column]);
        if (value != null)
            return value;
    }
    return null;
};
const remapEncode = (encode, columns, category) => {
    if (!encode || typeof encode !== 'object' || Array.isArray(encode))
        return encode;
    const next = { ...encode };
    for (const key of ['x', 'itemName', 'y', 'value']) {
        const column = next[key];
        if (typeof column !== 'string' || columns.has(column))
            continue;
        if (key === 'x' || key === 'itemName') {
            next[key] = category;
            continue;
        }
        const match = [...columns].find((candidate) => candidate !== category &&
            candidate.toLowerCase() === column.toLowerCase().replace(/\s+/g, '_'));
        if (match)
            next[key] = match;
    }
    return next;
};
const replaceUuidValues = (value) => {
    if (typeof value === 'string')
        return isUuidText(value) ? '' : value;
    if (Array.isArray(value))
        return value.map(replaceUuidValues);
    if (!value || typeof value !== 'object')
        return value;
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
        out[key] = replaceUuidValues(entry);
    }
    return out;
};
const sanitizeJsonValue = (value, depth) => {
    if (value === null || value === undefined)
        return null;
    const dated = toDisplayDate(value);
    if (typeof dated === 'string' || typeof dated === 'boolean')
        return dated;
    if (typeof dated === 'number')
        return Number.isFinite(dated) ? dated : null;
    if (typeof dated === 'function' || typeof dated === 'symbol')
        return undefined;
    if (Array.isArray(dated)) {
        if (depth > 12)
            return [];
        return dated
            .slice(0, PREMIUM_REPORT_MAX_DATASET_ROWS)
            .map((item) => sanitizeJsonValue(item, depth + 1));
    }
    return sanitizePlainObject(dated, depth);
};
const toCell = (value) => {
    const dated = toDisplayDate(value);
    if (dated === null || dated === undefined)
        return null;
    if (typeof dated === 'number')
        return Number.isFinite(dated) ? dated : null;
    if (typeof dated === 'boolean')
        return dated ? 1 : 0;
    if (typeof dated === 'string') {
        const trimmed = dated.trim();
        if (!trimmed)
            return '';
        if (isUuidText(trimmed))
            return '';
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            const numeric = Number(trimmed);
            if (Number.isFinite(numeric))
                return numeric;
        }
        return dated;
    }
    return String(dated);
};
//# sourceMappingURL=premium_report_document.js.map