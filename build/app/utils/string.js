export function arrayToString(array) {
    return `[${array
        .map((item) => {
        if (typeof item === 'string') {
            return `"${item}"`;
        }
        return item;
    })
        .join(', ')}]`;
}
export function capitalize(str) {
    return str
        .toLowerCase()
        .split(/[_\s-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
//# sourceMappingURL=string.js.map