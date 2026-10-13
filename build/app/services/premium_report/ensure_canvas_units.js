import { PREMIUM_BLOCK_TYPE, PREMIUM_VALUE_TRANSFORM_OP, } from '#constants/premium_report.constants';
import { PREMIUM_DOMAIN_CATALOG, PREMIUM_DOMAINS, } from '#constants/premium_report_domains';
import { applyValueTransform, isDistanceMetersColumn, } from '#services/premium_report/premium_report_document';
import { unitConversionFactor } from '#services/report_builder/report_units';
const METERS_TO_KM = unitConversionFactor('m', 'km') ?? 0.001;
const DOMAIN_METRIC_KEYWORDS = PREMIUM_DOMAINS.flatMap((domain) => PREMIUM_DOMAIN_CATALOG[domain].keywords);
const VIZ_VERBS = [
    'graph',
    'graphe',
    'chart',
    'courbe',
    'curve',
    'histogram',
    'heatmap',
    'radar',
    'scatter',
    'table',
    'tableau',
    'viz',
    'visuali',
    'plot',
    'barre',
    'bar chart',
    'line chart',
    'montre',
    'show',
    'affiche',
    'display',
    'donne',
    'add_',
];
const promptHas = (prompt, needles) => {
    const hay = prompt.toLowerCase();
    return needles.some((needle) => hay.includes(needle));
};
export const wantsDistanceInKm = (prompt) => promptHas(prompt, ['km', 'kilometer', 'kilometre', 'kilometers', 'kilometres']);
export const wantsCanvasEdit = (prompt) => wantsDistanceInKm(prompt) ||
    promptHas(prompt, [
        'convert',
        'scale',
        'rename',
        'update',
        'change',
        'mettre',
        'met ',
        'en metre',
        'en mètres',
        'in meters',
        'in metres',
        'to meters',
        'to metres',
    ]);
const wantsNewViz = (prompt) => promptHas(prompt, VIZ_VERBS) || promptHas(prompt, DOMAIN_METRIC_KEYWORDS);
export const mustUseToolsForPrompt = (prompt, hasExistingCanvas) => wantsCanvasEdit(prompt) || wantsNewViz(prompt) || !hasExistingCanvas;
const renameMetersToKm = (column) => {
    if (column.toLowerCase().endsWith('_m'))
        return `${column.slice(0, -2)}_km`;
    if (column.toLowerCase().includes('(m)')) {
        return column.replace(/\(m\)/gi, '(km)');
    }
    if (/metres?|meters?/i.test(column)) {
        return column.replace(/metres?/gi, 'km').replace(/meters?/gi, 'km');
    }
    if (column.toLowerCase() === 'distance')
        return 'distance_km';
    return `${column}_km`;
};
const renameMetersInLabel = (value) => value.replace(/\(m\)/gi, '(km)').replace(/_m\b/g, '_km');
const chartSource = (option) => {
    const dataset = option.dataset;
    if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset))
        return null;
    const source = dataset.source;
    if (!Array.isArray(source) || source.length === 0 || !Array.isArray(source[0]))
        return null;
    return { dataset: dataset, source };
};
const scaleAndRenameDistance = (block, columns) => {
    if (columns.length === 0)
        return null;
    const scaled = applyValueTransform(block, {
        columns,
        op: PREMIUM_VALUE_TRANSFORM_OP.MULTIPLY,
        value: METERS_TO_KM,
    });
    if (typeof scaled === 'string')
        return null;
    const rename = new Map(columns.map((column) => [column, renameMetersToKm(column)]));
    if (scaled.block.type === PREMIUM_BLOCK_TYPE.CHART) {
        const parsed = chartSource(scaled.block.option);
        if (!parsed)
            return null;
        const header = parsed.source[0].map((cell) => {
            const name = String(cell ?? '');
            return rename.get(name) ?? name;
        });
        const option = {
            ...scaled.block.option,
            dataset: { ...parsed.dataset, source: [header, ...parsed.source.slice(1)] },
        };
        if (typeof option.title === 'string')
            option.title = renameMetersInLabel(option.title);
        return {
            ...scaled.block,
            title: renameMetersInLabel(scaled.block.title),
            option,
        };
    }
    if (scaled.block.type === PREMIUM_BLOCK_TYPE.TABLE) {
        return {
            ...scaled.block,
            columns: scaled.block.columns.map((column) => rename.get(column) ?? column),
            title: scaled.block.title ? renameMetersInLabel(scaled.block.title) : scaled.block.title,
        };
    }
    return null;
};
export const ensureDistanceColumnsInKm = (document) => {
    let changed = 0;
    document.blocks = document.blocks.map((block) => {
        if (block.type === PREMIUM_BLOCK_TYPE.CHART) {
            const parsed = chartSource(block.option);
            if (!parsed)
                return block;
            const columns = parsed.source[0]
                .map((cell) => String(cell ?? ''))
                .filter(isDistanceMetersColumn);
            const next = scaleAndRenameDistance(block, columns);
            if (!next)
                return block;
            changed += 1;
            return next;
        }
        if (block.type === PREMIUM_BLOCK_TYPE.TABLE) {
            const next = scaleAndRenameDistance(block, block.columns.filter(isDistanceMetersColumn));
            if (!next)
                return block;
            changed += 1;
            return next;
        }
        return block;
    });
    return changed;
};
//# sourceMappingURL=ensure_canvas_units.js.map