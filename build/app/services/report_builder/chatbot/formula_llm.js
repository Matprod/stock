import { REPORT_FORMULA_WINDOW_DEFAULTS } from '#constants/report_builder.constants';
import { REPORT_FORMULAS, isReportFormulaId, mergeFormulaParams, } from '#services/report_builder/formulas';
export const parseFormulaSpec = (value) => {
    if (!value?.id || !isReportFormulaId(value.id))
        return undefined;
    return {
        id: value.id,
        params: mergeFormulaParams(value.id, value.params),
    };
};
export const formulaCatalogForLlm = (opts) => {
    const allow = opts?.formulaIds?.length ? new Set(opts.formulaIds) : null;
    const byGroup = {};
    for (const { id, kind, group, defaults, params, useWhen } of Object.values(REPORT_FORMULAS)) {
        if (allow && !allow.has(id))
            continue;
        const list = byGroup[group] ?? [];
        list.push({
            id,
            kind,
            defaults,
            params,
            useWhen: useWhen.split('.')[0] ?? useWhen,
        });
        byGroup[group] = list;
    }
    return {
        windows: [...REPORT_FORMULA_WINDOW_DEFAULTS],
        n: 'positive integer — 7/14/28 defaults',
        byGroup,
    };
};
//# sourceMappingURL=formula_llm.js.map