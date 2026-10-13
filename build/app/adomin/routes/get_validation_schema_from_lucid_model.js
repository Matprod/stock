import { rules, schema } from '@adonisjs/validator';
import { computeColumnConfigFields } from './models/get_model_config.js';
export const getValidationSchemaFromConfig = async (modelConfig, validationMode) => {
    const foundConfig = modelConfig;
    const fields = await computeColumnConfigFields(foundConfig.fields);
    const results = fields.map(({ adomin, name: columnName }) => {
        const notCreatable = adomin.creatable === false;
        const notEditable = adomin.editable === false;
        if (validationMode === 'create' && notCreatable)
            return null;
        if (validationMode === 'update' && notEditable)
            return null;
        return {
            columnName,
            schema: getValidationSchemaFromFieldConfig(adomin, validationMode),
        };
    });
    const schemaObj = {};
    for (const result of results) {
        if (!result)
            continue;
        schemaObj[result.columnName] = result.schema;
    }
    return schema.create(schemaObj);
};
const getSuffix = (config) => {
    if (config.nullable)
        return 'nullable';
    if (config.optional)
        return 'optional';
    return null;
};
const getFileSchema = (validationMode, suffix) => {
    if (validationMode === 'update')
        return schema.file.nullableAndOptional;
    if (!suffix)
        return schema.file;
    return schema.file[suffix];
};
export const getValidationSchemaFromFieldConfig = (config, validationMode) => {
    const suffix = getSuffix(config);
    if (config.type === 'enum') {
        const options = config.options.map((option) => option.value);
        if (suffix)
            return schema.enum[suffix](options);
        return schema.enum(options);
    }
    if (config.type === 'array') {
        return schema.array.optional().members(schema.string());
    }
    if (config.type === 'string' && config.isEmail) {
        if (suffix)
            return schema.string[suffix]([rules.email()]);
        return schema.string([rules.email()]);
    }
    if (config.type === 'hasManyRelation') {
        return schema.array.optional().members(schema[config.localKeyType ?? 'string']());
    }
    if (config.type === 'manyToManyRelation') {
        return schema.array.optional().members(schema[config.relatedKeyType ?? 'string']());
    }
    if (config.type === 'json') {
        if (suffix)
            return schema.string[suffix]();
        return schema.string();
    }
    if (config.type === 'file') {
        const specialSchema = getFileSchema(validationMode, suffix);
        return specialSchema({
            size: config.maxFileSize,
            extnames: config.extnames,
        });
    }
    const fieldSchema = getBaseSchema(config);
    return fieldSchema([]);
};
const getType = (config) => {
    switch (config.type) {
        case 'foreignKey':
        case 'belongsToRelation':
        case 'hasOneRelation':
            return config.fkType ?? 'string';
        case 'hasManyRelation':
        case 'manyToManyRelation':
        case 'json':
            throw new Error(`${config.type} should be handled before calling this function`);
        default:
            return config.type;
    }
};
const getBaseSchema = (config) => {
    const suffix = getSuffix(config);
    const type = getType(config);
    if (suffix)
        return schema[type][suffix];
    return schema[type];
};
//# sourceMappingURL=get_validation_schema_from_lucid_model.js.map