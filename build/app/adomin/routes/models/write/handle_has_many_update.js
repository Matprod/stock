import stringHelpers from '@adonisjs/core/helpers/string';
export const handleHasManyUpdate = async ({ Model, fieldConfig, oldHasManyInstances, instance, value, }) => {
    const { default: HasManyModel } = await import(`#models/${stringHelpers.snakeCase(fieldConfig.modelName)}`);
    const localKeyName = stringHelpers.camelCase(fieldConfig.localKeyName ?? 'id');
    const fkName = stringHelpers.camelCase(fieldConfig.fkName ?? `${Model.name}Id`);
    const instancePrimaryKeyValue = instance[Model.primaryKey];
    const relatedInstancesPrimaryKeysValues = oldHasManyInstances.map((relatedInstance) => relatedInstance[localKeyName]);
    if (fieldConfig.allowRemove !== false) {
        await HasManyModel.query()
            .whereIn(localKeyName, relatedInstancesPrimaryKeysValues)
            .update({ [fkName]: null });
    }
    await HasManyModel.query()
        .whereIn(localKeyName, value)
        .update({ [fkName]: instancePrimaryKeyValue });
};
//# sourceMappingURL=handle_has_many_update.js.map