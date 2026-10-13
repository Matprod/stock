export const toCSVString = (data, columns, sep = '\n') => {
    if (!data.length) {
        return '';
    }
    const fields = columns
        ? Object.keys(data[0]).map((key) => columns[key])
        : Object.keys(data[0]).map((field) => `"${field}"`);
    const csv = [fields.join(',')];
    data.forEach((obj) => {
        const values = Object.values(obj).map((value) => {
            if (typeof value === 'string') {
                return `"${value}"`;
            }
            return value;
        });
        csv.push(values.join(','));
    });
    csv.push('');
    return csv.join(sep);
};
//# sourceMappingURL=csv_utils.js.map