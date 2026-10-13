import { schema } from '@adonisjs/validator';
import { getValidationSchemaFromFieldConfig } from './get_validation_schema_from_lucid_model.js';
export const getFiltersValidationSchemaFromStatConfig = (config) => {
    const schemaObj = {};
    if (!config.filters)
        return null;
    for (const [key, fieldConfig] of Object.entries(config.filters)) {
        schemaObj[key] = getValidationSchemaFromFieldConfig(fieldConfig, 'stat-filter');
    }
    return schema.create(schemaObj);
};
export const getGlobalFiltersValidationSchemaFromStatViewConfig = (config) => {
    const schemaObj = {};
    if (!config.globalFilters)
        return null;
    for (const [key, fieldConfig] of Object.entries(config.globalFilters)) {
        schemaObj[key] = getValidationSchemaFromFieldConfig(fieldConfig, 'stat-filter');
    }
    return schema.create(schemaObj);
};
//# sourceMappingURL=get_validation_schema_from_stat_config.js.map