export const computeVirtualColumns = async (model, fields) => {
    const virtualFields = fields.filter(({ isVirtual }) => isVirtual);
    const promises = virtualFields.map(async ({ name, adomin }) => {
        const getter = adomin.getter;
        if (!getter)
            throw new Error(`No getter found for virtual column ${name}`);
        const value = await getter(model);
        return { name, value };
    });
    const modelJsonData = model.toJSON();
    const virtualColumnsData = await Promise.all(promises);
    virtualColumnsData.forEach(({ name, value }) => {
        modelJsonData[name] = value;
    });
    return modelJsonData;
};
export const computeVirtualFields = async (paginatedData, fields) => {
    const promises = paginatedData.map(async (model) => computeVirtualColumns(model, fields));
    const dataWithComputedVirtualColumns = await Promise.all(promises);
    const { meta } = paginatedData.toJSON();
    return {
        data: dataWithComputedVirtualColumns,
        meta,
    };
};
export const computeVirtualFieldsWithoutPagination = async (paginatedData, fields) => {
    const promises = paginatedData.map(async (model) => computeVirtualColumns(model, fields));
    const dataWithComputedVirtualColumns = await Promise.all(promises);
    return dataWithComputedVirtualColumns;
};
//# sourceMappingURL=compute_virtual_columns.js.map