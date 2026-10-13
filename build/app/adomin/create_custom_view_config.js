export const createCustomViewConfig = (options) => {
    const { href, label, visibilityCheck, isHidden, icon, name } = options;
    return {
        type: 'custom',
        href,
        name,
        label,
        visibilityCheck,
        isHidden,
        icon,
    };
};
//# sourceMappingURL=create_custom_view_config.js.map