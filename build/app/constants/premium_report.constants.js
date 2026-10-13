export const PREMIUM_BLOCK_TYPE = {
    HEADING: 'heading',
    TEXT: 'text',
    CHART: 'chart',
    TABLE: 'table',
};
export const PREMIUM_BLOCK_TYPES = Object.values(PREMIUM_BLOCK_TYPE);
export const PREMIUM_REPORT_PROMPT_TITLE = 'premium-report-generator';
export const PREMIUM_REPORT_MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
export const PREMIUM_REPORT_INPUT_USD_PER_MTOK = 3;
export const PREMIUM_REPORT_OUTPUT_USD_PER_MTOK = 15;
export const PREMIUM_REPORT_CACHE_READ_USD_PER_MTOK = 0.3;
export const PREMIUM_REPORT_CACHE_WRITE_USD_PER_MTOK = 3.75;
export const PREMIUM_REPORT_MAX_ITERATIONS = 14;
export const PREMIUM_REPORT_FORCE_ANSWER_AT = 12;
export const PREMIUM_REPORT_SHIP_NUDGE_AT = 8;
export const PREMIUM_REPORT_MAX_TOKENS = 8192;
export const PREMIUM_REPORT_PROMPT_MAX = 8000;
export const PREMIUM_REPORT_HISTORY_MAX = 20;
export const PREMIUM_REPORT_MAX_BLOCKS = 48;
export const PREMIUM_REPORT_MAX_CHARTS = 16;
export const PREMIUM_REPORT_MAX_TEXT_LENGTH = 8000;
export const PREMIUM_REPORT_MAX_HEADING_LENGTH = 200;
export const PREMIUM_REPORT_MAX_TABLE_ROWS = 40;
export const PREMIUM_REPORT_MAX_TABLE_COLS = 14;
export const PREMIUM_REPORT_MAX_CHART_ROWS = 62;
export const PREMIUM_REPORT_MAX_BAR_ROWS = 20;
export const PREMIUM_REPORT_MAX_DATASET_ROWS = 12_000;
export const PREMIUM_REPORT_SAMPLE_ROWS = 8;
export const PREMIUM_REPORT_MIN_DAYS_WITH_DATA = 3;
export const PREMIUM_REPORT_MIN_ATHLETES_WITH_DATA = 2;
export const PREMIUM_REPORT_SQL_MAX_ROWS = 10_000;
export const PREMIUM_REPORT_SQL_MAX_BYTES = 4_000_000;
export const PREMIUM_REPORT_CHART_WIDTH = 1030;
export const PREMIUM_REPORT_CHART_HEIGHT = 480;
export const PREMIUM_CHART_PRESET = {
    DONUT: 'donut',
    BAR: 'bar',
    LINE: 'line',
    BAR_LINE: 'bar-line',
    HEATMAP: 'heatmap',
    RADAR: 'radar',
    SCATTER: 'scatter',
};
export const PREMIUM_CHART_PRESETS = Object.values(PREMIUM_CHART_PRESET);
export const isPremiumChartPreset = (value) => PREMIUM_CHART_PRESETS.includes(value);
export const PREMIUM_VALUE_TRANSFORM_OP = {
    ROUND: 'round',
    FLOOR: 'floor',
    CEIL: 'ceil',
    MULTIPLY: 'multiply',
    DIVIDE: 'divide',
    ADD: 'add',
    SUBTRACT: 'subtract',
};
export const PREMIUM_VALUE_TRANSFORM_OPS = Object.values(PREMIUM_VALUE_TRANSFORM_OP);
export const isValueTransformOp = (value) => PREMIUM_VALUE_TRANSFORM_OPS.includes(value);
export const isPremiumBlockType = (value) => PREMIUM_BLOCK_TYPES.includes(value);
export const PREMIUM_REPORT_ANTHROPIC_VERSION = 'bedrock-2023-05-31';
export const PREMIUM_REPORT_TEMPERATURE = 0.3;
export const PREMIUM_TOOL_HISTORY_CAP = 20;
export const PREMIUM_TOOL_HISTORY_TRIM = 15;
//# sourceMappingURL=premium_report.constants.js.map