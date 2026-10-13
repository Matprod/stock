export const toCamel = (apiKey, prop) => {
    const base = apiKey
        .split('_')
        .map((s, i) => (i ? s[0].toUpperCase() : s[0].toLowerCase()) + s.slice(1))
        .join('');
    return base + (prop ? prop[0].toUpperCase() + prop.slice(1) : '');
};
//# sourceMappingURL=basketball.js.map