import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import env from '#start/env';
const MODEL_ID = 'amazon.titan-embed-text-v2:0';
const CLAUDE_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
const HAIKU_MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
let client = null;
function getClient() {
    if (!client) {
        client = new BedrockRuntimeClient({
            region: env.get('AWS_REGION'),
            credentials: {
                accessKeyId: env.get('AWS_ACCESS_KEY'),
                secretAccessKey: env.get('AWS_SECRET_KEY'),
            },
        });
    }
    return client;
}
async function invokeModel(modelId, body) {
    const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(body),
    });
    const raw = await getClient().send(command);
    return JSON.parse(Buffer.from(raw.body).toString('utf-8'));
}
export async function invokeClaude(content, maxTokens, temperature = 0) {
    const response = await invokeModel(CLAUDE_MODEL_ID, {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content }],
    });
    return response.content[0].text.trim();
}
export async function getEmbedding(text) {
    const body = await invokeModel(MODEL_ID, {
        inputText: text,
        dimensions: 512,
        normalize: true,
    });
    return body.embedding;
}
const DEEP_ANALYSIS_PREFIX = 'make a deep analysis';
export function needsVariants(question) {
    return !question.toLowerCase().startsWith(DEEP_ANALYSIS_PREFIX);
}
function extractJsonArray(text) {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1)
        return [];
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return [];
    }
}
export async function generateVariants(question) {
    const text = await invokeClaude(`Generate 10 different ways a user might ask the following question in a sports analytics chatbot. Vary the phrasing, vocabulary and structure. Return ONLY a valid JSON array of strings, no explanation.

Question: "${question}"

JSON array:`, 400, 0.7);
    return extractJsonArray(text);
}
const TIME_HORIZONS = [
    { key: 'day', label: 'today' },
    { key: 'week', label: 'the last 7 days' },
    { key: '14days', label: 'the last 14 days' },
    { key: 'month', label: 'the last month' },
    { key: '6months', label: 'the last 6 months' },
    { key: 'year', label: 'the last year' },
    { key: '2years', label: 'the last 2 years' },
];
export async function generateTimeVariants(question) {
    const text = await invokeClaude(`You are helping build a sports analytics demo. Given a chatbot question, generate versions of it for different time horizons.

Question: "${question}"

Time horizons to generate: ${TIME_HORIZONS.map((h) => h.label).join(', ')}.

Rules:
- If the question already contains a time reference (e.g. "last 3 trainings", "last 2 years"), replace it with each horizon.
- If no time reference is present but one makes sense (e.g. training history, injury history, performance trends), add one naturally.
- If the question is timeless (e.g. "What type of injury can happen?", "Give a diagnostic"), return an empty array — time horizons do not apply.
- Keep the original phrasing and athlete name. Only change the time part.
- Return ONLY a valid JSON array. Each element: { "horizon": "<key>", "question": "<full question>" }.
- Keys: day, week, 14days, month, 6months, year, 2years.

JSON array:`, 800, 0.3);
    const parsed = extractJsonArray(text);
    return parsed.map((v) => ({
        ...v,
        label: TIME_HORIZONS.find((h) => h.key === v.horizon)?.label ?? v.horizon,
    }));
}
export async function selectWithHaiku(query, candidates) {
    const list = candidates.map((c, i) => `${i + 1}. "${c.question}"`).join('\n');
    const response = await invokeModel(HAIKU_MODEL_ID, {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 8,
        temperature: 0,
        messages: [
            {
                role: 'user',
                content: `You are matching a user question to a stored question in a sports analytics demo.

User question: "${query}"

Stored questions:
${list}

Rules:
- The topic AND the time horizon must both match exactly.
- If the user question contains a time reference (e.g. "last 7 days", "last month", "last year", "today"), only match a stored question with the SAME time reference. A different time window is NOT a match even if the topic is identical.
- If the user question has no time reference, match the stored question that best covers the same topic regardless of its time window.
- Reply with ONLY the number (1 to ${candidates.length}), or 0 if no stored question is a good match.`,
            },
        ],
    });
    const num = parseInt(response.content[0].text.trim(), 10);
    if (isNaN(num) || num < 1 || num > candidates.length)
        return null;
    return num - 1;
}
export function cosineSimilarity(a, b) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0)
        return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
//# sourceMappingURL=embedding_service.js.map