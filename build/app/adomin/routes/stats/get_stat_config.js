import { getFlatViews } from '#adomin/get_flat_views';
import { computeRightsCheck } from '../adomin_routes_overrides_and_rights.js';
export const isStatConfig = (config) => {
    return config.type === 'stats';
};
export const getStatConfig = (viewName) => {
    const foundConfig = getFlatViews()
        .filter(isStatConfig)
        .find(({ name }) => name === viewName);
    if (!foundConfig)
        throw new Error(`No ADOMIN config found for view ${viewName}`);
    return foundConfig;
};
const getFrontendStatConfig = async (config) => {
    const promises = config.stats.map(async ({ label, name, type, options, filters }) => {
        return {
            type,
            name,
            label,
            options,
            filters,
        };
    });
    return Promise.all(promises);
};
export const getStatConfigRoute = async (ctx) => {
    const { params, response } = ctx;
    const viewString = params.view;
    const statConfig = getFlatViews()
        .filter(isStatConfig)
        .find(({ name }) => name === viewString);
    if (!statConfig) {
        return response.notFound({ error: `View '${viewString}' not found` });
    }
    const { label, name, isHidden, visibilityCheck, type, gridTemplateAreas, icon, globalFilters } = statConfig;
    const visibilityCheckResult = await computeRightsCheck(ctx, visibilityCheck);
    if (visibilityCheckResult === 'STOP')
        return;
    const frontendStatConfig = await getFrontendStatConfig(statConfig);
    return {
        name,
        label,
        isHidden: isHidden ?? false,
        stats: frontendStatConfig,
        globalFilters,
        type,
        gridTemplateAreas,
        icon,
    };
};
//# sourceMappingURL=get_stat_config.js.map