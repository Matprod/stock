import { randomUUID } from 'node:crypto';
import { REPORT_BINARY_SERIES_OPS, REPORT_BLOC_SPLIT, REPORT_BLOC_TYPE, REPORT_BLOC_TYPES, REPORT_MAX_COMPARE_ATHLETES, REPORT_MAX_COMPARE_VARIABLES, REPORT_MAX_SERIES_SOURCES, REPORT_PATCH_OP, REPORT_SERIES_OP, REPORT_STRUCTURE_MAX_BLOCS, REPORT_TEXT_MAX_LENGTH, isReportTextBloc, maxCompareAthletesFor, parseReportColor, parseReportLineDash, } from '#constants/report_builder.constants';
import { applyAthleteIdsToBlocs, buildAthleteNameIndex, chunkAthleteIds, collectBlocAthleteIds, coverAthleteScopeSplits, resolveAthleteName, } from '#services/report_builder/athlete_split';
import { parseFormulaSpec } from '#services/report_builder/chatbot/formula_llm';
import { applyReportPatches, isReportPatchOp, } from '#services/report_builder/chatbot/apply_report_patches';
import { parseConvertUnit } from '#services/report_builder/report_units';
export const parseChatbotStructure = (raw, catalogKeys, units, periodAthletes, fallbackRange, fallbackBlocs, scope, catalogNames) => {
    const structure = readLlmStructure(raw);
    if (!structure)
        return null;
    const dateRange = {
        from: structure.dateRange?.from ?? fallbackRange.from,
        to: structure.dateRange?.to ?? fallbackRange.to,
    };
    const nameIndex = buildAthleteNameIndex(periodAthletes);
    const rosterSet = new Set(periodAthletes.map((athlete) => athlete.id));
    const currentAthleteIds = collectBlocAthleteIds(fallbackBlocs);
    const scopeIds = scope.mode === 'none' ? [] : scope.athleteIds;
    const topLevelAthleteIds = resolveAthleteRefs(structure.athleteIds, rosterSet, nameIndex, periodAthletes.length);
    const preferSplit = scope.preferAthleteSplit || scopeIds.length >= 2;
    const parseCtx = {
        catalogKeys,
        units,
        athletes: periodAthletes,
        scopeAthleteIds: topLevelAthleteIds.length > 0 ? topLevelAthleteIds : scopeIds,
        preferAthleteSplit: preferSplit,
    };
    const patches = parsePatches(structure.patches ?? [], parseCtx);
    if (patches.length > 0) {
        const applied = applyReportPatches(fallbackBlocs, patches, undefined, catalogNames);
        const theme = applied.theme ?? readTheme(structure.theme);
        const message = structure.message?.trim() ?? '';
        if (applied.blocs.length === 0 && !message)
            return null;
        return {
            title: structure.title?.trim() || undefined,
            dateRange,
            blocs: applied.blocs.length > 0 ? applied.blocs : fallbackBlocs,
            ...(theme ? { theme } : {}),
            message,
        };
    }
    let blocs = parseBlocs(structure.blocs ?? [], catalogKeys, units, periodAthletes, topLevelAthleteIds.length > 0 ? topLevelAthleteIds : scopeIds, preferSplit);
    if (topLevelAthleteIds.length > 0) {
        const ids = completePositionScope(topLevelAthleteIds, scopeIds, scope.mode);
        const source = blocs.length > 0 ? blocs : fallbackBlocs;
        blocs = coverAthleteScopeSplits(applyAthleteIdsToBlocs(source, ids, preferSplit || ids.length >= 2), ids, dateRange, ids.length >= 2);
    }
    else if (blocs.length > 0) {
        blocs = blocs.flatMap((bloc) => {
            const rawIds = bloc.athleteIds ?? [];
            const ids = completePositionScope(rawIds, scopeIds, scope.mode);
            if (ids.length === 0 || ids.length === rawIds.length) {
                return coverAthleteScopeSplits([bloc], rawIds, dateRange, rawIds.length >= 2);
            }
            return coverAthleteScopeSplits(applyAthleteIdsToBlocs([bloc], ids, preferSplit || ids.length >= 2), ids, dateRange, ids.length >= 2);
        });
    }
    else if (scopeIds.length > 0 && currentAthleteIds.length === 0) {
        blocs = coverAthleteScopeSplits(applyAthleteIdsToBlocs(fallbackBlocs, scopeIds, preferSplit), scopeIds, dateRange, scopeIds.length >= 2);
    }
    const message = structure.message?.trim() ?? '';
    if (blocs.length === 0 && !message)
        return null;
    return {
        title: structure.title?.trim() || undefined,
        dateRange,
        blocs: blocs.length > 0 ? blocs : fallbackBlocs,
        ...(readTheme(structure.theme) ? { theme: readTheme(structure.theme) } : {}),
        message,
    };
};
const completePositionScope = (selected, scopeIds, mode) => {
    if (scopeIds.length === 0)
        return selected;
    if (mode !== 'positions' && mode !== 'mixed')
        return selected;
    if (selected.length === 0)
        return scopeIds;
    const scopeSet = new Set(scopeIds);
    if (selected.some((id) => !scopeSet.has(id)))
        return selected;
    if (selected.length >= scopeIds.length)
        return selected;
    return scopeIds;
};
const readLlmStructure = (raw) => {
    if (!isObject(raw))
        return null;
    return {
        title: typeof raw.title === 'string' ? raw.title : undefined,
        message: typeof raw.message === 'string' ? raw.message : undefined,
        dateRange: readLlmDateRange(raw.dateRange),
        athleteIds: readAthleteRefs(raw.athleteIds),
        blocs: Array.isArray(raw.blocs)
            ? raw.blocs.flatMap((item) => {
                const bloc = readLlmBloc(item);
                return bloc ? [bloc] : [];
            })
            : undefined,
        patches: Array.isArray(raw.patches)
            ? raw.patches.flatMap((item) => {
                const patch = readLlmPatch(item);
                return patch ? [patch] : [];
            })
            : undefined,
        theme: isObject(raw.theme) ? { colors: readStringList(raw.theme.colors) } : undefined,
    };
};
const readLlmDateRange = (value) => {
    if (!isObject(value))
        return undefined;
    return {
        from: typeof value.from === 'string' ? value.from : undefined,
        to: typeof value.to === 'string' ? value.to : undefined,
    };
};
const readLlmBloc = (value) => {
    if (!isObject(value))
        return null;
    return {
        id: typeof value.id === 'string' ? value.id : undefined,
        type: typeof value.type === 'string' ? value.type : undefined,
        split: typeof value.split === 'string' ? value.split : undefined,
        athleteIds: readAthleteRefs(value.athleteIds),
        dateRange: readLlmDateRange(value.dateRange),
        series: Array.isArray(value.series)
            ? value.series.flatMap((item) => {
                const series = readLlmSeries(item);
                return series ? [series] : [];
            })
            : undefined,
        variables: readStringList(value.variables),
        text: typeof value.text === 'string' ? value.text : undefined,
    };
};
const readLlmSeries = (value) => {
    if (!isObject(value))
        return null;
    const formula = isObject(value.formula)
        ? {
            id: typeof value.formula.id === 'string' ? value.formula.id : undefined,
            params: readFormulaParams(value.formula.params),
        }
        : undefined;
    return {
        id: typeof value.id === 'string' ? value.id : undefined,
        label: typeof value.label === 'string' ? value.label : undefined,
        op: typeof value.op === 'string' ? value.op : undefined,
        variables: readStringList(value.variables),
        convert: typeof value.convert === 'string' ? value.convert : undefined,
        color: typeof value.color === 'string' ? value.color : undefined,
        dash: typeof value.dash === 'string' ? value.dash : undefined,
        formula,
    };
};
const readLlmPatch = (value) => {
    if (!isObject(value) || typeof value.op !== 'string')
        return null;
    const nested = isObject(value.patch) ? value.patch : null;
    const formulaSource = isObject(value.formula)
        ? value.formula
        : nested && isObject(nested.formula)
            ? nested.formula
            : undefined;
    const formula = formulaSource
        ? {
            id: typeof formulaSource.id === 'string' ? formulaSource.id : undefined,
            params: readFormulaParams(formulaSource.params),
        }
        : undefined;
    const pickString = (key) => {
        const top = value[key];
        if (typeof top === 'string')
            return top;
        const inner = nested?.[key];
        return typeof inner === 'string' ? inner : undefined;
    };
    return {
        op: value.op,
        after: pickString('after'),
        id: pickString('id'),
        blocId: pickString('blocId'),
        seriesId: pickString('seriesId'),
        bloc: value.bloc ? (readLlmBloc(value.bloc) ?? undefined) : undefined,
        text: pickString('text'),
        type: pickString('type'),
        convert: pickString('convert'),
        color: pickString('color'),
        label: pickString('label'),
        dash: pickString('dash') ?? pickString('lineStyle'),
        match: pickString('match'),
        colors: readStringList(value.colors) ?? (nested ? readStringList(nested.colors) : undefined),
        formula,
        variables: readStringList(value.variables) ?? (nested ? readStringList(nested.variables) : undefined),
        series: Array.isArray(value.series)
            ? value.series.flatMap((item) => {
                const series = readLlmSeries(item);
                return series ? [series] : [];
            })
            : nested && Array.isArray(nested.series)
                ? nested.series.flatMap((item) => {
                    const series = readLlmSeries(item);
                    return series ? [series] : [];
                })
                : undefined,
        athleteIds: readAthleteRefs(value.athleteIds),
        split: typeof value.split === 'string' ? value.split : undefined,
        dateRange: readLlmDateRange(value.dateRange),
    };
};
const readFormulaParams = (value) => {
    if (!isObject(value))
        return undefined;
    const params = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry === 'number' || typeof entry === 'boolean') {
            params[key] = entry;
        }
    }
    return Object.keys(params).length > 0 ? params : undefined;
};
const readStringList = (value) => {
    if (!Array.isArray(value))
        return undefined;
    const keys = value.filter((entry) => typeof entry === 'string');
    return keys.length > 0 ? keys : undefined;
};
const readAthleteRefs = (value) => {
    if (!Array.isArray(value))
        return undefined;
    const refs = [];
    for (const entry of value) {
        if (typeof entry === 'string') {
            refs.push(entry);
            continue;
        }
        if (!isObject(entry))
            continue;
        refs.push({
            id: typeof entry.id === 'string' ? entry.id : undefined,
            name: typeof entry.name === 'string' ? entry.name : undefined,
        });
    }
    return refs.length > 0 ? refs : undefined;
};
const sanitizeText = (value) => {
    const text = value?.replace(/\r\n/g, '\n').trim();
    if (!text)
        return undefined;
    return text.slice(0, REPORT_TEXT_MAX_LENGTH);
};
const readTheme = (value) => {
    const colors = (value?.colors ?? []).flatMap((color) => {
        const parsed = parseReportColor(color);
        return parsed ? [parsed] : [];
    });
    return colors.length > 0 ? { colors } : undefined;
};
const parsePatches = (patches, ctx) => patches.flatMap((patch) => {
    if (!patch.op || !isReportPatchOp(patch.op))
        return [];
    if (patch.op === REPORT_PATCH_OP.ADD_BLOC) {
        if (!patch.bloc)
            return [];
        const blocs = parseBlocs([patch.bloc], ctx.catalogKeys, ctx.units, ctx.athletes, ctx.scopeAthleteIds, ctx.preferAthleteSplit);
        if (blocs.length === 0)
            return [];
        return [{ op: REPORT_PATCH_OP.ADD_BLOC, after: patch.after, blocs }];
    }
    if (patch.op === REPORT_PATCH_OP.REMOVE_BLOC) {
        if (!patch.id)
            return [];
        return [{ op: REPORT_PATCH_OP.REMOVE_BLOC, id: patch.id }];
    }
    if (patch.op === REPORT_PATCH_OP.SET_THEME) {
        const colors = (patch.colors ?? []).flatMap((color) => {
            const parsed = parseReportColor(color);
            return parsed ? [parsed] : [];
        });
        if (colors.length === 0)
            return [];
        return [{ op: REPORT_PATCH_OP.SET_THEME, colors }];
    }
    if (patch.op === REPORT_PATCH_OP.UPDATE_SERIES) {
        const seriesPatch = {};
        const convert = parseConvertUnit(patch.convert);
        const color = parseReportColor(patch.color);
        const formula = parseFormulaSpec(patch.formula);
        const label = patch.label?.replace(/\s+/g, ' ').trim();
        const dash = parseReportLineDash(patch.dash ?? patch.lineStyle);
        if (convert)
            seriesPatch.convert = convert;
        if (color)
            seriesPatch.color = color;
        if (formula)
            seriesPatch.formula = formula;
        if (label)
            seriesPatch.label = label;
        if (dash)
            seriesPatch.dash = dash;
        const variables = keepKeys(patch.variables, ctx.catalogKeys);
        if (variables.length > 0)
            seriesPatch.variables = variables;
        if (Object.keys(seriesPatch).length === 0)
            return [];
        return [
            {
                op: REPORT_PATCH_OP.UPDATE_SERIES,
                blocId: patch.blocId,
                seriesId: patch.seriesId,
                match: patch.match,
                patch: seriesPatch,
            },
        ];
    }
    if (patch.op === REPORT_PATCH_OP.UPDATE_BLOC) {
        if (!patch.id)
            return [];
        const blocPatch = {};
        const text = sanitizeText(patch.text);
        if (text)
            blocPatch.text = text;
        if (patch.type && REPORT_BLOC_TYPES.includes(patch.type)) {
            blocPatch.type = patch.type;
        }
        if (patch.split === REPORT_BLOC_SPLIT.ATHLETE || patch.split === REPORT_BLOC_SPLIT.VARIABLE) {
            blocPatch.split = patch.split;
        }
        if (patch.dateRange?.from && patch.dateRange.to) {
            blocPatch.dateRange = { from: patch.dateRange.from, to: patch.dateRange.to };
        }
        if (patch.series?.length) {
            const usedIds = new Set();
            const series = patch.series.flatMap((spec) => parseSeriesSpec(spec, ctx.catalogKeys, ctx.units, usedIds));
            if (series.length > 0) {
                blocPatch.series = series;
                blocPatch.variables = [...new Set(series.flatMap((spec) => spec.variables))];
            }
        }
        const variables = keepKeys(patch.variables, ctx.catalogKeys);
        if (variables.length > 0 && !blocPatch.series)
            blocPatch.variables = variables;
        if (Object.keys(blocPatch).length === 0)
            return [];
        return [{ op: REPORT_PATCH_OP.UPDATE_BLOC, id: patch.id, patch: blocPatch }];
    }
    return [];
});
const parseBlocs = (blocs, catalogKeys, units, athletes, scopeAthleteIds, preferAthleteSplit) => {
    const rosterIds = athletes.map((athlete) => athlete.id);
    const nameIndex = buildAthleteNameIndex(athletes);
    const rosterSet = new Set(rosterIds);
    return blocs
        .flatMap((item) => {
        if (!item.type || !REPORT_BLOC_TYPES.includes(item.type))
            return [];
        if (isReportTextBloc(item.type)) {
            const text = sanitizeText(item.text);
            if (!text)
                return [];
            return [
                {
                    id: item.id || randomUUID(),
                    type: REPORT_BLOC_TYPE.TEXT,
                    text,
                    variables: [],
                    series: [],
                },
            ];
        }
        const usedIds = new Set();
        const series = item.series?.length
            ? item.series.flatMap((spec) => parseSeriesSpec(spec, catalogKeys, units, usedIds))
            : toIdentitySeries(keepKeys(item.variables, catalogKeys), usedIds);
        if (series.length === 0)
            return [];
        const wantsAthleteSplit = item.split === REPORT_BLOC_SPLIT.ATHLETE ||
            (preferAthleteSplit &&
                item.type !== REPORT_BLOC_TYPE.TABLE &&
                item.type !== REPORT_BLOC_TYPE.KPI &&
                item.type !== REPORT_BLOC_TYPE.TEXT);
        const from = item.dateRange?.from ?? '';
        const to = item.dateRange?.to ?? '';
        const dateRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
            ? { from, to }
            : undefined;
        const toBloc = (athleteIds, split) => {
            const cappedSeries = split === REPORT_BLOC_SPLIT.ATHLETE
                ? series.slice(0, REPORT_MAX_COMPARE_VARIABLES)
                : series;
            return {
                id: item.id || randomUUID(),
                type: item.type,
                series: cappedSeries.map((spec) => ({ ...spec, variables: [...spec.variables] })),
                variables: [...new Set(cappedSeries.flatMap((spec) => spec.variables))],
                split,
                ...(split === REPORT_BLOC_SPLIT.ATHLETE || athleteIds.length > 0 ? { athleteIds } : {}),
                ...(dateRange ? { dateRange } : {}),
            };
        };
        if (!wantsAthleteSplit) {
            const ids = resolveBlocAthleteIds(item.athleteIds, rosterSet, nameIndex, REPORT_MAX_COMPARE_ATHLETES, scopeAthleteIds);
            return [toBloc(ids, REPORT_BLOC_SPLIT.VARIABLE)];
        }
        const selected = resolveBlocAthleteIds(item.athleteIds, rosterSet, nameIndex, rosterIds.length, scopeAthleteIds);
        const maxAthletes = maxCompareAthletesFor(item.type, from || '1970-01-01', to || '1970-01-01');
        if (Number.isFinite(maxAthletes) && selected.length > maxAthletes) {
            return chunkAthleteIds(selected, maxAthletes).map((athleteIds, index) => ({
                ...toBloc(athleteIds, REPORT_BLOC_SPLIT.ATHLETE),
                id: index === 0 && item.id ? item.id : randomUUID(),
            }));
        }
        if (selected.length >= 2) {
            return [toBloc(selected, REPORT_BLOC_SPLIT.ATHLETE)];
        }
        return [toBloc(selected, REPORT_BLOC_SPLIT.VARIABLE)];
    })
        .slice(0, REPORT_STRUCTURE_MAX_BLOCS);
};
const parseSeriesSpec = (spec, catalogKeys, units, usedIds) => {
    const variables = keepKeys(spec.variables, catalogKeys);
    if (variables.length === 0)
        return [];
    const label = spec.label?.replace(/\s+/g, ' ').trim() ?? '';
    const preferredId = spec.id || undefined;
    const formula = parseFormulaSpec(spec.formula);
    const color = parseReportColor(spec.color);
    const convert = parseConvertUnit(spec.convert);
    const dash = parseReportLineDash(spec.dash);
    const withMeta = (series) => ({
        ...series,
        ...(label ? { label } : {}),
        ...(formula ? { formula } : {}),
        ...(convert ? { convert } : {}),
        ...(color ? { color } : {}),
        ...(dash ? { dash } : {}),
    });
    if (spec.op === REPORT_SERIES_OP.SUM && variables.length >= 2) {
        const unit = units.get(variables[0]) ?? null;
        const compatible = variables
            .filter((key) => (units.get(key) ?? null) === unit)
            .slice(0, REPORT_MAX_SERIES_SOURCES);
        if (compatible.length < 2)
            return [];
        return [
            withMeta({
                id: uniqueSeriesId(preferredId ?? compatible[0], usedIds),
                op: REPORT_SERIES_OP.SUM,
                variables: compatible,
            }),
        ];
    }
    if (spec.op &&
        REPORT_BINARY_SERIES_OPS.includes(spec.op) &&
        variables.length >= 2) {
        const pair = variables.slice(0, 2);
        if (spec.op === REPORT_SERIES_OP.SUB) {
            const unit = units.get(pair[0]) ?? null;
            if ((units.get(pair[1]) ?? null) !== unit)
                return [];
        }
        return [
            withMeta({
                id: uniqueSeriesId(preferredId ?? pair[0], usedIds),
                op: spec.op,
                variables: pair,
            }),
        ];
    }
    return toIdentitySeries(variables, usedIds, preferredId).map(withMeta);
};
const resolveAthleteId = (ref, index) => {
    if (typeof ref === 'string') {
        if (index.byId.has(ref))
            return ref;
        return resolveAthleteName(ref, index);
    }
    if (ref.id && index.byId.has(ref.id))
        return ref.id;
    if (ref.name)
        return resolveAthleteName(ref.name, index);
    return null;
};
const resolveAthleteRefs = (value, rosterSet, nameIndex, max) => {
    const ids = [];
    const seen = new Set();
    for (const entry of value ?? []) {
        const id = resolveAthleteId(entry, nameIndex);
        if (!id || seen.has(id) || ids.length >= max || !rosterSet.has(id))
            continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
};
const resolveBlocAthleteIds = (value, rosterSet, nameIndex, max, scopeAthleteIds) => {
    const ids = resolveAthleteRefs(value, rosterSet, nameIndex, max);
    if (ids.length > 0)
        return ids;
    return scopeAthleteIds.filter((id) => rosterSet.has(id)).slice(0, max);
};
const toIdentitySeries = (keys, usedIds, preferredId) => keys.map((key, index) => ({
    id: uniqueSeriesId(index === 0 && preferredId ? preferredId : key, usedIds),
    op: REPORT_SERIES_OP.IDENTITY,
    variables: [key],
}));
const uniqueSeriesId = (preferred, used) => {
    let id = preferred;
    let n = 2;
    while (used.has(id)) {
        id = `${preferred}-${n}`;
        n++;
    }
    used.add(id);
    return id;
};
const keepKeys = (value, allowed) => value ? [...new Set(value.filter((key) => allowed.has(key)))] : [];
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
//# sourceMappingURL=parse_chatbot_structure.js.map