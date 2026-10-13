import { forwardJsonStringChars } from '#services/llm/claude_3.5_sonnet_service';
const RESPONSE_MARKER = '"response": "';
const createTextForwarder = (onTextToken, filterJsonResponse) => {
    let jsonAccumulated = '';
    let jsonState = 'preamble';
    let jsonEscaped = false;
    const forwardText = (chunk) => {
        if (!onTextToken)
            return;
        if (!filterJsonResponse) {
            onTextToken(chunk);
            return;
        }
        jsonAccumulated += chunk;
        if (jsonState === 'preamble') {
            const idx = jsonAccumulated.indexOf(RESPONSE_MARKER);
            if (idx === -1)
                return;
            jsonState = 'in_value';
            const afterMarker = jsonAccumulated.slice(idx + RESPONSE_MARKER.length);
            const r = forwardJsonStringChars(afterMarker, jsonEscaped, jsonState, onTextToken);
            jsonEscaped = r.escaped;
            jsonState = r.state;
        }
        else if (jsonState === 'in_value') {
            const r = forwardJsonStringChars(chunk, jsonEscaped, jsonState, onTextToken);
            jsonEscaped = r.escaped;
            jsonState = r.state;
        }
    };
    const flushBufferedFinalAnswer = (fullText, streamTokens) => {
        if (!onTextToken || streamTokens || !fullText.trim())
            return;
        if (filterJsonResponse) {
            jsonAccumulated = '';
            jsonState = 'preamble';
            jsonEscaped = false;
        }
        forwardText(fullText);
    };
    return { forwardText, flushBufferedFinalAnswer };
};
const reconstructContent = (blockMeta, blockTexts, blockInputs) => {
    const maxIdx = Object.keys(blockMeta).length > 0 ? Math.max(...Object.keys(blockMeta).map(Number)) : -1;
    const content = [];
    for (let idx = 0; idx <= maxIdx; idx++) {
        const meta = blockMeta[idx];
        if (!meta)
            continue;
        if (meta.type === 'text') {
            content.push({ type: 'text', text: blockTexts[idx] ?? '' });
        }
        else if (meta.type === 'tool_use') {
            let input = {};
            try {
                input = JSON.parse(blockInputs[idx] ?? '{}');
            }
            catch {
            }
            content.push({ type: 'tool_use', id: meta.id, name: meta.name, input });
        }
    }
    return content;
};
export const consumeBedrockStream = async (args) => {
    const { body, shouldStreamToClient, filterJsonResponse, onTextToken } = args;
    const { forwardText, flushBufferedFinalAnswer } = createTextForwarder(onTextToken, filterJsonResponse);
    let stopReason = '';
    const blockTexts = {};
    const blockInputs = {};
    const blockMeta = {};
    let iterationText = '';
    let streamTokens = false;
    let decided = false;
    let pendingText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    const decoder = new TextDecoder();
    for await (const event of body) {
        if (!event.chunk?.bytes)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(decoder.decode(event.chunk.bytes));
        }
        catch {
            continue;
        }
        if (parsed.type === 'message_start') {
            const message = parsed.message;
            const usage = message?.usage;
            if (usage) {
                inputTokens = readTokenCount(usage.input_tokens) ?? inputTokens;
                outputTokens = readTokenCount(usage.output_tokens) ?? outputTokens;
                cacheReadInputTokens =
                    readTokenCount(usage.cache_read_input_tokens) ?? cacheReadInputTokens;
                cacheCreationInputTokens =
                    readTokenCount(usage.cache_creation_input_tokens) ?? cacheCreationInputTokens;
            }
        }
        else if (parsed.type === 'content_block_start') {
            const idx = parsed.index;
            const cb = parsed.content_block;
            blockMeta[idx] = { type: cb.type, id: cb.id, name: cb.name };
            blockTexts[idx] = cb.text ?? '';
            blockInputs[idx] = '';
            if (idx === 0) {
                decided = true;
                if (cb.type === 'text' && shouldStreamToClient) {
                    streamTokens = true;
                    if (pendingText) {
                        forwardText(pendingText);
                        pendingText = '';
                    }
                }
                else {
                    streamTokens = false;
                    pendingText = '';
                }
            }
        }
        else if (parsed.type === 'content_block_delta') {
            const idx = parsed.index;
            const delta = parsed.delta;
            if (delta.type === 'text_delta' && delta.text) {
                blockTexts[idx] = (blockTexts[idx] ?? '') + delta.text;
                iterationText += delta.text;
                if (!decided)
                    pendingText += delta.text;
                else if (streamTokens)
                    forwardText(delta.text);
            }
            else if (delta.type === 'input_json_delta' && delta.partial_json) {
                blockInputs[idx] = (blockInputs[idx] ?? '') + delta.partial_json;
            }
        }
        else if (parsed.type === 'message_delta') {
            const delta = parsed.delta;
            if (delta.stop_reason)
                stopReason = delta.stop_reason;
            const usage = parsed.usage;
            if (usage) {
                const nextInput = readTokenCount(usage.input_tokens);
                const nextOutput = readTokenCount(usage.output_tokens);
                if (nextInput != null)
                    inputTokens = nextInput;
                if (nextOutput != null)
                    outputTokens = nextOutput;
                cacheReadInputTokens =
                    readTokenCount(usage.cache_read_input_tokens) ?? cacheReadInputTokens;
                cacheCreationInputTokens =
                    readTokenCount(usage.cache_creation_input_tokens) ?? cacheCreationInputTokens;
            }
        }
    }
    return {
        stopReason,
        content: reconstructContent(blockMeta, blockTexts, blockInputs),
        iterationText,
        usage: {
            inputTokens,
            outputTokens,
            cacheReadInputTokens,
            cacheCreationInputTokens,
        },
        flushBufferedFinalAnswer: (text) => flushBufferedFinalAnswer(text, streamTokens),
    };
};
const readTokenCount = (value) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        return Math.floor(value);
    return null;
};
const lastMessageHasPartitionHint = (messages) => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
        const message = messages[idx];
        if (message.role !== 'user')
            continue;
        const { content } = message;
        if (typeof content === 'string')
            return content.includes('partition_hint');
        if (!Array.isArray(content))
            return false;
        return content.some((block) => {
            const value = block.content;
            return typeof value === 'string' && value.includes('"partition_hint"');
        });
    }
    return false;
};
export const appendForceAnswerHint = (args) => {
    const { messages, iteration: i, forceAnswerAt, seriesIntent, seriesDecodedOnce, seriesForceAnswerAt, } = args;
    if (i === forceAnswerAt) {
        let content = 'Tools are disabled — final answer now from tool results only. Do not invent players, dates, metrics, or counts.';
        if (seriesIntent) {
            content = 'Tools disabled — final answer from series summary. Do not invent charts.';
        }
        else if (lastMessageHasPartitionHint(messages)) {
            content =
                'Tools are disabled. Full SQL rows were not returned (partition_hint). Say you need a narrower query — do not invent player names, injuries, dates, or counts.';
        }
        messages.push({
            role: 'user',
            content,
        });
    }
    else if (seriesIntent && !seriesDecodedOnce && i === seriesForceAnswerAt) {
        messages.push({
            role: 'user',
            content: 'No charts yet. ONE SQL + correct s.type; N derniers → LIMIT N.',
        });
    }
};
//# sourceMappingURL=agent_bedrock_stream.js.map