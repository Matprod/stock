export const createStatsViewConfig = (options) => {
    const { name, stats, label, visibilityCheck, isHidden, icon, gridTemplateAreas, globalFilters } = options;
    return {
        type: 'stats',
        name,
        stats: stats,
        label,
        visibilityCheck,
        isHidden,
        icon,
        gridTemplateAreas,
        globalFilters,
    };
};
//# sourceMappingURL=create_stats_view_config.js.map