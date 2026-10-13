export const createFolderViewConfig = (options) => {
    const { name, label, visibilityCheck, views, isHidden, icon } = options;
    return {
        type: 'folder',
        name,
        label,
        visibilityCheck,
        views,
        isHidden,
        icon,
    };
};
//# sourceMappingURL=create_folder_view_config.js.map