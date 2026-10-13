import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, } from '@aws-sdk/client-bedrock-runtime';
import env from '#start/env';
import { PREMIUM_REPORT_ANTHROPIC_VERSION, PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK, PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK, PREMIUM_REPORT_FORCE_ANSWER_AT, PREMIUM_REPORT_INPUT_USD_PER_MTOK, PREMIUM_REPORT_MAX_ITERATIONS, PREMIUM_REPORT_MAX_TOKENS, PREMIUM_REPORT_MODEL_ID, PREMIUM_REPORT_OUTPUT_USD_PER_MTOK, PREMIUM_REPORT_SHIP_NUDGE_AT, PREMIUM_REPORT_TEMPERATURE, PREMIUM_TOOL_HISTORY_CAP, PREMIUM_TOOL_HISTORY_TRIM, } from '#constants/premium_report.constants';
import { consumeBedrockStream } from '#utils/agent/agent_bedrock_stream';
import { elapsedSec, logPremiumIteration, logPremiumTool, } from '#services/premium_report/premium_report_log';
import { detectToolLoop } from '#services/premium_report/premium_report_query_validator';
let bedrockClient;
const getClient = () => {
    bedrockClient ??= new BedrockRuntimeClient({
        region: env.get('AWS_REGION'),
        credentials: {
            accessKeyId: env.get('AWS_ACCESS_KEY'),
            secretAccessKey: env.get('AWS_SECRET_KEY'),
        },
    });
    return bedrockClient;
};
const SQL_TOOL_NAMES = new Set([
    'query_database',
    'build_load_summary',
    'fetch_srpe_daily',
    'fetch_gps_distance',
    'fetch_gps_intensity',
    'fetch_match_stats',
    'fetch_biomarkers',
    'fetch_vald_tests',
    'fetch_body_metrics',
]);
const ERROR_KEY_RE = /"error"\s*:/;
const CACHE_EPHEMERAL = { type: 'ephemeral' };
const pushUserNudge = (messages, content) => {
    messages.push({ role: 'user', content });
};
const retryAfterIdleEndTurn = (messages, turnContent, content) => {
    messages.push({ role: 'assistant', content: turnContent });
    pushUserNudge(messages, content);
};
const shipNudgeMessage = (state) => {
    const chartCount = state.document.blocks.filter((block) => block.type === 'chart').length;
    if (state.timeSeriesAsk && chartCount === 0) {
        return 'TIME-SERIES: canvas still has 0 charts. Filter the GPS daily dataset by injured joueurs and add_chart chartType=line on player_load (or dsl). Do not free-SQL hunt pm.name. Do not chart take_latest/summary snapshots.';
    }
    if (state.document.blocks.length > 0 && state.datasets.size > 0) {
        return 'Budget low. Stop fetch/formula/retry. Finish with existing datasetIds (≤4 viz + short captions) then end_turn.';
    }
    if (state.mustUseTools && state.toolHistory.length === 0) {
        return 'Budget low and still 0 tools. Call build_load_summary or fetch_* then add_chart now, then end_turn.';
    }
    return null;
};
const toolsWithCache = (schemas) => {
    if (schemas.length === 0)
        return schemas;
    return schemas.map((schema, index) => index === schemas.length - 1 ? { ...schema, cache_control: CACHE_EPHEMERAL } : schema);
};
export const runPremiumReportAgent = async (args) => {
    const client = getClient();
    const messages = [
        ...normalizeHistory(args.history),
        {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: args.userPrompt,
                    cache_control: CACHE_EPHEMERAL,
                },
            ],
        },
    ];
    let circuitNudgeSent = false;
    let shipNudgeSent = false;
    let idleToolNudgeSent = false;
    let unchangedCanvasNudgeSent = false;
    const startBlocksSnap = JSON.stringify(args.state.document.blocks);
    const totals = emptyUsage();
    for (let iteration = 1; iteration <= PREMIUM_REPORT_MAX_ITERATIONS; iteration++) {
        const toolsEnabled = iteration < PREMIUM_REPORT_FORCE_ANSWER_AT;
        if (iteration === PREMIUM_REPORT_FORCE_ANSWER_AT) {
            pushUserNudge(messages, 'Tools disabled. Brief staff summary of the canvas only. No SQL/tools/limits talk.');
        }
        else if (!shipNudgeSent && iteration === PREMIUM_REPORT_SHIP_NUDGE_AT) {
            const nudge = shipNudgeMessage(args.state);
            if (nudge) {
                shipNudgeSent = true;
                pushUserNudge(messages, nudge);
            }
        }
        if (args.state.blockSql && !circuitNudgeSent) {
            circuitNudgeSent = true;
            pushUserNudge(messages, 'SQL disabled. Finish with existing datasetIds (apply_formula / join / correlate / canvas). No SQL talk.');
        }
        const activeTools = toolsEnabled
            ? args.state.blockSql
                ? args.tools.filter((tool) => !SQL_TOOL_NAMES.has(tool.schema.name))
                : args.tools
            : [];
        const toolMap = new Map(activeTools.map((tool) => [tool.schema.name, tool]));
        const toolSchemas = toolsWithCache(activeTools.map((tool) => tool.schema));
        const iterationStarted = Date.now();
        const raw = await client.send(new InvokeModelWithResponseStreamCommand({
            modelId: PREMIUM_REPORT_MODEL_ID,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: PREMIUM_REPORT_ANTHROPIC_VERSION,
                max_tokens: PREMIUM_REPORT_MAX_TOKENS,
                temperature: PREMIUM_REPORT_TEMPERATURE,
                system: [
                    {
                        type: 'text',
                        text: args.systemPrompt,
                        cache_control: CACHE_EPHEMERAL,
                    },
                ],
                tools: toolSchemas,
                messages,
            }),
        }));
        const turn = await consumeBedrockStream({
            body: raw.body,
            shouldStreamToClient: false,
            filterJsonResponse: false,
        });
        addUsage(totals, turn.usage);
        const uses = turn.content.filter((block) => block.type === 'tool_use');
        logPremiumIteration({
            iteration,
            stopReason: turn.stopReason,
            durationSec: elapsedSec(iterationStarted),
            toolCount: uses.length,
            usage: {
                ...turn.usage,
                totalTokens: turn.usage.inputTokens + turn.usage.outputTokens,
                estimatedCostUsd: estimateCostUsd(turn.usage),
            },
            cumulative: totals,
        });
        if (turn.stopReason === 'end_turn' || turn.stopReason === 'max_tokens') {
            const canvasUnchanged = JSON.stringify(args.state.document.blocks) === startBlocksSnap;
            const noToolsYet = uses.length === 0 && args.state.toolHistory.length === 0;
            if (toolsEnabled && args.state.mustUseTools && noToolsYet && !idleToolNudgeSent) {
                idleToolNudgeSent = true;
                retryAfterIdleEndTurn(messages, turn.content, '0 tools called. datasets=[] this turn — call build_load_summary (monotony/strain/ACWR) or the right fetch_*, then add_chart/add_table. Do not end_turn until the canvas changes for this request. Do not claim you added charts/tables in chat text.');
                continue;
            }
            if (toolsEnabled && args.state.mustUseTools && canvasUnchanged && !unchangedCanvasNudgeSent) {
                unchangedCanvasNudgeSent = true;
                retryAfterIdleEndTurn(messages, turn.content, 'Canvas blocks are UNCHANGED. Chat text does not count. Call tools that mutate the canvas (add_chart / add_table after build_load_summary or fetch_*). Never claim a graph was created unless add_chart returned ok.');
                continue;
            }
            return {
                message: turn.iterationText.trim() || 'Report updated.',
                iterations: iteration,
                usage: { ...totals },
            };
        }
        if (turn.stopReason === 'tool_use') {
            messages.push({ role: 'assistant', content: turn.content });
            const loop = detectToolLoop({ toolHistory: args.state.toolHistory });
            const toolResults = [];
            const ordered = uses.sort((a, b) => toolPriority(String(a.name ?? '')) - toolPriority(String(b.name ?? '')));
            for (const block of ordered) {
                const name = String(block.name ?? '');
                const tool = toolMap.get(name);
                const input = block.input && typeof block.input === 'object' && !Array.isArray(block.input)
                    ? block.input
                    : {};
                args.state.toolHistory.push({ name, input, timestamp: Date.now() });
                if (args.state.toolHistory.length > PREMIUM_TOOL_HISTORY_CAP) {
                    args.state.toolHistory = args.state.toolHistory.slice(-PREMIUM_TOOL_HISTORY_TRIM);
                }
                const toolStarted = Date.now();
                let result;
                if (loop.isStuck) {
                    result = JSON.stringify({
                        error: `Iteration loop detected. ${loop.suggestion}`,
                        stuck: true,
                        suggestion: 'Ship current canvas immediately—stop calling tools.',
                    });
                }
                else {
                    result = tool
                        ? await tool.execute(input)
                        : JSON.stringify({
                            error: args.state.blockSql
                                ? `Tool ${name} unavailable (SQL path closed). Use canvas/formula tools.`
                                : `Unknown tool: ${name}. ${TOOL_ALIASES[name] ?? 'Check available tools.'}`,
                        });
                }
                const durationSec = elapsedSec(toolStarted);
                const ok = !ERROR_KEY_RE.test(result.slice(0, 200));
                logPremiumTool({ tool: name, ok: loop.isStuck ? false : ok, durationSec, detail: loop.isStuck ? 'LOOP_DETECTED' : summarizeToolDetail(name, input) });
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: result,
                });
            }
            messages.push({ role: 'user', content: toolResults });
        }
    }
    return {
        message: 'Max iterations reached without a final answer.',
        iterations: PREMIUM_REPORT_MAX_ITERATIONS,
        usage: { ...totals },
    };
};
export const emptyUsage = () => ({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
});
const addUsage = (totals, usage) => {
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.cacheReadInputTokens += usage.cacheReadInputTokens;
    totals.cacheCreationInputTokens += usage.cacheCreationInputTokens;
    totals.totalTokens = totals.inputTokens + totals.outputTokens;
    totals.estimatedCostUsd = estimateCostUsd(totals);
};
export const estimateCostUsd = (usage) => {
    const usd = (usage.inputTokens / 1_000_000) * PREMIUM_REPORT_INPUT_USD_PER_MTOK +
        (usage.outputTokens / 1_000_000) * PREMIUM_REPORT_OUTPUT_USD_PER_MTOK +
        (usage.cacheReadInputTokens / 1_000_000) * PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK +
        (usage.cacheCreationInputTokens / 1_000_000) * PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK;
    return Number(usd.toFixed(6));
};
const summarizeToolDetail = (name, input) => {
    if (name === 'query_database')
        return undefined;
    if (name === 'build_load_summary' || name.startsWith('fetch_')) {
        return `${input.from ?? '?'} → ${input.to ?? '?'}`;
    }
    if (name === 'apply_formula')
        return String(input.id ?? '');
    if (name === 'transform_columns')
        return String(input.recipe ?? input.op ?? '');
    if (name === 'correlate')
        return String(input.mode ?? 'matrix');
    if ((name === 'add_chart' || name === 'add_table') && typeof input.datasetId === 'string') {
        return input.datasetId;
    }
    return undefined;
};
const TOOL_ALIASES = {
    scale_values: 'Use transform_columns recipe=scale.',
    convert_units: 'Use transform_columns recipe=scale.',
    rename_columns: 'Use update_block renameColumns.',
    fetch_biomarker_values: 'Use fetch_biomarkers.',
    fetch_markers: 'Use fetch_biomarkers.',
    fetch_vald: 'Use fetch_vald_tests.',
    fetch_capacity: 'Use fetch_biomarkers / fetch_vald_tests / fetch_body_metrics.',
    fetch_match: 'Use fetch_match_stats.',
    fetch_matches: 'Use fetch_match_stats.',
    fetch_game_stats: 'Use fetch_match_stats.',
};
const toolPriority = (name) => {
    if (name === 'build_load_summary')
        return 10;
    if (name.startsWith('fetch_'))
        return 20;
    if (name === 'query_database')
        return 30;
    if (name === 'fill_daily_zeros')
        return 40;
    if (name === 'transform_columns' || name === 'apply_formula')
        return 50;
    if (name === 'correlate')
        return 60;
    if (['take_latest', 'filter_dataset', 'drop_empty_columns', 'join_datasets'].includes(name)) {
        return 70;
    }
    return 100;
};
const normalizeHistory = (history) => {
    const merged = [];
    for (const turn of history) {
        const last = merged[merged.length - 1];
        if (last && last.role === turn.role) {
            last.content = `${last.content}\n${turn.content}`;
            continue;
        }
        merged.push({ role: turn.role, content: turn.content });
    }
    while (merged.length > 0 && merged[merged.length - 1].role === 'user')
        merged.pop();
    if (merged[0]?.role === 'assistant')
        merged.shift();
    return merged;
};
//# sourceMappingURL=premium_report_agent.js.map