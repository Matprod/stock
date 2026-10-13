import string from '@adonisjs/core/helpers/string';
export const PASSWORD_SERIALIZED_FORM = '***';
const serializePasswords = (Model, columnsObj) => {
    const passwords = Object.entries(columnsObj)
        .filter(([, conf]) => conf.type === 'string' && conf.isPassword)
        .map(([columnName]) => columnName);
    const passwordSet = new Set(passwords);
    const columns = Array.from(Model.$columnsDefinitions.entries()).filter(([columnName]) => passwordSet.has(columnName));
    columns.forEach(([, column]) => {
        column.serializeAs = column.columnName;
        column.serialize = () => PASSWORD_SERIALIZED_FORM;
    });
};
const PRIMARY_KEY_DEFAULT_CONFIG = {
    type: 'number',
    editable: false,
    creatable: false,
};
export const createModelViewConfig = (Model, options) => {
    const cols = options.columns;
    serializePasswords(Model(), cols);
    const modelString = Model().name;
    const label = options.label ?? modelString;
    const labelPluralized = options.labelPluralized ?? string.pluralize(label);
    const primaryKey = Model().primaryKey;
    const columnsConfig = Object.entries(cols).map(([name, adomin]) => ({ name, adomin }));
    const primaryKeyConfig = columnsConfig.find(({ name }) => name === primaryKey);
    if (!primaryKeyConfig) {
        columnsConfig.unshift({
            name: primaryKey,
            adomin: PRIMARY_KEY_DEFAULT_CONFIG,
        });
    }
    const finalColumnsConfig = columnsConfig.map(({ name, adomin }) => ({
        name,
        adomin,
        isVirtual: false,
    }));
    for (const { columnOrderIndex, name, adomin, getter, setter } of options.virtualColumns ?? []) {
        const virtualColumnAdominConfig = {
            ...adomin,
            getter,
            setter,
        };
        finalColumnsConfig.splice(columnOrderIndex ?? finalColumnsConfig.length, 0, {
            name,
            adomin: virtualColumnAdominConfig,
            isVirtual: true,
        });
    }
    return {
        type: 'model',
        name: modelString,
        model: Model,
        fields: finalColumnsConfig,
        label,
        labelPluralized,
        primaryKey,
        isHidden: options.isHidden,
        staticRights: options.staticRights,
        routesOverrides: options.routesOverrides,
        validation: options.validation,
        crudlRights: options.crudlRights,
        visibilityCheck: options.visibilityCheck,
        queryBuilderCallback: options.queryBuilderCallback,
        icon: options.icon,
        globalActions: options.globalActions ?? [],
        instanceActions: options.instanceActions ?? [],
        counter: options.counter,
        afterValidatePayloadTransformCallback: options.afterValidatePayloadTransformCallback,
        afterCreateCallback: options.afterCreateCallback,
    };
};
//# sourceMappingURL=create_model_view_config.js.map