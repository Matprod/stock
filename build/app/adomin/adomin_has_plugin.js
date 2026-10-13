import { ADOMIN_CONFIG } from './config/adomin_config.js';
export const adominHasPlugin = (plugin) => {
    return (ADOMIN_CONFIG.plugins ?? []).includes(plugin);
};
//# sourceMappingURL=adomin_has_plugin.js.map