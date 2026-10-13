import logger from '@adonisjs/core/services/logger';
const AGENT_BEDROCK_METRICS_LOG = process.env.AGENT_BEDROCK_METRICS_LOG === 'true';
function messageContentCharLen(content) {
    if (typeof content === 'string')
        return content.length;
    try {
        return JSON.stringify(content).length;
    }
    catch {
        return 0;
    }
}
function toolNamesFromAssistantContent(content) {
    if (typeof content === 'string')
        return [];
    const names = [];
    for (const block of content) {
        if (!block || typeof block !== 'object')
            continue;
        const b = block;
        if (b.type === 'tool_use' && b.name)
            names.push(b.name);
    }
    return names;
}
function collectToolUseSequence(messages) {
    const seq = [];
    for (const m of messages) {
        if (m.role !== 'assistant')
            continue;
        seq.push(...toolNamesFromAssistantContent(m.content));
    }
    return seq;
}
function lastAssistantRoundToolNames(messages) {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
        const m = messages[idx];
        if (m.role !== 'assistant')
            continue;
        const names = toolNamesFromAssistantContent(m.content);
        if (names.length > 0)
            return names;
    }
    return [];
}
export function buildInvokeMetrics(args) {
    const messagesChars = args.messages.reduce((acc, m) => acc + messageContentCharLen(m.content), 0);
    let largestIdx = 0;
    let largestChars = 0;
    args.messages.forEach((m, idx) => {
        const c = messageContentCharLen(m.content);
        if (c > largestChars) {
            largestChars = c;
            largestIdx = idx;
        }
    });
    const requestJsonChars = JSON.stringify(args.requestBody).length;
    return {
        iteration: args.iteration,
        iteration_status: args.iterationStatus,
        system_chars: args.systemPrompt.length,
        messages_count: args.messages.length,
        messages_chars: messagesChars,
        tools_schema_chars: args.iterationStatus ? JSON.stringify(args.toolSchemas).length : 0,
        request_json_chars: requestJsonChars,
        approx_input_tokens: Math.ceil(requestJsonChars / 4),
        max_tokens: args.maxTokens,
        largest_message_index: largestIdx,
        largest_message_role: args.messages[largestIdx]?.role ?? '',
        largest_message_chars: largestChars,
        tool_use_sequence: collectToolUseSequence(args.messages),
        last_round_tool_names: lastAssistantRoundToolNames(args.messages),
    };
}
export function logInvokeIterationIfEnabled(metrics, iterationDurationMs) {
    if (!AGENT_BEDROCK_METRICS_LOG)
        return;
    logger.info({ ...metrics, iteration_duration_ms: Math.round(iterationDurationMs) }, '[AGENT_BEDROCK] invoke_request_sizes');
}
export function logAgentReasoningIfEnabled(iteration, text, mode) {
    if (!AGENT_BEDROCK_METRICS_LOG)
        return;
    const trimmed = text.trim();
    if (!trimmed)
        return;
    logger.info({ iteration, mode: mode ?? 'unknown', reasoning: trimmed }, '[AGENT_REASONING] assistant_text');
}
export function logAgentToolCallIfEnabled(iteration, toolName, input, mode) {
    if (!AGENT_BEDROCK_METRICS_LOG)
        return;
    logger.info({ iteration, mode: mode ?? 'unknown', tool: toolName, input }, '[AGENT_TOOL_CALL] tool_use');
}
export function logAgentToolResultIfEnabled(iteration, toolName, result, mode) {
    if (!AGENT_BEDROCK_METRICS_LOG)
        return;
    let parsed;
    try {
        parsed = JSON.parse(result);
    }
    catch {
        parsed = undefined;
    }
    const isArray = Array.isArray(parsed);
    const hasError = !isArray && typeof parsed === 'object' && parsed !== null && 'error' in parsed;
    const preview = result.length > 500 ? `${result.slice(0, 500)}…` : result;
    logger.info({
        iteration,
        mode: mode ?? 'unknown',
        tool: toolName,
        row_count: isArray ? parsed.length : undefined,
        result_chars: result.length,
        error: hasError ? parsed.error : undefined,
        preview,
    }, '[AGENT_TOOL_RESULT] tool_result');
}
export function logBedrockInvokeFailure(err, metrics) {
    const requestId = typeof err === 'object' && err !== null && '$metadata' in err
        ? err.$metadata
            ?.requestId
        : undefined;
    const httpStatus = typeof err === 'object' && err !== null && '$metadata' in err
        ? err.$metadata
            ?.httpStatusCode
        : undefined;
    logger.error({
        ...metrics,
        error_name: err instanceof Error ? err.name : 'unknown',
        error_message: err instanceof Error ? err.message : String(err),
        aws_request_id: requestId,
        aws_http_status: httpStatus,
    }, '[AGENT_BEDROCK] invoke_failed');
}
//# sourceMappingURL=agent_logger.js.map