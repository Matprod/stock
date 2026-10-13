import { Exception } from '@adonisjs/core/exceptions';
import { REPORT_BLOC_TYPES, REPORT_BLOC_TYPE, REPORT_MAX_COMPARE_ATHLETES, REPORT_MAX_COMPARE_VARIABLES, REPORT_CHATBOT_HISTORY_MAX, REPORT_STRUCTURE_MAX_BLOCS, REPORT_CHATBOT_MAX_TOKENS, REPORT_CHATBOT_PROMPT_TITLE, REPORT_CHATBOT_MODEL_ID, REPORT_SERIES_OP, maxBarCompareAthletes, } from '#constants/report_builder.constants';
import Prompt from '#models_pg/prompt';
import { resolvePromptAthleteScope, collectBlocAthleteIds, } from '#services/report_builder/athlete_split';
import { formulaCatalogForLlm } from '#services/report_builder/chatbot/formula_llm';
import { inferDateRangeFromPrompt } from '#services/report_builder/chatbot/infer_date_range';
import { parseChatbotStructure, } from '#services/report_builder/chatbot/parse_chatbot_structure';
import { Claude35SonnetService } from '#services/llm/claude_3.5_sonnet_service';
import ReportBuilderService from '#services/report_builder_service';
import { cleanJsonResponse } from '#utils/chatbot_result';
import db from '@adonisjs/lucid/services/db';
export default class ReportGeneratorChatbotService {
    reportBuilderService = new ReportBuilderService();
    claude = new Claude35SonnetService(REPORT_CHATBOT_MODEL_ID);
    async chat(clubId, input, language) {
        const useImputedMetrics = input.useImputedMetrics === true;
        const dateRange = inferDateRangeFromPrompt(input.prompt, input.dateRange) ?? input.dateRange;
        return this.runChat(clubId, input, language, useImputedMetrics, dateRange);
    }
    async runChat(clubId, input, language, useImputedMetrics, dateRange) {
        const [systemPrompt, catalog, periodAthletes] = await Promise.all([
            Prompt.findBy('title', REPORT_CHATBOT_PROMPT_TITLE),
            this.reportBuilderService.getCatalog(clubId, language, dateRange, useImputedMetrics),
            loadPeriodAthletes(clubId, dateRange),
        ]);
        if (!systemPrompt) {
            throw new Exception(`Prompt not found: ${REPORT_CHATBOT_PROMPT_TITLE}`, { status: 500 });
        }
        const catalogKeys = new Set(catalog.variables.map((variable) => variable.key));
        const catalogUnits = new Map(catalog.variables.map((variable) => [variable.key, variable.unit]));
        const catalogNames = new Map(catalog.variables.map((variable) => [variable.key, variable.name]));
        const history = (input.history ?? []).slice(-REPORT_CHATBOT_HISTORY_MAX);
        const catalogByPrefix = {};
        for (const variable of catalog.variables) {
            const separator = variable.key.indexOf(':');
            const prefix = separator > 0 ? variable.key.slice(0, separator) : variable.group;
            const list = catalogByPrefix[prefix] ?? [];
            list.push({ key: variable.key, name: variable.name, unit: variable.unit });
            catalogByPrefix[prefix] = list;
        }
        const athleteScope = resolvePromptAthleteScope(input.prompt, periodAthletes);
        const positionsByKey = {};
        for (const athlete of periodAthletes) {
            if (!athlete.position)
                continue;
            const list = positionsByKey[athlete.position] ?? [];
            list.push({ id: athlete.id, name: athlete.name });
            positionsByKey[athlete.position] = list;
        }
        const dataPrompt = JSON.stringify({
            language,
            catalog: catalogByPrefix,
            periodAthletes,
            positions: positionsByKey,
            limits: {
                maxBlocs: REPORT_STRUCTURE_MAX_BLOCS,
                blocTypes: REPORT_BLOC_TYPES,
                maxCompareAthletes: REPORT_MAX_COMPARE_ATHLETES,
                maxBarCompareAthletes: maxBarCompareAthletes(dateRange.from, dateRange.to),
                maxBarCompareAthletesSingleValue: maxBarCompareAthletes(dateRange.from, dateRange.to, {
                    singleValue: true,
                }),
                maxCompareVariables: REPORT_MAX_COMPARE_VARIABLES,
                periodAthleteCount: periodAthletes.length,
                seriesOp: {
                    identity: '1 var',
                    sum: '2+ same unit',
                    sub: '2 vars A-B same unit',
                    mul: '2 vars',
                    div: '2 vars A/B',
                },
                convert: 'series.convert is a target unit (s|min|h|m|km). Use it to change display units before the formula (minutes→seconds: convert "s"). Incompatible families are dropped.',
                colors: 'series.color is #RRGGBB. theme.colors overrides the default palette. Prefer patches to recolor an existing series.',
                dash: 'series.dash is solid|dashed|dotted. French "pointillés" / dotted → dotted; tirets / dashed → dashed. Never invent Chart.js options — only dash/color/label.',
                textBloc: 'type "text" is free prose (captions, notes). Place with patches addBloc after:"end" for the bottom, or after:<blocId> to sit under a chart.',
                patches: 'Edits MUST use patches against current.blocs — do not regenerate the whole document. Ops: addBloc (after: start|end|<id>), updateBloc, removeBloc, updateSeries (flat fields: blocId, seriesId from current.blocs[].series[].id, match as catalog-name fragment, label, dash, color — do not nest a patch object), setTheme. Rename a line with updateSeries label. Dotted/dashed with updateSeries dash. Full blocs[] only when building a report from scratch or the user asks to replace everything.',
                formulas: formulaCatalogForLlm(),
                formulaUse: 'Pick formula by intent — omit when raw daily overlay is enough. Never default every line to ma n=7. Prefer ewma over ma for load trends. n is any positive integer (7/14/28 are defaults, not a whitelist). Routing: smooth→ewma|ma|median_ma; season volume→cumulative; ACWR→acwr_ewma (prefer) or acwr_ma; Foster→monotony|strain; KPI→sum|mean|median|min|max|sd|cv|p25|p75|p90|p95; vs self→zscore|pct_baseline|delta_pct. Diversify across trend blocs. One formula/series; set params only when not defaults. Convert units then apply the formula (e.g. convert s + mean).',
                table: 'table + derived:injuryLog',
                athleteScope: 'You own the athlete set. current.athleteIds is the canvas set. For a position group (defenders, midfielders…), include EVERY matching id from positions.* / periodAthletes — never a sample of 2. Return the FULL resulting athleteIds (top-level and/or per bloc). Operations: replace/filter → that subset only; add → union(current.athleteIds, new athletes) or a new bloc with the full added group; remove → current minus those athletes. Prefer split "athlete" when comparing several athletes.',
                athleteSplit: 'split "athlete" when comparing several athletes/positions/team. When only the athlete set changes, keep the same blocs/series/variables and update athleteIds — keep JSON compact. Caps: maxCompareAthletes for line/pie; bars use maxBarCompareAthletes; KPI athlete-split has no athlete cap.',
                catalogPolicy: 'current.dateRange is the report period. Catalog keys listed for that period have measured data — build from them. You may adjust dateRange when the user asks for another window; only use keys valid for the period you return.',
            },
            current: {
                title: input.title,
                dateRange,
                athleteIds: collectBlocAthleteIds(input.blocs),
                blocs: compactCurrentBlocs(input.blocs, catalogNames),
                theme: input.theme,
                useImputedMetrics,
            },
        });
        const raw = await this.claude.generateResponse({
            systemPrompt: systemPrompt.content,
            dataPrompt,
            prompt: input.prompt,
            history: [{ role: 'assistant', content: 'Ready.' }, ...history],
            responseFormat: 'json',
            maxTokens: REPORT_CHATBOT_MAX_TOKENS,
        });
        let parsed;
        try {
            parsed = JSON.parse(cleanJsonResponse(raw));
        }
        catch {
            throw new Exception('Invalid report structure', { status: 422 });
        }
        const sanitized = parseChatbotStructure(parsed, catalogKeys, catalogUnits, periodAthletes, dateRange, input.blocs, athleteScope, catalogNames);
        if (!sanitized)
            throw new Exception('Invalid report structure', { status: 422 });
        const hasContent = sanitized.blocs.some((bloc) => bloc.type === REPORT_BLOC_TYPE.TEXT ||
            (bloc.variables?.length ?? 0) > 0 ||
            (bloc.series ?? []).some((series) => series.variables.length > 0));
        if (!hasContent) {
            return {
                title: sanitized.title,
                dateRange: sanitized.dateRange,
                blocs: input.blocs,
                theme: sanitized.theme ?? input.theme,
                useImputedMetrics,
                message: sanitized.message,
            };
        }
        const normalized = await this.reportBuilderService.normalizeInput(clubId, {
            ...sanitized,
            theme: sanitized.theme ?? input.theme,
            useImputedMetrics,
        });
        return { ...normalized, message: sanitized.message };
    }
}
const loadPeriodAthletes = async (clubId, dateRange) => {
    const rows = (await db
        .from('athletes as a')
        .join('days as d', 'd.athlete_id', 'a.id')
        .leftJoin('player_positions as pp', 'pp.id', 'a.player_position_id')
        .where('a.club_id', clubId)
        .whereBetween('d.date_of_day', [dateRange.from, dateRange.to])
        .groupBy('a.id', 'a.first_name', 'a.last_name', 'pp.name')
        .orderBy('a.last_name')
        .orderBy('a.first_name')
        .select('a.id', 'a.first_name', 'a.last_name', 'pp.name as position'));
    return rows.map((row) => ({
        id: row.id,
        name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.replace(/\s+/g, ' ').trim(),
        position: row.position?.trim() ? row.position.trim() : null,
    }));
};
const compactCurrentBlocs = (blocs, catalogNames) => blocs.map((bloc) => {
    const series = bloc.series?.length
        ? bloc.series
        : (bloc.variables ?? []).map((key) => ({
            id: key,
            op: REPORT_SERIES_OP.IDENTITY,
            variables: [key],
        }));
    return {
        id: bloc.id,
        type: bloc.type,
        split: bloc.split,
        ...(bloc.text ? { text: bloc.text } : {}),
        variables: [...new Set(series.flatMap((item) => item.variables))],
        series: series.map((item) => {
            const names = item.variables
                .map((key) => catalogNames.get(key))
                .filter((name) => Boolean(name));
            return {
                id: item.id,
                op: item.op,
                variables: item.variables,
                ...(names[0] ? { name: names[0] } : {}),
                ...(item.label ? { label: item.label } : {}),
                ...(item.formula ? { formula: item.formula } : {}),
                ...(item.convert ? { convert: item.convert } : {}),
                ...(item.color ? { color: item.color } : {}),
                ...(item.dash ? { dash: item.dash } : {}),
            };
        }),
        ...(bloc.athleteIds?.length ? { athleteCount: bloc.athleteIds.length } : {}),
        ...(bloc.dateRange ? { dateRange: bloc.dateRange } : {}),
    };
});
//# sourceMappingURL=report_generator_chatbot_service.js.map