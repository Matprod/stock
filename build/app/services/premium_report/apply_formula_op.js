import { REPORT_FORMULAS, applyFormula, mergeFormulaParams, } from '#services/report_builder/formulas';
import { densifyDailyDataset, looksLikeDateColumn, partitionRows, toNumber, compareValues, } from '#services/premium_report/dataset_ops';
export const FORMULAS_FILL_REST_DAYS = new Set([
    'monotony',
    'strain',
    'ewma',
    'ma',
    'median_ma',
    'cumulative',
    'acwr_ma',
    'acwr_ewma',
]);
export const applyFormulaOnDataset = (args) => {
    const def = REPORT_FORMULAS[args.formulaId];
    const params = mergeFormulaParams(args.formulaId, args.params);
    const fillRestDays = args.fillRestDays ?? FORMULAS_FILL_REST_DAYS.has(args.formulaId);
    let working = args.dataset;
    if (fillRestDays && args.orderBy && looksLikeDateColumn(args.orderBy, args.dataset)) {
        working = densifyDailyDataset({
            dataset: args.dataset,
            dateColumn: args.orderBy,
            groupBy: args.groupBy,
            valueColumns: [args.valueColumn],
            from: args.dateRange.from,
            to: args.dateRange.to,
        });
    }
    const groups = partitionRows(working.rows, args.groupBy);
    const outRows = [];
    for (const group of groups) {
        const ordered = args.orderBy
            ? [...group].sort((a, b) => compareValues(a[args.orderBy], b[args.orderBy]))
            : group;
        const series = ordered.map((row) => toNumber(row[args.valueColumn]));
        const result = applyFormula(series, { id: args.formulaId, params });
        if (def.kind === 'reduce') {
            const base = {};
            if (args.groupBy)
                base[args.groupBy] = ordered[0]?.[args.groupBy] ?? null;
            base[args.outputColumn] = result.scalar ?? null;
            outRows.push(base);
            continue;
        }
        for (let i = 0; i < ordered.length; i++) {
            outRows.push({
                ...ordered[i],
                [args.outputColumn]: result.series[i] ?? null,
            });
        }
    }
    const columns = def.kind === 'reduce'
        ? [...(args.groupBy ? [args.groupBy] : []), args.outputColumn]
        : working.columns.includes(args.outputColumn)
            ? working.columns
            : [...working.columns, args.outputColumn];
    return {
        id: 'tmp',
        columns,
        rows: outRows,
        ...(working.units ? { units: working.units } : {}),
    };
};
//# sourceMappingURL=apply_formula_op.js.map