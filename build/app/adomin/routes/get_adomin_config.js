import { ADOMIN_CONFIG } from '../config/adomin_config.js';
import { computeRightsCheck } from './adomin_routes_overrides_and_rights.js';
const getModelViewConfig = async (ctx, conf) => {
    const { label, labelPluralized, name, isHidden = false, visibilityCheck, icon } = conf;
    const visibilityCheckResult = await computeRightsCheck(ctx, visibilityCheck, false);
    const counter = conf.counter
        ? { label: conf.counter.label, value: await conf.counter.dataFetcher(ctx) }
        : undefined;
    return {
        type: 'model',
        label,
        labelPluralized,
        name,
        isHidden,
        visibilityCheckPassed: visibilityCheckResult === 'OK',
        icon,
        counter,
    };
};
const getStatViewConfig = async (ctx, conf) => {
    const { name, label, visibilityCheck, isHidden = false, icon } = conf;
    const visibilityCheckResult = await computeRightsCheck(ctx, visibilityCheck, false);
    return {
        type: 'stats',
        label,
        name,
        isHidden,
        visibilityCheckPassed: visibilityCheckResult === 'OK',
        icon,
    };
};
const getCustomViewConfig = async (ctx, conf) => {
    const { name, label, visibilityCheck, isHidden = false, icon, href } = conf;
    const visibilityCheckResult = await computeRightsCheck(ctx, visibilityCheck, false);
    return {
        type: 'custom',
        href,
        label,
        name,
        isHidden,
        visibilityCheckPassed: visibilityCheckResult === 'OK',
        icon,
    };
};
const getFolderViewConfig = async (ctx, conf) => {
    const { name, label, visibilityCheck, views, isHidden = false, icon } = conf;
    const visibilityCheckResult = await computeRightsCheck(ctx, visibilityCheck, false);
    const finalViews = await getViewsConfig(ctx, views);
    return {
        type: 'folder',
        label,
        visibilityCheckPassed: visibilityCheckResult === 'OK',
        views: finalViews,
        isHidden,
        name,
        icon,
    };
};
const getViewsConfig = async (ctx, views) => {
    const viewsPromises = views.map(async (conf) => {
        if (conf.type === 'stats') {
            return getStatViewConfig(ctx, conf);
        }
        if (conf.type === 'folder') {
            return getFolderViewConfig(ctx, conf);
        }
        if (conf.type === 'custom') {
            return getCustomViewConfig(ctx, conf);
        }
        return getModelViewConfig(ctx, conf);
    });
    const viewsToFilter = await Promise.all(viewsPromises);
    const filteredViews = viewsToFilter.filter(({ visibilityCheckPassed }) => visibilityCheckPassed);
    return filteredViews;
};
export const getAdominConfig = async (ctx) => {
    const { auth } = ctx;
    const user = auth.user;
    const views = await getViewsConfig(ctx, ADOMIN_CONFIG.views);
    const footerText = ADOMIN_CONFIG.footerText ?? '';
    return {
        title: ADOMIN_CONFIG.title,
        footerText,
        logo: ADOMIN_CONFIG.logo ?? null,
        views,
        userDisplayKey: ADOMIN_CONFIG.userDisplayKey ?? 'email',
        user,
        plugins: ADOMIN_CONFIG.plugins ?? [],
    };
};
//# sourceMappingURL=get_adomin_config.js.map