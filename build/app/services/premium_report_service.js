import { Exception } from '@adonisjs/core/exceptions';
import logger from '@adonisjs/core/services/logger';
import Athlete from '#models_pg/athlete';
import Club from '#models_pg/club';
import { PREMIUM_REPORT_HISTORY_MAX, PREMIUM_REPORT_SQL_MAX_BYTES, PREMIUM_REPORT_SQL_MAX_ROWS, } from '#constants/premium_report.constants';
import { getChatbotMetricWhitelist } from '#constants/chatbot.constants';
import { wantsTimeSeriesCharts } from '#constants/premium_report_domains';
import { gpsIntensityKpisForClub, playerLoadSourcesForClub, } from '#constants/premium_report_metrics';
import { createDbTool } from '#services/agent_db_tool';
import { formulaCatalogForLlm } from '#services/report_builder/chatbot/formula_llm';
import { clonePremiumDocument, compactPremiumDocument, emptyPremiumDocument, sanitizeIncomingDocument, } from '#services/premium_report/premium_report_document';
import { runPremiumReportAgent } from '#services/premium_report/premium_report_agent';
import { createPremiumDataTools, allowedFormulaIds } from '#services/premium_report/tools_data';
import { createPremiumMacroTools } from '#services/premium_report/tools_macros';
import { detectPremiumDomains, } from '#services/premium_report/premium_report_intent';
import { schemaTitlesForDomains } from '#constants/premium_report_domains';
import { loadPremiumReportPrompt } from '#services/premium_report/premium_report_prompt';
import { buildPremiumReportPdf } from '#services/premium_report/premium_report_pdf';
import { wrapQueryTool, } from '#services/premium_report/premium_report_tools';
import { createPremiumDocumentTools } from '#services/premium_report/tools_document';
import { ensureTimeSeriesCharts, } from '#services/premium_report/ensure_canvas_charts';
import { ensureDistanceColumnsInKm, mustUseToolsForPrompt, wantsCanvasEdit, wantsDistanceInKm, } from '#services/premium_report/ensure_canvas_units';
import { isSparseCoverage, probePremiumCoverage, sparseDataMessage, } from '#services/premium_report/premium_report_coverage';
export default class PremiumReportService {
    async generate(clubId, input, language) {
        const started = Date.now();
        const club = await Club.find(clubId);
        if (!club)
            throw new Exception('Club not found', { status: 404 });
        const athleteIds = await resolveAthleteIds(clubId, input.athleteIds ?? input.document?.athleteIds);
        const dateRange = input.dateRange;
        const document = input.document
            ? sanitizeIncomingDocument(input.document, dateRange, language)
            : emptyPremiumDocument(dateRange, athleteIds);
        document.dateRange = { from: dateRange.from, to: dateRange.to };
        if (athleteIds.length)
            document.athleteIds = athleteIds;
        const scopedAthleteIds = athleteIds.length > 0 ? athleteIds : await loadAllAthleteIds(clubId);
        const coverage = await probePremiumCoverage({
            clubId,
            dateRange,
            athleteIds: scopedAthleteIds,
        });
        if (isSparseCoverage(coverage)) {
            return {
                document,
                message: sparseDataMessage(language, coverage, dateRange),
                iterations: 0,
            };
        }
        const athletes = await loadAthleteNames(clubId, scopedAthleteIds);
        const intent = await detectPremiumDomains(input.prompt);
        const domains = intent.domains;
        const schemaTitles = schemaTitlesForDomains(domains);
        const formulaIds = domains.length ? [...allowedFormulaIds(domains)] : [];
        const insertAtTop = wantsTopInsert(input.prompt);
        const metricWhitelist = getChatbotMetricWhitelist(clubId);
        const gpsKpis = gpsIntensityKpisForClub(clubId);
        const loadSources = playerLoadSourcesForClub(clubId);
        const whitelistNote = metricWhitelist
            ? `Period metrics: club whitelist only (${metricWhitelist.length} names). GPS macros use: ${gpsKpis.map((k) => `${k.alias}←${k.name}`).join(', ')}; player_load←${loadSources.join('|')}. Never invent pm.name outside the club list.`
            : `Period metrics: exclude filtered/noise HR metrics. GPS macros use: ${gpsKpis.map((k) => k.alias).join(', ')}; player_load←${loadSources.join('|')}.`;
        const systemPrompt = `${await loadPremiumReportPrompt(clubId)}

Report for ${club.name} only (club_id '${club.id}'), ${dateRange.from} → ${dateRange.to}. Domains: ${domains.join(', ')}${intent.correlation ? ' · correlation' : ''}.
${whitelistNote}
Prefer build_load_summary / fetch_* / aggregate_dataset over free SQL. Use apply_formula / transform_columns / join_datasets / correlate — never Foster/ACWR/zscore in SQL.
Canvas = final staff report (tables/charts + short add_text captions under key viz). Chat = brief wrap-up. Table heat auto on add_table. Omit chartType to auto-pick.
${wantsTimeSeriesCharts(domains) ? 'TIME-SERIES ASK: ≥1 line chart on date_of_day is mandatory before end_turn.' : ''}`;
        const beforeSnap = JSON.stringify(document.blocks);
        const state = {
            document: clonePremiumDocument(document),
            datasets: new Map(),
            defaultAfter: insertAtTop ? 'start' : 'end',
            dateRange: { from: dateRange.from, to: dateRange.to },
            clubId,
            athleteIds,
            language,
            sqlFailures: new Map(),
            blockSql: false,
            toolHistory: [],
            jevValidations: 0,
            jevBlocked: 0,
            timeSeriesAsk: wantsTimeSeriesCharts(domains),
            requestPrompt: input.prompt,
            mustUseTools: mustUseToolsForPrompt(input.prompt, document.blocks.length > 0),
            templateUnitsCache: new Map(),
        };
        const context = {
            mode: 'team',
            clubId,
            clubName: club.name,
            athleteIds: scopedAthleteIds,
            referenceDate: dateRange.to,
            language,
        };
        const dbTool = await createDbTool(input.prompt, context, undefined, {
            seriesOnly: false,
            skipTeamPartition: true,
            maxResultRows: PREMIUM_REPORT_SQL_MAX_ROWS,
            maxResultBytes: PREMIUM_REPORT_SQL_MAX_BYTES,
            useVannaExamples: false,
            forceDomainTitles: schemaTitles,
        });
        const runSql = async (sql) => dbTool.execute({ sql });
        const tools = [
            wrapQueryTool(dbTool, state),
            ...createPremiumMacroTools({ state, runSql, domains }),
            ...createPremiumDataTools(state, { domains }),
            ...createPremiumDocumentTools(state),
        ];
        const userPrompt = JSON.stringify({
            language,
            club: { id: club.id, name: club.name },
            dateRange,
            athletes,
            domains,
            correlation: intent.correlation,
            periodMetricWhitelist: metricWhitelist ?? undefined,
            gpsMacroColumns: gpsKpis.map((k) => k.alias),
            playerLoadSources: loadSources,
            athleteScope: athleteIds.length > 0
                ? `listed athletes only — a.id IN (...) AND a.club_id = '${club.id}'`
                : `whole club — a.club_id = '${club.id}'`,
            rosterNote: 'ONLY these athletes belong to this club.',
            formulas: formulaCatalogForLlm({ formulaIds }),
            dataTools: 'apply_formula | transform_columns | transform_values | join_datasets | aggregate_dataset(groupBy=poste) | correlate | take_latest | filter_dataset | fill_daily_zeros. Group compares → aggregate then bar(poste). Heat auto on add_table.',
            canvasEdit: state.document.blocks.length > 0 && wantsCanvasEdit(input.prompt)
                ? 'EXISTING CANVAS EDIT: use transform_values (m→km = multiply 0.001 on distance columns). Do not end_turn without tools. datasets may be empty — transform canvas blocks directly.'
                : state.document.blocks.length > 0 && state.mustUseTools
                    ? 'EXISTING CANVAS + datasets=[] every turn. New graph/metric asks REQUIRE macros (build_load_summary for monotony/strain/ACWR, fetch_* otherwise) then add_chart/add_table. NEVER end_turn on turn 1 without tools — do not claim the canvas already answers unless you verified a matching viz.'
                    : undefined,
            current: compactPremiumDocument(state.document),
            insert: insertAtTop
                ? 'Place NEW blocks at the top (after=start then chain).'
                : 'Append NEW blocks at the end unless after is set.',
            request: input.prompt,
        });
        try {
            const history = (input.history ?? []).slice(-PREMIUM_REPORT_HISTORY_MAX);
            const result = await runPremiumReportAgent({
                systemPrompt,
                userPrompt,
                history,
                tools,
                state,
            });
            if (!state.document.title.trim()) {
                state.document.title = input.prompt.replace(/\s+/g, ' ').trim().slice(0, 80);
            }
            if (state.timeSeriesAsk)
                ensureTimeSeriesCharts(state);
            const distanceKmApplied = wantsDistanceInKm(input.prompt) && state.document.blocks.length > 0
                ? ensureDistanceColumnsInKm(state.document)
                : 0;
            const nextDocument = sanitizeIncomingDocument(state.document, dateRange, language);
            const changed = JSON.stringify(nextDocument.blocks) !== beforeSnap;
            const message = !changed
                ? canvasUnchangedMessage(language, state.toolHistory.length > 0)
                : distanceKmApplied > 0 && !result.message.toLowerCase().includes('km')
                    ? language === 'fr'
                        ? `${result.message.trim()}\n\nDistances converties en km sur ${distanceKmApplied} bloc(s).`
                        : `${result.message.trim()}\n\nConverted distances to km on ${distanceKmApplied} block(s).`
                    : result.message;
            return {
                document: nextDocument,
                message,
                iterations: result.iterations,
            };
        }
        catch (error) {
            logger.error({
                err: error,
                clubId,
                durationSec: Number(((Date.now() - started) / 1000).toFixed(3)),
            }, 'premium_report.generate_failed');
            throw error;
        }
    }
    async exportPdf(clubId, document, language) {
        const club = await Club.find(clubId);
        if (!club)
            throw new Exception('Club not found', { status: 404 });
        const sanitized = sanitizeIncomingDocument(document, document.dateRange, language);
        return buildPremiumReportPdf({
            document: sanitized,
            clubName: club.name,
            language,
        });
    }
}
const clubAthleteIds = async (clubId, only) => {
    const query = Athlete.query().where('clubId', clubId).select('id');
    if (only?.length)
        query.whereIn('id', only);
    return (await query).map((row) => row.id);
};
const resolveAthleteIds = async (clubId, requested) => requested?.length ? clubAthleteIds(clubId, requested) : [];
const loadAllAthleteIds = async (clubId) => clubAthleteIds(clubId);
const loadAthleteNames = async (clubId, athleteIds) => {
    if (athleteIds.length === 0)
        return [];
    const rows = await Athlete.query()
        .where('clubId', clubId)
        .whereIn('id', athleteIds)
        .select('id', 'firstName', 'lastName');
    return rows.map((row) => ({
        id: row.id,
        name: `${row.firstName} ${row.lastName}`.replace(/\s+/g, ' ').trim(),
    }));
};
const wantsTopInsert = (prompt) => /\bat the top\b|top of (the )?(report|document|pdf)|insert at top/i.test(prompt);
const canvasUnchangedMessage = (language, hadTools) => {
    if (language === 'fr') {
        return hadTools
            ? 'Aucun bloc ajouté au canvas (les outils n’ont pas modifié le rapport). Relance la demande — j’appellerai build_load_summary puis add_chart/add_table.'
            : 'Aucun outil appelé : rien n’a été ajouté au canvas. Relance pour générer le graphique (macros + add_chart).';
    }
    return hadTools
        ? 'No canvas blocks were added (tools did not change the report). Retry — I will call build_load_summary then add_chart/add_table.'
        : 'No tools were called, so nothing was added to the canvas. Retry to generate the chart (macros + add_chart).';
};
//# sourceMappingURL=premium_report_service.js.map