import stringHelpers from '@adonisjs/core/helpers/string';
export const handleHasOneUpdate = async ({ Model, fieldConfig, oldHasOneInstance, value, instance, }) => {
    const { default: HasOneModel } = await import(`#models/${stringHelpers.snakeCase(fieldConfig.modelName)}`);
    const localKeyName = stringHelpers.camelCase(fieldConfig.localKeyName ?? 'id');
    const fkName = stringHelpers.camelCase(fieldConfig.fkName ?? `${Model.name}Id`);
    if (oldHasOneInstance) {
        oldHasOneInstance[fkName] = null;
        await oldHasOneInstance.save();
    }
    if (value) {
        const newHasOneInstance = await HasOneModel.findByOrFail(localKeyName, value);
        newHasOneInstance[fkName] = instance[Model.primaryKey];
        await newHasOneInstance.save();
    }
};
//# sourceMappingURL=handle_has_one_update.js.map