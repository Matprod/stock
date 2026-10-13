import { REPORT_BINARY_SERIES_OPS, REPORT_SERIES_OP, } from '#constants/report_builder.constants';
import { applyFormula, formulaTitleSuffix } from '#services/report_builder/formulas';
import { getMeta, getSeries, getTotal } from '#services/report_builder/load_report_data';
import { convertSeriesValues, unitConversionFactor } from '#services/report_builder/report_units';
export const resolveBlocSeries = (bloc) => {
    if (bloc.series?.length)
        return bloc.series;
    return (bloc.variables ?? []).map((key) => ({
        id: key,
        op: REPORT_SERIES_OP.IDENTITY,
        variables: [key],
    }));
};
export const seriesTitle = (data, spec) => {
    const names = spec.variables.map((key) => getMeta(data, key)?.name ?? key);
    const autoBase = spec.op === REPORT_SERIES_OP.IDENTITY || !spec.op
        ? (names[0] ?? spec.id)
        : names.join(combineOpLabel(spec.op));
    const custom = spec.label?.trim();
    if (custom)
        return custom;
    return spec.formula ? `${autoBase}${formulaTitleSuffix(spec.formula)}` : autoBase;
};
export const getSeriesUnit = (data, spec) => spec.convert ?? getMeta(data, spec.variables[0])?.unit ?? null;
const sourceUnit = (data, spec) => getMeta(data, spec.variables[0])?.unit ?? null;
const applyConvert = (data, spec, series) => {
    if (!spec.convert)
        return series;
    const factor = unitConversionFactor(sourceUnit(data, spec), spec.convert);
    if (factor === null || factor === 1)
        return series;
    return convertSeriesValues(series, factor);
};
export const getComposedSeries = (data, spec, athleteIds) => {
    const combined = applyConvert(data, spec, combineSources(data, spec, athleteIds));
    if (!spec.formula)
        return combined;
    return applyFormula(combined, spec.formula).series;
};
export const getComposedTotal = (data, spec, athleteIds) => {
    if (!spec.formula) {
        const op = spec.op ?? REPORT_SERIES_OP.IDENTITY;
        if (op === REPORT_SERIES_OP.IDENTITY || spec.variables.length === 1) {
            return convertScalar(data, spec, getTotal(data, spec.variables[0], athleteIds));
        }
        return sumNullable(applyConvert(data, spec, combineSources(data, spec, athleteIds)));
    }
    const combined = applyConvert(data, spec, combineSources(data, spec, athleteIds));
    return applyFormula(combined, spec.formula).scalar ?? null;
};
const convertScalar = (data, spec, value) => {
    if (value === null || !spec.convert)
        return value;
    const factor = unitConversionFactor(sourceUnit(data, spec), spec.convert);
    if (factor === null || factor === 1)
        return value;
    return Math.round(value * factor * 1000) / 1000;
};
const roundMetricValue = (value) => Math.round(value * 100) / 100;
const sumNullable = (values) => {
    let sum = 0;
    let hasValue = false;
    for (const value of values) {
        if (value === null)
            continue;
        sum += value;
        hasValue = true;
    }
    return hasValue ? roundMetricValue(sum) : null;
};
const binaryNullable = (left, right, op) => {
    if (left === null || right === null)
        return null;
    if (op === REPORT_SERIES_OP.SUB)
        return roundMetricValue(left - right);
    if (op === REPORT_SERIES_OP.MUL)
        return roundMetricValue(left * right);
    if (right === 0)
        return null;
    return roundMetricValue(left / right);
};
const isBinaryOp = (op) => REPORT_BINARY_SERIES_OPS.includes(op);
const combineOpLabel = (op) => {
    if (op === REPORT_SERIES_OP.SUM)
        return ' + ';
    if (op === REPORT_SERIES_OP.SUB)
        return ' - ';
    if (op === REPORT_SERIES_OP.MUL)
        return ' × ';
    if (op === REPORT_SERIES_OP.DIV)
        return ' ÷ ';
    return ' + ';
};
const combineSources = (data, spec, athleteIds) => {
    const op = spec.op ?? REPORT_SERIES_OP.IDENTITY;
    if (op === REPORT_SERIES_OP.IDENTITY || spec.variables.length === 1) {
        return getSeries(data, spec.variables[0], athleteIds);
    }
    if (op === REPORT_SERIES_OP.SUM) {
        const components = spec.variables.map((key) => getSeries(data, key, athleteIds));
        return data.dates.map((_, index) => sumNullable(components.map((series) => series[index] ?? null)));
    }
    if (isBinaryOp(op) && spec.variables.length >= 2) {
        const left = getSeries(data, spec.variables[0], athleteIds);
        const right = getSeries(data, spec.variables[1], athleteIds);
        return data.dates.map((_, index) => binaryNullable(left[index] ?? null, right[index] ?? null, op));
    }
    return getSeries(data, spec.variables[0], athleteIds);
};
//# sourceMappingURL=compose_series.js.map