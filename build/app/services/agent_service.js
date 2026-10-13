import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand, } from '@aws-sdk/client-bedrock-runtime';
import env from '#start/env';
import { AGENT_TEMPERATURE, FORCE_ANSWER_AT, MAX_ITERATIONS, MODEL_ID, SERIES_QUESTION_HINT, SERIES_TO_PERIOD_METRICS_FALLBACK_HINT, TOKEN_LIMIT_CONTINUE_HINT, TOOL_STATUS_LABELS, } from '#constants/agent.constants';
import { MAX_SERIES_CHARTS, SERIES_FORCE_ANSWER_AT } from '#constants/agent_series.constants';
import { isSeriesChartQuestion, parseSeriesAutoDecoded, parseSeriesMetadata, } from '#utils/agent/agent_series';
import { autoDecodeSeriesToolResult } from '#services/agent_series_service';
import { createDbTool } from '#services/agent_db_tool';
import { buildSystemPrompt } from '#utils/agent/agent_prompts';
import { appendForceAnswerHint, consumeBedrockStream } from '#utils/agent/agent_bedrock_stream';
import { buildStatusMessage, createChartTool } from '#services/agent_tools';
export { createDbTool } from '#services/agent_db_tool';
export { createTeamPartitionState } from '#utils/agent/agent_partition';
export { createResponseStructureTool } from '#services/agent_tools';
const DEFAULT_MAX_TOKENS = 8192;
const getClient = () => new BedrockRuntimeClient({
    region: env.get('AWS_REGION'),
    credentials: {
        accessKeyId: env.get('AWS_ACCESS_KEY'),
        secretAccessKey: env.get('AWS_SECRET_KEY'),
    },
});
const isSeriesQuerySql = (sql) => /\bseries\b/i.test(sql) ||
    /\bTOTAL_DISTANCE_IN_METERS\b|\bHEART_RATE\b|\bSPEED_METERS_PER_SECOND\b/i.test(sql);
const isEmptySeriesToolResult = (result) => {
    if (result.includes('NO_CHARTABLE_SERIES'))
        return true;
    try {
        const parsed = JSON.parse(result);
        if (parsed?.error === 'NO_CHARTABLE_SERIES')
            return true;
        if (parsed?.auto_decoded === true && (parsed.curveCount ?? 0) === 0)
            return true;
    }
    catch { }
    return false;
};
const executeToolTurn = async (args) => {
    const { content, toolMap, context, question, charts, pushChart, seriesMode, onStatus } = args;
    let { seriesDecodedOnce, seriesMissed } = args.flags;
    const toolUseBlocks = content.filter((b) => b.type === 'tool_use');
    onStatus?.(buildStatusMessage(toolUseBlocks.map((b) => b.name)));
    const toolResults = [];
    for (const block of toolUseBlocks) {
        const toolName = block.name;
        const tool = toolMap.get(toolName);
        let result = tool
            ? await tool.execute(block.input)
            : JSON.stringify({ error: `Unknown tool: ${toolName}` });
        if (toolName === 'query_database') {
            const sql = String(block.input?.sql ?? '');
            if (seriesMode && isSeriesQuerySql(sql) && isEmptySeriesToolResult(result)) {
                seriesMissed = true;
            }
            if (seriesMode) {
                if (seriesDecodedOnce && parseSeriesMetadata(result)) {
                    result = JSON.stringify({
                        error: 'SERIES_ALREADY_DECODED',
                        n: charts.length,
                        note: 'Charts already registered. Write the final answer.',
                    });
                }
                else if (!seriesDecodedOnce) {
                    const before = charts.length;
                    const decoded = await autoDecodeSeriesToolResult(result, context, pushChart, question);
                    if (decoded) {
                        onStatus?.(TOOL_STATUS_LABELS.decode_series);
                        result = decoded;
                        if (parseSeriesAutoDecoded(decoded) && charts.length > before) {
                            seriesDecodedOnce = true;
                        }
                        else if (isEmptySeriesToolResult(decoded)) {
                            seriesMissed = true;
                        }
                    }
                }
            }
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    return {
        toolResults,
        flags: { seriesDecodedOnce, seriesMissed },
    };
};
export default class AgentService {
    run = async (question, tools, history = [], context, onTextToken, onStatus) => {
        const start = Date.now();
        const client = getClient();
        let seriesMode = isSeriesChartQuestion(question);
        let systemPrompt = await buildSystemPrompt(context, { leanSeries: seriesMode });
        let forceAnswerAt = seriesMode ? SERIES_FORCE_ANSWER_AT + 1 : FORCE_ANSWER_AT;
        const maxTokens = DEFAULT_MAX_TOKENS;
        const userQuestion = seriesMode ? `${question}\n${SERIES_QUESTION_HINT}` : question;
        const messages = [
            ...(seriesMode ? [] : history).map((h) => ({
                role: h.role,
                content: h.content,
            })),
            { role: 'user', content: userQuestion },
        ];
        const charts = [];
        const pushChart = (spec) => {
            if (!seriesMode || charts.length < MAX_SERIES_CHARTS)
                charts.push(spec);
        };
        const chartTool = createChartTool(pushChart);
        let allTools = seriesMode ? [...tools] : [...tools, chartTool];
        let toolSchemas = allTools.map((t) => t.schema);
        let toolMap = new Map(allTools.map((t) => [t.schema.name, t]));
        let fallenBackFromSeries = false;
        let flags = { seriesDecodedOnce: false, seriesMissed: false };
        let hasCompletedToolRound = false;
        const fallbackSeriesToPeriodMetrics = async (iteration, opts) => {
            if (!seriesMode || fallenBackFromSeries)
                return false;
            if (opts?.requireEmptyCharts && charts.length > 0)
                return false;
            if (opts?.assistantContent !== undefined) {
                messages.push({ role: 'assistant', content: opts.assistantContent });
            }
            fallenBackFromSeries = true;
            seriesMode = false;
            flags = { seriesDecodedOnce: false, seriesMissed: false };
            const fullDbTool = await createDbTool(question, context, undefined, {
                seriesOnly: false,
                useVannaExamples: false,
            });
            allTools = [fullDbTool, chartTool];
            toolSchemas = allTools.map((t) => t.schema);
            toolMap = new Map(allTools.map((t) => [t.schema.name, t]));
            systemPrompt = await buildSystemPrompt(context, { leanSeries: false });
            forceAnswerAt = Math.min(MAX_ITERATIONS, Math.max(forceAnswerAt, iteration + 5));
            messages.push({ role: 'user', content: SERIES_TO_PERIOD_METRICS_FALLBACK_HINT });
            return true;
        };
        const finish = (answer, iterations) => ({
            answer,
            iterations,
            duration_ms: Date.now() - start,
            charts,
        });
        const filterJsonResponse = context?.mode === 'team' || context?.mode === 'athlete';
        for (let i = 1; i <= MAX_ITERATIONS; i++) {
            if (i >= forceAnswerAt) {
                await fallbackSeriesToPeriodMetrics(i, { requireEmptyCharts: true });
            }
            appendForceAnswerHint({
                messages,
                iteration: i,
                forceAnswerAt,
                seriesIntent: seriesMode,
                seriesDecodedOnce: flags.seriesDecodedOnce,
                seriesForceAnswerAt: SERIES_FORCE_ANSWER_AT,
            });
            const iterationStatus = i < forceAnswerAt;
            const shouldStreamToClient = !iterationStatus || hasCompletedToolRound;
            const body = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: maxTokens,
                temperature: AGENT_TEMPERATURE,
                system: systemPrompt,
                tools: iterationStatus ? toolSchemas : [],
                messages,
            };
            const raw = await client.send(new InvokeModelWithResponseStreamCommand({
                modelId: MODEL_ID,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(body),
            }));
            const turn = await consumeBedrockStream({
                body: raw.body,
                shouldStreamToClient,
                filterJsonResponse,
                onTextToken,
            });
            if (turn.stopReason === 'end_turn') {
                if (await fallbackSeriesToPeriodMetrics(i, {
                    requireEmptyCharts: true,
                    assistantContent: turn.content,
                })) {
                    continue;
                }
                turn.flushBufferedFinalAnswer(turn.iterationText);
                return finish(turn.iterationText, i);
            }
            if (turn.stopReason === 'max_tokens' && turn.iterationText.trim().length > 0) {
                if (i < forceAnswerAt) {
                    messages.push({ role: 'assistant', content: turn.content });
                    messages.push({
                        role: 'user',
                        content: TOKEN_LIMIT_CONTINUE_HINT,
                    });
                    continue;
                }
                if (await fallbackSeriesToPeriodMetrics(i, {
                    requireEmptyCharts: true,
                    assistantContent: turn.content,
                })) {
                    continue;
                }
                turn.flushBufferedFinalAnswer(turn.iterationText);
                return finish(turn.iterationText, i);
            }
            if (turn.stopReason === 'tool_use') {
                messages.push({ role: 'assistant', content: turn.content });
                const toolTurn = await executeToolTurn({
                    content: turn.content,
                    toolMap,
                    context,
                    question,
                    charts,
                    pushChart,
                    flags,
                    seriesMode,
                    onStatus,
                });
                flags = toolTurn.flags;
                messages.push({ role: 'user', content: toolTurn.toolResults });
                hasCompletedToolRound = true;
                if (toolTurn.flags.seriesMissed) {
                    await fallbackSeriesToPeriodMetrics(i);
                }
            }
        }
        return finish('Max iterations reached without a final answer.', MAX_ITERATIONS);
    };
}
//# sourceMappingURL=agent_service.js.map