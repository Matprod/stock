import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand, } from '@aws-sdk/client-bedrock-runtime';
import env from '#start/env';
export class Claude35SonnetService {
    client;
    modelId;
    MAX_TOKENS = 8000;
    constructor(modelId = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0') {
        this.modelId = modelId;
        const config = {
            region: 'eu-west-3',
            credentials: {
                accessKeyId: env.get('AWS_ACCESS_KEY'),
                secretAccessKey: env.get('AWS_SECRET_KEY'),
            },
        };
        this.client = new BedrockRuntimeClient(config);
    }
    async generateResponse({ systemPrompt, dataPrompt, prompt, history, responseFormat = 'json', maxTokens, }) {
        try {
            const body = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: maxTokens ?? this.MAX_TOKENS,
                system: [
                    {
                        type: 'text',
                        text: systemPrompt,
                        cache_control: { type: 'ephemeral' },
                    },
                ],
                temperature: 0.2,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: dataPrompt,
                                cache_control: { type: 'ephemeral' },
                            },
                        ],
                    },
                    ...history,
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt,
                            },
                        ],
                    },
                    ...(responseFormat === 'json'
                        ? [{ role: 'assistant', content: [{ type: 'text', text: '{' }] }]
                        : []),
                ],
            };
            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(body),
            });
            const response = await this.client.send(command);
            const json = JSON.parse(Buffer.from(response.body).toString('utf-8'));
            if (!json.content?.[0]?.text) {
                throw new Error('Empty response from Claude 4 Sonnet');
            }
            return responseFormat === 'json' ? '{' + json.content[0].text : json.content[0].text;
        }
        catch (error) {
            console.error('Error generating response from Claude 4 Sonnet:', error);
            throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateResponseStream({ systemPrompt, dataPrompt, prompt, history }, onToken) {
        const body = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: this.MAX_TOKENS,
            system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
            temperature: 0.2,
            messages: [
                {
                    role: 'user',
                    content: [{ type: 'text', text: dataPrompt, cache_control: { type: 'ephemeral' } }],
                },
                ...history,
                { role: 'user', content: [{ type: 'text', text: prompt }] },
                { role: 'assistant', content: [{ type: 'text', text: '{' }] },
            ],
        };
        const command = new InvokeModelWithResponseStreamCommand({
            modelId: this.modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(body),
        });
        const rawStream = await this.client.send(command);
        const decoder = new TextDecoder();
        let accumulated = '{';
        let extractedResponse = '';
        const collect = (token) => {
            extractedResponse += token;
            onToken(token);
        };
        const MARKER = '"response": "';
        let state = 'preamble';
        let escaped = false;
        for await (const event of rawStream.body) {
            if (!event.chunk?.bytes)
                continue;
            let parsed;
            try {
                parsed = JSON.parse(decoder.decode(event.chunk.bytes));
            }
            catch {
                continue;
            }
            if (parsed.type !== 'content_block_delta')
                continue;
            const delta = parsed.delta;
            if (delta.type !== 'text_delta' || !delta.text)
                continue;
            const chunk = delta.text;
            accumulated += chunk;
            if (state === 'preamble') {
                const markerIdx = accumulated.indexOf(MARKER);
                if (markerIdx === -1)
                    continue;
                state = 'in_value';
                const afterMarker = accumulated.slice(markerIdx + MARKER.length);
                ({ escaped, state } = forwardJsonStringChars(afterMarker, escaped, state, collect));
            }
            else if (state === 'in_value') {
                ;
                ({ escaped, state } = forwardJsonStringChars(chunk, escaped, state, collect));
            }
        }
        return { raw: accumulated, extractedResponse };
    }
    async generateTitle(systemPrompt, prompt) {
        try {
            const body = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 50,
                temperature: 0.7,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt,
                            },
                        ],
                    },
                ],
            };
            const command = new InvokeModelCommand({
                modelId: this.modelId,
                contentType: 'application/json',
                accept: 'application/json',
                body: JSON.stringify(body),
            });
            const response = await this.client.send(command);
            const json = JSON.parse(Buffer.from(response.body).toString('utf-8'));
            if (!json.content?.[0]?.text) {
                throw new Error('Empty response from Claude 4 Sonnet');
            }
            return json.content[0].text;
        }
        catch (error) {
            console.error('Error generating title from Claude 4 Sonnet:', error);
            throw new Error(`Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
export function forwardJsonStringChars(text, startEscaped, startState, onToken) {
    let buffer = '';
    let escaped = startEscaped;
    let state = startState;
    for (const ch of text) {
        if (state !== 'in_value')
            break;
        if (escaped) {
            if (ch === 'n')
                buffer += '\n';
            else if (ch === 't')
                buffer += '\t';
            else if (ch === 'r')
                buffer += '\r';
            else if (ch === '"')
                buffer += '"';
            else if (ch === '\\')
                buffer += '\\';
            else
                buffer += ch;
            escaped = false;
        }
        else if (ch === '\\') {
            escaped = true;
        }
        else if (ch === '"') {
            if (buffer)
                onToken(buffer);
            buffer = '';
            state = 'done';
        }
        else {
            buffer += ch;
        }
    }
    if (buffer)
        onToken(buffer);
    return { escaped, state };
}
//# sourceMappingURL=claude_3.5_sonnet_service.js.map