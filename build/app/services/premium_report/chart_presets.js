import { PREMIUM_CHART_PRESET } from '#constants/premium_report.constants';
import { displayColumnLabel, relabelDatasetColumns, } from '#services/premium_report/column_labels';
import { columnStats, formatDisplayNumber, isIdColumnName, pickDateColumn, isOrdinalScore, round3, sortDatasetByDate, toNumber, } from '#services/premium_report/dataset_ops';
import { pickAthleteColumn } from '#constants/premium_report_metrics';
export const inferRefLines = (args) => {
    if (args.rowCount < 5)
        return 'none';
    if (args.chartType === 'heatmap' || args.chartType === 'scatter' || args.chartType === 'donut') {
        return 'none';
    }
    if (args.hasDate)
        return 'mean';
    if (args.chartType === 'bar' || args.chartType === 'bar-line' || args.chartType === 'radar') {
        return 'mean';
    }
    return 'none';
};
const REF_LINE_LABELS = {
    fr: { mean: 'Moyenne', median: 'Médiane', min: 'Min', max: 'Max' },
    en: { mean: 'Mean', median: 'Median', min: 'Min', max: 'Max' },
};
export const pickCategoryColumn = (dataset, preferred) => {
    const dateColumn = pickDateColumn(dataset.columns);
    const athleteColumn = pickAthleteColumn(dataset.columns);
    if (preferred && dataset.columns.includes(preferred)) {
        if (dateColumn &&
            athleteColumn &&
            preferred === athleteColumn &&
            uniqueColumnCount(dataset, athleteColumn) <= 1) {
            return dateColumn;
        }
        return preferred;
    }
    if (athleteColumn && uniqueColumnCount(dataset, athleteColumn) > 1)
        return athleteColumn;
    if (dateColumn)
        return dateColumn;
    if (athleteColumn)
        return athleteColumn;
    for (const column of ['poste', 'Poste', 'Activité', 'activity', 'Activity']) {
        if (dataset.columns.includes(column))
            return column;
    }
    return (dataset.columns.find((column) => !isNumericColumn(dataset, column) && !isIdColumnName(column)) ??
        dataset.columns[0] ??
        'Joueur');
};
export const uniqueColumnCount = (dataset, column) => new Set(dataset.rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean)).size;
export const pickValueColumns = (dataset, category, requested) => {
    if (requested?.length)
        return requested.filter((column) => dataset.columns.includes(column));
    return dataset.columns.filter((column) => column !== category && isNumericColumn(dataset, column));
};
const isNumericColumn = (dataset, column) => dataset.rows.some((row) => toNumber(row[column]) != null);
const REF_LINE_SPECS = {
    mean: [{ key: 'mean', dash: 'dashed', position: 'insideEndTop' }],
    mean_median: [
        { key: 'mean', dash: 'dashed', position: 'insideEndTop' },
        { key: 'median', dash: 'dotted', position: 'insideStartTop' },
    ],
    full: [
        { key: 'mean', dash: 'dashed', position: 'insideEndTop' },
        { key: 'median', dash: 'dotted', position: 'insideStartTop' },
        { key: 'min', dash: 'solid', position: 'insideStartTop' },
        { key: 'max', dash: 'solid', position: 'insideStartBottom' },
    ],
};
const buildRefLines = (rows, column, axis, mode, language = 'fr') => {
    if (mode === 'none')
        return [];
    const stats = columnStats(rows, column);
    if (!stats || stats.n < 3)
        return [];
    const labels = REF_LINE_LABELS[language] ?? REF_LINE_LABELS.fr;
    return REF_LINE_SPECS[mode].map((spec) => ({
        [axis]: stats[spec.key],
        name: labels[spec.key],
        label: {
            formatter: `${labels[spec.key]} ${formatDisplayNumber(stats[spec.key], language)}`,
            position: spec.position,
            fontSize: 10,
            color: '#94a3b8',
            distance: 6,
        },
        lineStyle: { type: spec.dash, width: 1.25, color: '#64748b' },
    }));
};
const attachRefLines = (seriesItem, lines) => {
    if (!lines.length)
        return seriesItem;
    return {
        ...seriesItem,
        markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: lines,
        },
    };
};
const SCALE_SPLIT_RATIO = 10;
export const aggregateRowsByCategory = (rows, category, valueColumns) => {
    const groups = new Map();
    for (const row of rows) {
        const key = String(row[category] ?? '').trim() || '—';
        const list = groups.get(key) ?? [];
        list.push(row);
        groups.set(key, list);
    }
    if ([...groups.values()].every((group) => group.length <= 1))
        return rows;
    return [...groups.entries()].map(([key, group]) => {
        const out = { [category]: key };
        for (const col of valueColumns) {
            const nums = group
                .map((row) => toNumber(row[col]))
                .filter((n) => n != null);
            out[col] =
                nums.length === 0
                    ? null
                    : round3(nums.reduce((acc, n) => acc + n, 0) / nums.length);
        }
        return out;
    });
};
const splitSeriesByScale = (columns, rows) => {
    const colMaxes = columns.map((col) => {
        let max = 0;
        for (const row of rows) {
            const n = toNumber(row[col]);
            if (n != null && n > max)
                max = n;
        }
        return { col, max };
    });
    const nonZero = colMaxes.filter(({ max }) => max > 0);
    if (nonZero.length < 2)
        return { primary: columns, secondary: [] };
    const minMax = Math.min(...nonZero.map(({ max }) => max));
    const maxMax = Math.max(...nonZero.map(({ max }) => max));
    if (maxMax / minMax <= SCALE_SPLIT_RATIO)
        return { primary: columns, secondary: [] };
    const cutoff = minMax * SCALE_SPLIT_RATIO;
    return {
        primary: colMaxes.filter(({ max }) => max <= cutoff).map(({ col }) => col),
        secondary: colMaxes.filter(({ max }) => max > cutoff).map(({ col }) => col),
    };
};
export const buildPresetChartOption = (args) => {
    const { chartType, category, values, rows } = args;
    const refLines = args.refLines ?? 'none';
    const language = args.language ?? 'fr';
    const y = values[0];
    const y2 = values[1];
    if (chartType === PREMIUM_CHART_PRESET.HEATMAP) {
        return buildEchartsHeatmapOption({
            rows: rows ?? [],
            xCol: category || 'x',
            yCol: values[0] && values[0] !== (category || 'x') ? values[0] : 'y',
            valueCol: values.find((col) => col !== category && col !== values[0]) ?? values[1] ?? 'r',
            language,
        });
    }
    if (chartType === PREMIUM_CHART_PRESET.SCATTER && y && y2) {
        const markData = rows?.length
            ? [
                ...buildRefLines(rows, y, 'xAxis', refLines, language),
                ...buildRefLines(rows, y2, 'yAxis', refLines, language),
            ]
            : [];
        return {
            legend: { show: false },
            grid: { left: 64, right: 72, top: 48, bottom: 56 },
            xAxis: { type: 'value', name: y, scale: true, nameLocation: 'middle', nameGap: 28 },
            yAxis: { type: 'value', name: y2, scale: true, nameLocation: 'middle', nameGap: 40 },
            tooltip: { trigger: 'item' },
            series: [
                attachRefLines({
                    type: 'scatter',
                    symbolSize: 14,
                    encode: {
                        x: y,
                        y: y2,
                        tooltip: category ? [category, y, y2] : [y, y2],
                    },
                }, markData),
            ],
        };
    }
    if (chartType === PREMIUM_CHART_PRESET.RADAR && values.length >= 3 && rows?.length) {
        const limited = rows.slice(0, 8);
        const indicator = values.map((col) => {
            let max = 0;
            for (const row of limited) {
                const n = Number(row[col]);
                if (Number.isFinite(n) && n > max)
                    max = n;
            }
            return { name: col, max: max > 0 ? Math.ceil(max * 1.15 * 1000) / 1000 : 1 };
        });
        return {
            legend: { top: 8, type: 'scroll' },
            tooltip: { trigger: 'item' },
            radar: { indicator, radius: '62%', center: ['50%', '55%'] },
            series: [
                {
                    type: 'radar',
                    data: limited.map((row) => ({
                        name: String(row[category] ?? ''),
                        value: values.map((col) => {
                            const n = Number(row[col]);
                            return Number.isFinite(n) ? n : 0;
                        }),
                    })),
                },
            ],
        };
    }
    if (chartType === PREMIUM_CHART_PRESET.DONUT) {
        return {
            tooltip: { trigger: 'item' },
            legend: { bottom: 0 },
            series: [
                {
                    type: 'pie',
                    radius: ['42%', '68%'],
                    encode: { itemName: category, value: y },
                    label: { formatter: '{b}\n{c}' },
                },
            ],
        };
    }
    if (chartType === PREMIUM_CHART_PRESET.BAR_LINE && y && y2) {
        const barRows = rows?.length
            ? aggregateRowsByCategory(rows, category, [y, y2])
            : undefined;
        const barMarks = barRows?.length ? buildRefLines(barRows, y, 'yAxis', refLines, language) : [];
        return {
            legend: { top: 8 },
            grid: { left: 72, right: 72, top: 44, bottom: 96 },
            xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
            yAxis: [
                { type: 'value', name: y, minInterval: 1 },
                { type: 'value', name: y2, minInterval: 1 },
            ],
            tooltip: { trigger: 'axis' },
            series: [
                attachRefLines({ name: y, type: 'bar', encode: { x: category, y } }, barMarks),
                {
                    name: y2,
                    type: 'line',
                    yAxisIndex: 1,
                    encode: { x: category, y: y2 },
                    lineStyle: { width: 3 },
                },
            ],
        };
    }
    const type = chartType === PREMIUM_CHART_PRESET.LINE ? 'line' : 'bar';
    if (type === 'line' && rows?.length && y) {
        const athleteColumn = pickAthleteColumn(Object.keys(rows[0] ?? {}));
        const athletes = athleteColumn
            ? [
                ...new Set(rows
                    .map((row) => String(row[athleteColumn] ?? '').trim())
                    .filter(Boolean)),
            ]
            : [];
        if (athletes.length > 1 && (pickDateColumn([category]) || /date/i.test(category))) {
            return buildMultiAthleteLineOption({
                rows,
                dateColumn: category,
                athleteColumn: athleteColumn,
                valueColumn: y,
                athletes: athletes.slice(0, 8),
                refLines,
                language,
            });
        }
    }
    const chartRows = type === 'bar' && rows?.length
        ? aggregateRowsByCategory(rows, category, values)
        : rows;
    const valueMarks = chartRows?.length && y ? buildRefLines(chartRows, y, 'yAxis', refLines, language) : [];
    if (chartRows?.length && values.length > 1) {
        const split = splitSeriesByScale(values, chartRows);
        if (split.secondary.length > 0) {
            return {
                legend: { top: 8 },
                grid: { left: 72, right: 80, top: 44, bottom: 96 },
                xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
                yAxis: [
                    { type: 'value' },
                    { type: 'value', position: 'right', axisLine: { show: true }, splitLine: { show: false } },
                ],
                tooltip: { trigger: 'axis' },
                series: [
                    ...split.primary.map((col, index) => attachRefLines({ name: col, type, encode: { x: category, y: col } }, index === 0 ? valueMarks : [])),
                    ...split.secondary.map((col) => ({
                        name: col,
                        type,
                        yAxisIndex: 1,
                        encode: { x: category, y: col },
                    })),
                ],
            };
        }
    }
    return {
        legend: { top: 8 },
        grid: { left: 72, right: 72, top: 44, bottom: 96 },
        xAxis: { type: 'category', axisLabel: { rotate: 40, hideOverlap: true } },
        yAxis: { type: 'value' },
        tooltip: { trigger: 'axis' },
        series: values.map((value, index) => attachRefLines({
            name: value,
            type,
            encode: { x: category, y: value },
        }, index === 0 ? valueMarks : [])),
    };
};
const buildMultiAthleteLineOption = (args) => {
    const { rows, dateColumn, athleteColumn, valueColumn, athletes, refLines, language } = args;
    const dates = [
        ...new Set(rows.map((row) => String(row[dateColumn] ?? '').trim()).filter(Boolean)),
    ].sort((left, right) => left.localeCompare(right));
    const valueByAthleteDate = new Map();
    for (const row of rows) {
        const athlete = String(row[athleteColumn] ?? '').trim();
        const date = String(row[dateColumn] ?? '').trim();
        if (!athlete || !date)
            continue;
        const numeric = toNumber(row[valueColumn]);
        if (numeric == null)
            continue;
        valueByAthleteDate.set(`${athlete}\0${date}`, numeric);
    }
    const flatValues = athletes.flatMap((athlete) => dates
        .map((date) => valueByAthleteDate.get(`${athlete}\0${date}`))
        .filter((value) => value != null));
    const markRows = flatValues.map((value) => ({ [valueColumn]: value }));
    const marks = buildRefLines(markRows, valueColumn, 'yAxis', refLines, language);
    return {
        legend: { top: 8, type: 'scroll' },
        grid: { left: 72, right: 72, top: 64, bottom: 96 },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { rotate: 40, hideOverlap: true },
        },
        yAxis: { type: 'value' },
        tooltip: { trigger: 'axis' },
        series: athletes.map((athlete, index) => attachRefLines({
            name: athlete,
            type: 'line',
            data: dates.map((date) => valueByAthleteDate.get(`${athlete}\0${date}`) ?? null),
            connectNulls: false,
            showSymbol: true,
            symbolSize: 6,
        }, index === 0 ? marks : [])),
    };
};
export const buildEchartsHeatmapOption = (args) => {
    const { rows, xCol, yCol, valueCol } = args;
    const language = args.language ?? 'fr';
    const metrics = [];
    const seen = new Set();
    for (const row of rows) {
        for (const key of [row[xCol], row[yCol]]) {
            const label = String(key ?? '').trim();
            if (!label || seen.has(label))
                continue;
            seen.add(label);
            metrics.push(label);
        }
    }
    const indexOf = new Map(metrics.map((label, index) => [label, index]));
    const data = [];
    for (const row of rows) {
        const xi = indexOf.get(String(row[xCol] ?? '').trim());
        const yi = indexOf.get(String(row[yCol] ?? '').trim());
        if (xi == null || yi == null)
            continue;
        const raw = row[valueCol];
        const value = typeof raw === 'number'
            ? raw
            : typeof raw === 'string' && raw.trim() !== ''
                ? Number(raw)
                : NaN;
        if (!Number.isFinite(value))
            continue;
        data.push([xi, yi, Math.round(value * 1000) / 1000]);
    }
    const labels = metrics.map((value) => displayColumnLabel(value, language));
    return {
        tooltip: { position: 'top' },
        grid: { left: '18%', right: '6%', top: '6%', bottom: '22%', height: '62%' },
        xAxis: {
            type: 'category',
            data: labels,
            splitArea: { show: true },
            axisLabel: { rotate: 40, interval: 0, hideOverlap: false },
        },
        yAxis: {
            type: 'category',
            data: labels,
            splitArea: { show: true },
            inverse: true,
            axisLabel: { interval: 0 },
        },
        visualMap: {
            min: -1,
            max: 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '2%',
            itemWidth: 16,
            itemHeight: 120,
            inRange: {
                color: [
                    '#313695',
                    '#4575b4',
                    '#74add1',
                    '#abd9e9',
                    '#e0f3f8',
                    '#ffffbf',
                    '#fee090',
                    '#fdae61',
                    '#f46d43',
                    '#d73027',
                    '#a50026',
                ],
            },
            text: ['+1', '−1'],
        },
        series: [
            {
                type: 'heatmap',
                data,
                label: { show: true },
                emphasis: {
                    itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.45)' },
                },
            },
        ],
    };
};
export const inferChartType = (dataset) => {
    const cols = dataset.columns;
    const hasCorrShape = cols.includes('x') && cols.includes('y') && (cols.includes('r') || cols.includes('correlation'));
    if (hasCorrShape)
        return PREMIUM_CHART_PRESET.HEATMAP;
    const category = pickCategoryColumn(dataset);
    const values = pickValueColumns(dataset, category);
    const hasDate = cols.some((c) => /date/i.test(c));
    const nCats = new Set(dataset.rows.map((row) => String(row[category] ?? ''))).size;
    if (hasDate) {
        if (values.length >= 2)
            return PREMIUM_CHART_PRESET.BAR_LINE;
        return PREMIUM_CHART_PRESET.LINE;
    }
    if (values.length >= 3 && nCats > 0 && nCats <= 8)
        return PREMIUM_CHART_PRESET.RADAR;
    if (values.length >= 2) {
        if (/joueur|player|name|athlete/i.test(category))
            return PREMIUM_CHART_PRESET.BAR_LINE;
        return PREMIUM_CHART_PRESET.SCATTER;
    }
    return PREMIUM_CHART_PRESET.BAR;
};
export const buildPresetFromDataset = (chartType, dataset, categoryArg, valuesArg, refLines = 'none', language = 'fr') => {
    const labeled = sortDatasetByDate(relabelDatasetColumns(dataset, language));
    const mapArg = (name) => name ? displayColumnLabel(name, language, dataset.units) : undefined;
    const categoryMapped = mapArg(categoryArg);
    const valuesMapped = valuesArg?.map((value) => displayColumnLabel(value, language, dataset.units));
    if (chartType === PREMIUM_CHART_PRESET.HEATMAP) {
        const xCol = categoryMapped && labeled.columns.includes(categoryMapped)
            ? categoryMapped
            : labeled.columns.includes('x')
                ? 'x'
                : pickCategoryColumn(labeled);
        const yCol = valuesMapped?.find((col) => col !== xCol && labeled.columns.includes(col)) ??
            (labeled.columns.includes('y') ? 'y' : undefined);
        const valueCol = valuesMapped?.find((col) => col !== xCol && col !== yCol && labeled.columns.includes(col)) ??
            (labeled.columns.includes('r')
                ? 'r'
                : labeled.columns.find((col) => col === 'Corrélation' || col === 'Correlation' || col === 'value'));
        if (!yCol || !valueCol) {
            return JSON.stringify({
                error: 'heatmap needs x/y/r (from correlate mode=matrix)',
                columns: labeled.columns,
            });
        }
        const option = buildPresetChartOption({
            chartType: 'heatmap',
            category: xCol,
            values: [yCol, valueCol],
            rows: labeled.rows,
            refLines,
            language,
        });
        const series = Array.isArray(option.series) ? option.series[0] : null;
        const data = series && typeof series === 'object' && !Array.isArray(series)
            ? series.data
            : null;
        if (!Array.isArray(data) || data.length === 0) {
            return JSON.stringify({ error: 'heatmap has no finite correlation cells' });
        }
        return option;
    }
    const category = pickCategoryColumn(labeled, categoryMapped);
    const values = pickValueColumns(labeled, category, valuesMapped?.length ? valuesMapped : undefined);
    if (chartType === PREMIUM_CHART_PRESET.SCATTER) {
        if (values.length < 2) {
            return JSON.stringify({
                error: 'scatter needs two numeric columns',
                columns: labeled.columns,
            });
        }
        const [xCol, yCol] = values;
        if (isOrdinalScore(labeled.rows, xCol) ||
            isOrdinalScore(labeled.rows, yCol)) {
            return JSON.stringify({
                error: 'Scatter is useless for discrete ordinal scores (e.g. CMJ 1-5). Use bar (by score group or top athletes) or a table with team mean.',
                suggestion: 'Prefer continuous metrics for scatter (hmld_km, hsr_km, strain, distance). For discrete scores: bar chart or table.',
                columns: labeled.columns,
            });
        }
        return buildPresetChartOption({
            chartType: 'scatter',
            category,
            values: values.slice(0, 2),
            rows: labeled.rows,
            refLines,
            language,
        });
    }
    if (chartType === PREMIUM_CHART_PRESET.RADAR) {
        if (values.length < 3) {
            return JSON.stringify({
                error: 'radar needs ≥3 numeric metrics (≤8 athletes)',
                columns: labeled.columns,
            });
        }
        return buildPresetChartOption({
            chartType: 'radar',
            category,
            values: values.slice(0, 8),
            rows: labeled.rows,
            refLines,
            language,
        });
    }
    if (chartType === PREMIUM_CHART_PRESET.DONUT) {
        if (!values[0])
            return JSON.stringify({ error: 'donut needs a numeric value column' });
        return buildPresetChartOption({
            chartType: 'donut',
            category,
            values: values.slice(0, 1),
            refLines,
            language,
        });
    }
    if (chartType === PREMIUM_CHART_PRESET.BAR_LINE) {
        if (values.length < 2) {
            return JSON.stringify({ error: 'bar-line needs two numeric columns' });
        }
        return buildPresetChartOption({
            chartType: 'bar-line',
            category,
            values: values.slice(0, 2),
            rows: labeled.rows,
            refLines,
            language,
        });
    }
    if (values.length === 0) {
        return JSON.stringify({ error: `${chartType} needs a numeric value column` });
    }
    return buildPresetChartOption({
        chartType,
        category,
        values,
        rows: labeled.rows,
        refLines,
        language,
    });
};
//# sourceMappingURL=chart_presets.js.map