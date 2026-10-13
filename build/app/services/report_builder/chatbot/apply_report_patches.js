import { randomUUID } from 'node:crypto';
import { REPORT_PATCH_OP, REPORT_STRUCTURE_MAX_BLOCS, isReportTextBloc, } from '#constants/report_builder.constants';
export const applyReportPatches = (current, patches, currentTheme, catalogNames) => {
    let blocs = current.map((bloc) => cloneBloc(bloc));
    let theme = currentTheme?.colors?.length ? { colors: [...currentTheme.colors] } : undefined;
    for (const patch of patches) {
        if (patch.op === REPORT_PATCH_OP.SET_THEME) {
            theme = patch.colors.length > 0 ? { colors: patch.colors } : undefined;
            continue;
        }
        if (patch.op === REPORT_PATCH_OP.ADD_BLOC) {
            const insertAt = insertIndex(blocs, patch.after);
            const toInsert = patch.blocs.map((bloc) => ({
                ...cloneBloc(bloc),
                id: bloc.id || randomUUID(),
            }));
            blocs = [...blocs.slice(0, insertAt), ...toInsert, ...blocs.slice(insertAt)];
            continue;
        }
        if (patch.op === REPORT_PATCH_OP.REMOVE_BLOC) {
            blocs = blocs.filter((bloc) => bloc.id !== patch.id);
            continue;
        }
        if (patch.op === REPORT_PATCH_OP.UPDATE_BLOC) {
            blocs = blocs.map((bloc) => (bloc.id === patch.id ? mergeBloc(bloc, patch.patch) : bloc));
            continue;
        }
        const target = findSeriesTarget(blocs, patch.blocId, patch.seriesId, patch.match, catalogNames);
        if (!target)
            continue;
        blocs = blocs.map((bloc) => bloc.id === target.blocId ? mergeSeries(bloc, target.seriesId, patch.patch) : bloc);
    }
    return {
        blocs: blocs.slice(0, REPORT_STRUCTURE_MAX_BLOCS),
        theme,
    };
};
export const isReportPatchOp = (value) => REPORT_PATCH_OPS_SET.has(value);
const REPORT_PATCH_OPS_SET = new Set(Object.values(REPORT_PATCH_OP));
const insertIndex = (blocs, after) => {
    if (!after || after === 'end')
        return blocs.length;
    if (after === 'start')
        return 0;
    const index = blocs.findIndex((bloc) => bloc.id === after);
    return index === -1 ? blocs.length : index + 1;
};
const cloneBloc = (bloc) => ({
    ...bloc,
    variables: bloc.variables ? [...bloc.variables] : undefined,
    series: bloc.series?.map((spec) => ({
        ...spec,
        variables: [...spec.variables],
        ...(spec.formula ? { formula: { ...spec.formula, params: spec.formula.params } } : {}),
    })),
    athleteIds: bloc.athleteIds ? [...bloc.athleteIds] : undefined,
    dateRange: bloc.dateRange ? { ...bloc.dateRange } : undefined,
});
const mergeBloc = (bloc, patch) => {
    const next = {
        ...bloc,
        ...patch,
        id: bloc.id,
        type: patch.type ?? bloc.type,
    };
    if (isReportTextBloc(next.type)) {
        next.variables = [];
        next.series = [];
        next.athleteIds = undefined;
        next.split = undefined;
    }
    return next;
};
const expandSeries = (bloc) => {
    if (bloc.series?.length)
        return bloc.series;
    return (bloc.variables ?? []).map((key) => ({
        id: key,
        variables: [key],
    }));
};
const normalizeNeedle = (value) => value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
const seriesSearchText = (spec, catalogNames) => normalizeNeedle([
    spec.id,
    spec.label,
    ...spec.variables,
    ...spec.variables.map((key) => catalogNames?.get(key)),
]
    .filter(Boolean)
    .join(' '));
const searchTokens = (needle) => needle.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
const findSeriesTarget = (blocs, blocId, seriesId, match, catalogNames) => {
    const scoped = blocId ? blocs.filter((bloc) => bloc.id === blocId) : [];
    const pool = scoped.length > 0 ? scoped : blocs.filter((bloc) => !isReportTextBloc(bloc.type));
    const search = pool.length > 0 ? pool : blocs;
    const needle = normalizeNeedle(seriesId || match || '');
    const tokens = searchTokens(needle);
    if (needle) {
        for (const bloc of search) {
            const series = expandSeries(bloc);
            const exact = series.find((spec) => spec.id === seriesId);
            if (exact)
                return { blocId: bloc.id, seriesId: exact.id };
        }
        const hits = [];
        for (const bloc of search) {
            const series = expandSeries(bloc);
            for (const spec of series) {
                const hay = seriesSearchText(spec, catalogNames);
                const substring = hay.includes(needle) || needle.includes(normalizeNeedle(spec.id));
                const allTokens = tokens.length > 0 && tokens.every((token) => hay.includes(token));
                const longest = tokens.reduce((best, token) => (token.length > best.length ? token : best), '');
                const longToken = longest.length >= 5 && hay.includes(longest);
                if (substring || allTokens || longToken) {
                    hits.push({ blocId: bloc.id, seriesId: spec.id });
                }
            }
        }
        if (hits.length === 1)
            return hits[0];
        if (hits.length > 1 && blocId) {
            const scopedHits = hits.filter((hit) => hit.blocId === blocId);
            if (scopedHits.length > 0)
                return scopedHits[0];
        }
        if (hits.length > 0)
            return hits[0];
    }
    const singles = search.flatMap((bloc) => {
        const series = expandSeries(bloc);
        return series.map((spec) => ({ blocId: bloc.id, seriesId: spec.id }));
    });
    if (singles.length === 1)
        return singles[0];
    return null;
};
const mergeSeries = (bloc, seriesId, patch) => {
    const series = expandSeries(bloc).map((spec) => ({ ...spec, variables: [...spec.variables] }));
    const index = series.findIndex((spec) => spec.id === seriesId);
    const target = index >= 0 ? index : 0;
    if (!series[target])
        return bloc;
    series[target] = {
        ...series[target],
        ...patch,
        id: series[target].id,
        variables: patch.variables ? [...patch.variables] : series[target].variables,
    };
    return {
        ...bloc,
        series,
        variables: [...new Set(series.flatMap((spec) => spec.variables))],
    };
};
//# sourceMappingURL=apply_report_patches.js.map