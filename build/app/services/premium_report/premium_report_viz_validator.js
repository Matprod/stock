const LINE_DATE_RE = /date|jour|day/i;
const DERIVED_METRIC_RE = /ewma_|monotony|strain|acwr/i;
const RAW_METRIC_RE = /performance_score|injury_risk|soreness|distance|rpe|duration|load|body_|gps|hr_|heart/i;
const TITLE_CONCEPTS = [
    { re: /risque|risk/i, need: /risk|risque|injury/i },
    { re: /courbature|soreness/i, need: /soreness|courbature|body_/i },
    {
        re: /monotony|strain|acwr|training load|\bsrpe\b|s-rpe/i,
        need: /monotony|strain|acwr|srpe|ewma|load|dsl|player_load|charge/i,
    },
    {
        re: /\bcmj\b|jump height|vald|force.?plate|\brsi\b/i,
        need: /jump|cmj|rsi|vald|power|rfd|landing|trial/i,
    },
];
const ok = () => ({ isValid: true });
const reject = (reason, suggestion) => ({
    isValid: false,
    reason,
    suggestion,
});
const titleMismatch = (title, columns) => {
    if (!title?.trim())
        return false;
    const blob = columns.join(' ');
    return TITLE_CONCEPTS.some(({ re, need }) => re.test(title) && !need.test(blob));
};
const onlyDerivedMetrics = (columns) => {
    const metrics = columns.filter((c) => !LINE_DATE_RE.test(c) && !/^id$|player|athlete|name/i.test(c));
    return (metrics.length > 0 &&
        metrics.every((c) => DERIVED_METRIC_RE.test(c)) &&
        !metrics.some((c) => RAW_METRIC_RE.test(c)));
};
export const validateVisualizationIdea = (args) => {
    if (args.chartType === 'scatter' || args.chartType === 'heatmap')
        return ok();
    if (args.chartType === 'line' && !args.datasetColumns.some((col) => LINE_DATE_RE.test(col))) {
        return reject('Line charts require a date/time column', 'Use bar for rankings or scatter for relationships');
    }
    if (titleMismatch(args.title, args.datasetColumns)) {
        return reject(`Title "${args.title}" mismatches columns: ${args.datasetColumns.join(', ')}`, 'Fix title or fetch matching data');
    }
    const barLike = args.chartType === 'bar' ||
        args.chartType === 'bar-line' ||
        args.chartType === 'donut' ||
        args.chartType === 'radar';
    if (args.toolName === 'add_chart' &&
        barLike &&
        args.uniqueCategories != null &&
        args.uniqueCategories < 2) {
        return reject(`Bar/ranking chart has ${args.uniqueCategories} category (need ≥2) — single bar is not useful`, 'Pass category=joueur (not date), keep ≥2 players, or use a table / line on daily series');
    }
    if (args.toolName === 'correlate' && args.mode === 'matrix' && args.datasetColumns.length > 6) {
        return reject(`Matrix with ${args.datasetColumns.length} vars (max 6)`, 'Select 3-5 metrics or use mode=pair');
    }
    if (args.toolName === 'correlate' && onlyDerivedMetrics(args.datasetColumns)) {
        return reject('Derived-only correlations (ewma/strain/monotony/acwr) are not actionable', 'Correlate raw metrics instead');
    }
    return ok();
};
export const runVizGate = (state, args) => {
    state.jevValidations++;
    const validation = validateVisualizationIdea(args);
    if (validation.isValid)
        return null;
    state.jevBlocked++;
    return JSON.stringify({
        error: validation.reason,
        suggestion: validation.suggestion,
        jevBlocked: true,
    });
};
export const precedingHeadingMismatch = (blocks, columns, after) => {
    const heading = findPrecedingHeadingText(blocks, after);
    if (!heading || !titleMismatch(heading, columns))
        return null;
    return JSON.stringify({
        error: `Section heading "${heading}" mismatches columns: ${columns.join(', ')}`,
        suggestion: 'add_heading for this domain first (e.g. VALD/CMJ vs Load/Monotony), or insert after the matching section',
        jevBlocked: true,
    });
};
const findPrecedingHeadingText = (blocks, after) => {
    if (blocks.length === 0)
        return undefined;
    let index = blocks.length - 1;
    if (after && after !== 'end' && after !== 'start') {
        const found = blocks.findIndex((block) => 'id' in block && block.id === after);
        if (found >= 0)
            index = found;
    }
    if (after === 'start')
        return undefined;
    for (let i = index; i >= 0; i--) {
        const block = blocks[i];
        if (block?.type === 'heading' && block.text?.trim())
            return block.text.trim();
    }
    return undefined;
};
export const chartDisplayRowCap = (chartType, columns) => {
    const hasDate = columns.some((col) => LINE_DATE_RE.test(col));
    if (chartType === 'bar' || chartType === 'radar' || chartType === 'donut')
        return 20;
    if (chartType === 'line' || chartType === 'bar-line' || (chartType === 'auto' && hasDate) || hasDate) {
        return 62;
    }
    if (chartType === 'scatter')
        return 80;
    return 25;
};
//# sourceMappingURL=premium_report_viz_validator.js.map