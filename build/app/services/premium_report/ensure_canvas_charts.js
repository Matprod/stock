import { pickAthleteColumn, pickPreferredSeriesColumn, } from '#constants/premium_report_metrics';
import { PREMIUM_BLOCK_TYPE, PREMIUM_CHART_PRESET } from '#constants/premium_report.constants';
import { buildPresetFromDataset, pickCategoryColumn, pickValueColumns, } from '#services/premium_report/chart_presets';
import { pickDateColumn, toNumber, trimDatasetRows } from '#services/premium_report/dataset_ops';
import { bindChartDataset, insertBlock, newBlockId, } from '#services/premium_report/premium_report_document';
import { chartDisplayRowCap } from '#services/premium_report/premium_report_viz_validator';
export const chartBlockCount = (blocks) => blocks.filter((block) => block.type === PREMIUM_BLOCK_TYPE.CHART).length;
const pickSeriesValueColumn = (dataset, category) => pickPreferredSeriesColumn(dataset.columns) ?? pickValueColumns(dataset, category)[0];
const topAthletesByValue = (dataset, athleteColumn, valueColumn, limit) => {
    const byName = new Map();
    for (const row of dataset.rows) {
        const name = String(row[athleteColumn] ?? '').trim();
        if (!name)
            continue;
        const value = toNumber(row[valueColumn]) ?? 0;
        const entry = byName.get(name);
        if (!entry) {
            byName.set(name, { max: value, rows: [row] });
            continue;
        }
        entry.rows.push(row);
        if (value > entry.max)
            entry.max = value;
    }
    return [...byName.entries()]
        .sort((left, right) => right[1].max - left[1].max)
        .slice(0, limit)
        .map(([name, entry]) => ({ name, rows: entry.rows }));
};
const insertLineChart = (state, dataset, title, valueColumn) => {
    const dateColumn = pickDateColumn(dataset.columns);
    if (!dateColumn)
        return false;
    const capped = trimDatasetRows(dataset, chartDisplayRowCap(PREMIUM_CHART_PRESET.LINE, dataset.columns)).dataset;
    if (capped.rows.length < 2)
        return false;
    const built = buildPresetFromDataset(PREMIUM_CHART_PRESET.LINE, capped, dateColumn, [valueColumn], 'mean', state.language);
    if (typeof built === 'string')
        return false;
    const block = {
        id: newBlockId(),
        type: PREMIUM_BLOCK_TYPE.CHART,
        title: title.slice(0, 200),
        option: bindChartDataset(built, capped, state.language),
    };
    const result = insertBlock(state.document, block, 'end');
    if (!result.includes('"ok":true'))
        return false;
    state.lastInsertedId = block.id;
    return true;
};
export const ensureTimeSeriesCharts = (state) => {
    if (!state.timeSeriesAsk || chartBlockCount(state.document.blocks) > 0)
        return 0;
    let best;
    let bestScore = -1;
    for (const dataset of state.datasets.values()) {
        const dateColumn = pickDateColumn(dataset.columns);
        if (!dateColumn || dataset.rows.length < 3)
            continue;
        const preferred = pickPreferredSeriesColumn(dataset.columns);
        const score = (preferred ? 1000 : 0) + dataset.rows.length;
        if (score > bestScore) {
            bestScore = score;
            best = dataset;
        }
    }
    if (!best)
        return 0;
    const dateColumn = pickDateColumn(best.columns);
    if (!dateColumn)
        return 0;
    const valueColumn = pickSeriesValueColumn(best, pickCategoryColumn(best) ?? dateColumn);
    if (!valueColumn)
        return 0;
    const athleteColumn = pickAthleteColumn(best.columns);
    if (athleteColumn) {
        let added = 0;
        for (const athlete of topAthletesByValue(best, athleteColumn, valueColumn, 3)) {
            const slice = { ...best, rows: athlete.rows };
            if (insertLineChart(state, slice, `${athlete.name} — load over time`, valueColumn)) {
                added += 1;
            }
        }
        return added;
    }
    return insertLineChart(state, best, 'Load over time', valueColumn) ? 1 : 0;
};
//# sourceMappingURL=ensure_canvas_charts.js.map