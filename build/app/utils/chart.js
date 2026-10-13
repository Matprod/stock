export const toFrontendCharts = (charts) => charts.map((spec) => ({
    type: spec.kind,
    title: spec.title,
    labels: spec.labels,
    datasets: spec.datasets.map((d) => ({
        label: d.label,
        data: d.data,
        color: d.borderColor ?? d.backgroundColor,
        yAxisID: d.yAxisID,
        ...(d.borderDash?.length ? { borderDash: d.borderDash } : {}),
    })),
    yAxes: spec.yAxes,
    serieType: spec.serieType,
    sessionDate: spec.sessionDate,
}));
export const chartsFromStored = (raw) => {
    if (!raw)
        return [];
    const items = Array.isArray(raw) ? raw : [raw];
    return items.flatMap((item) => ('kind' in item ? toFrontendCharts([item]) : [item]));
};
//# sourceMappingURL=chart.js.map