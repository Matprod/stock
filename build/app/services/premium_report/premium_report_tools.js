import logger from '@adonisjs/core/services/logger';
import { PREMIUM_SQL_FAILURE_CAP } from '#constants/premium_report_domains';
import { storeDataset, datasetToolResult } from '#services/premium_report/dataset_ops';
import { toDisplayChartDataset, implausibleMetricWarning } from '#services/premium_report/premium_report_document';
import { elapsedSec, logPremiumSql } from '#services/premium_report/premium_report_log';
export const recordSqlFailure = (state, error) => {
    const key = sqlFailureKey(error);
    const next = (state.sqlFailures.get(key) ?? 0) + 1;
    state.sqlFailures.set(key, next);
    if (key === 'unit')
        return state.blockSql;
    if (next >= PREMIUM_SQL_FAILURE_CAP && !state.blockSql) {
        state.blockSql = true;
        logger.warn({ key, count: next, clubId: state.clubId }, 'premium_report.sql_circuit_open');
        return true;
    }
    return state.blockSql;
};
export const wrapQueryTool = (dbTool, state) => ({
    schema: dbTool.schema,
    execute: async (input) => {
        if (state.blockSql) {
            return JSON.stringify({
                error: 'SQL disabled. Use macros / apply_formula / canvas on existing datasetIds.',
                blockSql: true,
            });
        }
        const sql = typeof input.sql === 'string' ? input.sql : '';
        const started = Date.now();
        const raw = await dbTool.execute({ sql });
        return ingestQueryResult(state, raw, {
            durationSec: elapsedSec(started),
            sql,
            emptyAsRaw: true,
        });
    },
});
export const ingestQueryResult = (state, raw, opts) => {
    const parsed = parseLeadingJson(raw);
    const parsedObj = toObject(parsed);
    const rows = extractRowsFromParsed(parsed);
    const error = extractErrorFromParsed(parsed) ?? extractHintFromParsed(parsed);
    logPremiumSql({
        durationSec: opts.durationSec,
        rowCount: rows?.length ?? 0,
        error: error ?? undefined,
        sql: opts.sql ?? '',
        templateId: opts.templateId,
    });
    if (error) {
        recordSqlFailure(state, error);
        return JSON.stringify({
            error,
            ...(opts.templateId ? { templateId: opts.templateId } : {}),
            ...(parsedObj && !opts.templateId ? parsedObj : {}),
            ...(state.blockSql
                ? {
                    blockSql: true,
                    ...(opts.templateId
                        ? {}
                        : { hint: 'Stop free SQL. Prefer apply_formula / canvas tools.' }),
                }
                : {}),
        });
    }
    if (!rows || rows.length === 0) {
        if (opts.templateId) {
            return JSON.stringify({
                error: 'No rows for template',
                templateId: opts.templateId,
                durationSec: opts.durationSec,
            });
        }
        return JSON.stringify({
            ...(parsedObj ?? (opts.emptyAsRaw ? { raw } : {})),
            durationSec: opts.durationSec,
        });
    }
    const columns = Object.keys(rows[0] ?? {});
    if (columns.length === 0)
        return raw;
    const stored = rowsToDataset(state, rows);
    const metricWarning = implausibleMetricWarning(stored, state.dateRange);
    return datasetToolResult(stored, {
        durationSec: opts.durationSec,
        ...(opts.templateId ? { templateId: opts.templateId } : {}),
        note: stored.columns.includes('joueur')
            ? 'Use joueur as category (never id).'
            : 'Select first_name/last_name — ids cannot be charted.',
        ...(metricWarning ? { warning: metricWarning } : {}),
    });
};
const rowsToDataset = (state, rows) => {
    const columns = Object.keys(rows[0] ?? {});
    const display = toDisplayChartDataset({ id: 'tmp', columns, rows });
    return storeDataset(state, display);
};
export const storeQueryRows = (state, rows) => rowsToDataset(state, rows);
export const extractQueryRows = (raw) => extractRowsFromParsed(parseLeadingJson(raw));
export const extractQueryError = (raw) => {
    const p = parseLeadingJson(raw);
    return extractErrorFromParsed(p) ?? extractHintFromParsed(p);
};
export const safeParseObject = (raw) => toObject(parseLeadingJson(raw));
const sqlFailureKey = (error) => {
    const e = error.toLowerCase();
    if (e.includes('only select') || e.includes('must start with select'))
        return 'select_only';
    if (e.includes('.unit') || e.includes('real .unit') || e.includes('fake unit'))
        return 'unit';
    if (e.includes('syntax') || e.includes('postgres'))
        return 'syntax';
    if (e.includes('does not exist') || e.includes('undefined column'))
        return 'column';
    if (e.includes('timeout') || e.includes('cancel'))
        return 'timeout';
    if (e.includes('permission') || e.includes('denied'))
        return 'permission';
    return e.replace(/\s+/g, ' ').slice(0, 80);
};
const toObject = (parsed) => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return null;
    return parsed;
};
const extractRowsFromParsed = (parsed) => {
    if (!parsed)
        return null;
    const rows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)
            ? parsed.rows
            : null;
    if (!rows)
        return null;
    const objects = rows.filter((row) => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
    return objects.length > 0 ? objects : null;
};
const extractErrorFromParsed = (parsed) => {
    const obj = toObject(parsed);
    return typeof obj?.error === 'string' ? obj.error : null;
};
const extractHintFromParsed = (parsed) => {
    const obj = toObject(parsed);
    if (!obj)
        return null;
    const hint = obj.partition_hint;
    if (typeof hint !== 'string')
        return null;
    return typeof obj.hint === 'string' ? `${hint}: ${obj.hint}` : hint;
};
const parseLeadingJson = (raw) => {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const newline = trimmed.search(/\n\s*\n|\nNOTICE:/);
        if (newline <= 0)
            return null;
        try {
            return JSON.parse(trimmed.slice(0, newline));
        }
        catch {
            return null;
        }
    }
};
//# sourceMappingURL=premium_report_tools.js.map