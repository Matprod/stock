import { toCSVString } from '../../../utils/csv_utils.js';
export const EXPORT_TYPES = ['csv', 'xlsx', 'json'];
export const downloadExportFile = async ({ ctx, jsonData, exportType, modelConfig, }) => {
    const { response } = ctx;
    const json = jsonData;
    const modelConfigMap = getModelConfigMap(modelConfig);
    const transformedJson = json.map((row) => transformData(row, modelConfigMap));
    if (exportType === 'json') {
        response.header('Content-Type', 'application/octet-stream');
        return transformedJson;
    }
    if (exportType === 'csv') {
        const csv = toCSVString(transformedJson);
        response.header('Content-Type', 'application/octet-stream');
        return response.send(csv);
    }
    if (exportType === 'xlsx') {
        const xlsx = await import('xlsx');
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(transformedJson);
        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        response.header('Content-Type', 'application/octet-stream');
        return response.send(buffer);
    }
    return response.notImplemented({
        error: `L'export de type '${exportType}' n'est pas encore implémenté`,
    });
};
function getModelConfigMap(modelConfig) {
    const map = new Map();
    for (const column of modelConfig.fields) {
        map.set(column.name, column);
    }
    return map;
}
function transformData(row, modelConfigMap) {
    const newRow = { ...row };
    for (const [key, value] of Object.entries(row)) {
        const columnConfig = modelConfigMap.get(key);
        if (!columnConfig || !columnConfig.adomin.exportDataTransform) {
            newRow[key] = value;
            continue;
        }
        const transformedValue = columnConfig.adomin.exportDataTransform(value);
        newRow[key] = transformedValue;
    }
    return newRow;
}
//# sourceMappingURL=download_export_file.js.map