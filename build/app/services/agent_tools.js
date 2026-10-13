import { randomUUID } from 'node:crypto';
import { getResponseStructure, RESPONSE_STRUCTURE_INTENTS, } from '#services/response_structure_loader';
import { INTENT_DESCRIPTIONS, TOOL_STATUS_LABELS } from '#constants/agent.constants';
export const createChartTool = (onChart) => ({
    schema: {
        name: 'suggest_chart',
        description: 'REQUIRED when the user asks for a graph/chart/graphique (including biomarker trends like CK). Call AFTER query_database once you have a compact time series or ranking. Prefer one dataset of daily averages for team biomarkers (not one series per player). Do not claim technical failure without calling this tool. Do not call for a single scalar value.',
        input_schema: {
            type: 'object',
            properties: {
                kind: {
                    type: 'string',
                    enum: ['line', 'bar', 'radar', 'doughnut'],
                    description: 'line: time series (biomarker/CK trends, load over days) | bar: comparisons | radar: multi-metric profile | doughnut: distribution',
                },
                title: { type: 'string', description: 'Chart title' },
                labels: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'X-axis labels (dates, categories...). Keep ≤60 points when possible.',
                },
                datasets: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' },
                            data: {
                                type: 'array',
                                items: { type: ['number', 'null'] },
                                description: 'Numeric values; use null for missing points. Same length as labels.',
                            },
                            borderColor: {
                                type: 'string',
                                description: 'Line/border hex color (e.g. "#3b82f6")',
                            },
                            backgroundColor: {
                                type: 'string',
                                description: 'Bar/point hex color (e.g. "#3b82f6"). Do not use a transparent fill under line charts.',
                            },
                            yAxisID: {
                                type: 'string',
                                description: 'Which Y axis this dataset uses ("y" or "y1"). Required when datasets have different scales.',
                            },
                        },
                        required: ['label', 'data'],
                    },
                },
                yAxes: {
                    type: 'array',
                    description: 'Always provide this. Set min/max based on actual data range. Use two entries when datasets have different units.',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: '"y" for left axis, "y1" for right axis' },
                            label: { type: 'string', description: 'e.g. "CK (U/L)", "Score (0-100)"' },
                            min: { type: 'number' },
                            max: { type: 'number' },
                            position: { type: 'string', enum: ['left', 'right'] },
                        },
                        required: ['id'],
                    },
                },
            },
            required: ['kind', 'title', 'labels', 'datasets', 'yAxes'],
        },
    },
    execute: async (input) => {
        const raw = input;
        if (!raw.labels?.length || !raw.datasets?.length) {
            return JSON.stringify({ error: 'Chart requires at least one label and one dataset' });
        }
        const datasets = raw.datasets.map((d) => {
            const data = (d.data ?? []).map((v) => {
                if (v === null || v === undefined)
                    return null;
                const n = typeof v === 'number' ? v : Number(v);
                return Number.isFinite(n) ? n : null;
            });
            return { ...d, data, fill: false };
        });
        if (datasets.every((d) => d.data.every((v) => v === null))) {
            return JSON.stringify({
                error: 'Chart data is empty — pass numeric daily averages in datasets[].data',
            });
        }
        const spec = {
            id: randomUUID(),
            kind: raw.kind,
            title: raw.title,
            labels: raw.labels.map(String),
            datasets,
            yAxes: raw.yAxes,
        };
        onChart(spec);
        return JSON.stringify({ status: 'chart_ready', id: spec.id });
    },
});
export const createResponseStructureTool = () => ({
    schema: {
        name: 'get_response_structure',
        description: `Returns the full structure module for your chosen intent (sections, charts, rules). Call after initial data; follow it exactly—including any suggest_chart steps inside the module. ${INTENT_DESCRIPTIONS}`,
        input_schema: {
            type: 'object',
            properties: {
                intent: {
                    type: 'string',
                    enum: [...RESPONSE_STRUCTURE_INTENTS],
                    description: 'The response intent you selected for this answer.',
                },
            },
            required: ['intent'],
        },
    },
    execute: async (input) => {
        const intent = String(input.intent ?? '').trim();
        const body = getResponseStructure(intent);
        if (body === null) {
            return JSON.stringify({
                error: 'unknown_intent',
                valid_intents: RESPONSE_STRUCTURE_INTENTS,
            });
        }
        return body;
    },
});
export const buildStatusMessage = (toolNames) => {
    if (toolNames.length === 0)
        return 'Processing';
    if (toolNames.length === 1)
        return TOOL_STATUS_LABELS[toolNames[0]] ?? 'Processing';
    return `Running ${toolNames.length} analyses`;
};
//# sourceMappingURL=agent_tools.js.map