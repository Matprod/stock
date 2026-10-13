import { ADOMIN_CONFIG } from './config/adomin_config.js';
export const flattenViews = (views) => {
    const flatViews = views.flatMap((view) => {
        if (view.type === 'folder')
            return flattenViews(view.views);
        return view;
    });
    return flatViews;
};
export const getFlatViews = () => {
    return flattenViews(ADOMIN_CONFIG.views);
};
//# sourceMappingURL=get_flat_views.js.map