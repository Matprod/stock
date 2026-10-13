import { PREMIUM_DOMAIN_CATALOG, } from '#constants/premium_report_domains';
import { pickAthleteColumn, playerLoadSourcesForClub } from '#constants/premium_report_metrics';
import { applyFormulaOnDataset } from '#services/premium_report/apply_formula_op';
import { datasetToolResult, densifyDailyDataset, joinOnKeys, readDateRange, storeDataset, takeLatestRows, toNumber, } from '#services/premium_report/dataset_ops';
import { buildPremiumSqlTemplate, PREMIUM_SQL_TEMPLATE, } from '#services/premium_report/premium_report_sql_templates';
import { ingestQueryResult, safeParseObject, } from '#services/premium_report/premium_report_tools';
import { resolveTemplateColumnUnits } from '#services/premium_report/period_metric_units';
import { elapsedSec, logPremiumTool } from '#services/premium_report/premium_report_log';
export const createPremiumMacroTools = (args) => {
    const tools = [];
    for (const domain of args.domains) {
        const config = PREMIUM_DOMAIN_CATALOG[domain];
        for (const macro of config.macros) {
            tools.push(sqlTemplateTool(args.state, args.runSql, macro.name, macro.templateId, macro.description));
        }
        if (config.loadSummary)
            tools.push(buildLoadSummaryTool(args.state, args.runSql));
    }
    return tools;
};
const sqlTemplateTool = (state, runSql, name, templateId, description) => ({
    schema: {
        name,
        description: `${description}. Prefer over free query_database.`,
        input_schema: {
            type: 'object',
            properties: {
                from: { type: 'string' },
                to: { type: 'string' },
            },
        },
    },
    execute: async (input) => runTemplateQuery(state, runSql, templateId, input),
});
const buildLoadSummaryTool = (state, runSql) => ({
    schema: {
        name: 'build_load_summary',
        description: 'Daily sRPE → EWMA7/28, monotony, strain, ACWR, cumulative → take_latest → merge.',
        input_schema: {
            type: 'object',
            properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                dropZeroLoad: { type: 'boolean' },
            },
        },
    },
    execute: async (input) => {
        const started = Date.now();
        const { from, to } = readDateRange(input, state.dateRange);
        const dropZeroLoad = typeof input.dropZeroLoad === 'boolean' ? input.dropZeroLoad : true;
        const dailyResult = await runTemplateQuery(state, runSql, PREMIUM_SQL_TEMPLATE.DAILY_SRPE, {
            from,
            to,
        });
        const dailyParsed = safeParseObject(dailyResult);
        if (dailyParsed?.error || !dailyParsed?.datasetId)
            return dailyResult;
        const dailyId = String(dailyParsed.datasetId);
        const daily = state.datasets.get(dailyId);
        if (!daily)
            return JSON.stringify({ error: 'daily sRPE dataset missing after fetch' });
        const valueColumn = daily.columns.includes('srpe_daily')
            ? 'srpe_daily'
            : daily.columns.find((c) => /srpe|load/i.test(c)) ?? 'srpe_daily';
        const dateColumn = daily.columns.includes('date_of_day')
            ? 'date_of_day'
            : daily.columns.find((c) => /date/i.test(c)) ?? 'date_of_day';
        const specs = [
            { id: 'ewma', outputColumn: 'ewma_7', params: { n: 7 } },
            { id: 'ewma', outputColumn: 'ewma_28', params: { n: 28 } },
            { id: 'monotony', outputColumn: 'monotony' },
            { id: 'strain', outputColumn: 'strain' },
            { id: 'acwr_ewma', outputColumn: 'acwr_ewma' },
            { id: 'cumulative', outputColumn: 'cumulative_7', params: { n: 7 } },
        ];
        const athleteColumn = pickAthleteColumn(daily.columns) ?? 'joueur';
        const densified = densifyDailyDataset({
            dataset: daily,
            dateColumn,
            groupBy: athleteColumn,
            valueColumns: [valueColumn],
            from,
            to,
        });
        const latestDatasets = [];
        const formulaDatasetIds = {};
        for (const spec of specs) {
            const series = applyFormulaOnDataset({
                dataset: densified,
                valueColumn,
                groupBy: athleteColumn,
                orderBy: dateColumn,
                outputColumn: spec.outputColumn,
                formulaId: spec.id,
                params: spec.params,
                fillRestDays: false,
                dateRange: { from, to },
            });
            formulaDatasetIds[spec.outputColumn] = storeDataset(state, series).id;
            latestDatasets.push(takeLatestRows(series, athleteColumn, dateColumn, [
                athleteColumn,
                spec.outputColumn,
                valueColumn,
            ]));
        }
        let merged = joinOnKeys(latestDatasets, [athleteColumn]);
        let dropNote;
        if (dropZeroLoad) {
            const active = new Set(densified.rows
                .filter((row) => {
                const n = toNumber(row[valueColumn]);
                return n != null && n > 0;
            })
                .map((row) => String(row[athleteColumn] ?? '')));
            const filtered = {
                ...merged,
                rows: merged.rows.filter((row) => active.has(String(row[athleteColumn] ?? ''))),
            };
            if (filtered.rows.length > 0) {
                merged = filtered;
            }
            else if (merged.rows.length > 0) {
                dropNote =
                    'All latest srpe_daily were 0 (no RPE × minutes). Kept rows anyway — prefer GPS player_load for load charts on this club/period.';
            }
        }
        const summary = storeDataset(state, merged);
        const durationSec = elapsedSec(started);
        logPremiumTool({
            tool: 'build_load_summary',
            ok: true,
            durationSec,
            detail: `summary=${summary.id} rows=${merged.rows.length}`,
        });
        return datasetToolResult(summary, {
            dailyDatasetId: dailyId,
            formulaDatasetIds,
            durationSec,
            note: dropNote
                ? dropNote
                : 'Trends: add_chart line on dailyDatasetId (has date_of_day). Summary datasetId = table/bar only.',
        });
    },
});
const runTemplateQuery = async (state, runSql, templateId, input) => {
    if (state.blockSql) {
        return JSON.stringify({ error: 'SQL disabled. Use apply_formula / canvas tools.', blockSql: true });
    }
    const { from, to } = readDateRange(input, state.dateRange);
    const sql = buildPremiumSqlTemplate(templateId, {
        clubId: state.clubId,
        from,
        to,
        athleteIds: state.athleteIds.length ? state.athleteIds : undefined,
    });
    const started = Date.now();
    const raw = await runSql(sql);
    const result = ingestQueryResult(state, raw, {
        durationSec: elapsedSec(started),
        sql,
        templateId,
    });
    const parsed = safeParseObject(result);
    if (parsed && !parsed.error && typeof parsed.datasetId === 'string') {
        const dataset = state.datasets.get(parsed.datasetId);
        if (dataset) {
            let units = state.templateUnitsCache.get(templateId);
            if (!units) {
                units = await resolveTemplateColumnUnits(state.clubId, templateId);
                state.templateUnitsCache.set(templateId, units);
            }
            if (Object.keys(units).length > 0) {
                dataset.units = { ...dataset.units, ...units };
            }
        }
        const unitsNote = datasetUnitsNote(state, String(parsed.datasetId));
        if (templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY_DAILY ||
            templateId === PREMIUM_SQL_TEMPLATE.GPS_INTENSITY) {
            const loads = playerLoadSourcesForClub(state.clubId).join('|');
            return JSON.stringify({
                ...parsed,
                note: `Player load = columns player_load and dsl (sources ${loads}). Filter injured players → add_chart line. Do NOT query_database for other pm.name load aliases.`,
                ...(unitsNote ? { units: unitsNote } : {}),
            });
        }
        if (unitsNote) {
            return JSON.stringify({ ...parsed, units: unitsNote });
        }
    }
    return result;
};
const datasetUnitsNote = (state, datasetId) => {
    const units = state.datasets.get(datasetId)?.units;
    return units && Object.keys(units).length > 0 ? units : undefined;
};
//# sourceMappingURL=tools_macros.js.map