export const APP_LANGUAGES = {
    EN: 'en',
    FR: 'fr',
};
export function parseAppLanguage(value) {
    if (!value)
        return null;
    const normalized = value.toLowerCase();
    if (normalized === 'en' || normalized === 'fr')
        return normalized;
    return null;
}
export function getName(entity, fallback = '') {
    return entity?.name ?? fallback;
}
//# sourceMappingURL=localize.js.map