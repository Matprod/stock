import { PASSWORD_SERIALIZED_FORM } from '../../../create_model_view_config.js';
import { getSqlColumnToUse } from '../get_model_config.js';
import { handleFilePersist } from './handle_file_persist.js';
import { handleHasManyUpdate } from './handle_has_many_update.js';
import { handleHasOneUpdate } from './handle_has_one_update.js';
import { handleManyToManyUpdate } from './handle_many_to_many_update.js';
const allowArrayClear = (fields, data) => {
    for (const field of fields) {
        const isArray = field.adomin.type === 'array' ||
            field.adomin.type === 'hasManyRelation' ||
            field.adomin.type === 'manyToManyRelation';
        if (!isArray)
            continue;
        const fieldName = field.name;
        data[fieldName] = data[fieldName] ?? [];
    }
};
export const attachFieldsToModel = async (instance, fields, data) => {
    allowArrayClear(fields, data);
    const foreignFields = [];
    const fieldsMap = new Map(fields.map((field) => [field.name, field]));
    for (const [key, value] of Object.entries(data)) {
        const oldValue = instance[key];
        const field = fieldsMap.get(key);
        if (!field || value === undefined)
            continue;
        if (field.isVirtual)
            continue;
        if (field.adomin.type === 'string' && field.adomin.isPassword) {
            if (data[field.name] === PASSWORD_SERIALIZED_FORM) {
                continue;
            }
        }
        if (field.adomin.type === 'file') {
            await handleFilePersist(field.adomin, instance, field.name, data);
            continue;
        }
        if (field.adomin.type === 'belongsToRelation') {
            const modelColumn = getSqlColumnToUse(field);
            instance[modelColumn] = value;
            continue;
        }
        if (field.adomin.type === 'hasOneRelation' ||
            field.adomin.type === 'manyToManyRelation' ||
            field.adomin.type === 'hasManyRelation') {
            foreignFields.push(field);
            continue;
        }
        instance[key] = value;
    }
    return foreignFields;
};
export const attachForeignFields = async (instance, foreignFields, data, Model, mode) => {
    const foreignFieldsMap = new Map(foreignFields.map((field) => [field.name, field]));
    for (const [key, value] of Object.entries(data)) {
        const oldValue = instance[key];
        const field = foreignFieldsMap.get(key);
        if (!field || value === undefined)
            continue;
        if (mode === 'create' && field.adomin.creatable === false)
            continue;
        if (mode === 'update' && field.adomin.editable === false)
            continue;
        if (field.adomin.type === 'hasOneRelation') {
            await handleHasOneUpdate({
                fieldConfig: field.adomin,
                Model,
                oldHasOneInstance: oldValue,
                value,
                instance,
            });
            continue;
        }
        if (field.adomin.type === 'hasManyRelation') {
            await handleHasManyUpdate({
                fieldConfig: field.adomin,
                Model,
                oldHasManyInstances: oldValue,
                value: value && Array.isArray(value) ? value : [],
                instance,
            });
            continue;
        }
        if (field.adomin.type === 'manyToManyRelation') {
            await handleManyToManyUpdate({
                fieldConfig: field.adomin,
                Model,
                oldManyToManyInstances: oldValue,
                value: value && Array.isArray(value) ? value : [],
                instance,
            });
            continue;
        }
    }
};
export const updateVirtualColumns = async (instance, fields, data) => {
    const virtualFieldsWithSetter = fields.filter(({ isVirtual, adomin }) => isVirtual && adomin.setter);
    const promises = virtualFieldsWithSetter.map(async ({ name, adomin }) => {
        const setter = adomin.setter;
        if (!setter)
            throw new Error(`No setter found for virtual column ${name}`);
        const value = data[name];
        await setter(instance, value);
    });
    await Promise.all(promises);
};
//# sourceMappingURL=attach_fields_to_model.js.map