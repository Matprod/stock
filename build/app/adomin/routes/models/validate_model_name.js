import { getFlatViews } from '#adomin/get_flat_views';
import vine from '@vinejs/vine';
import { getModelConfig } from './get_model_config.js';
const isNotNull = (value) => value !== null;
const modelsEnum = getFlatViews()
    .map((conf) => {
    if (conf.type !== 'model')
        return null;
    return conf.model().name;
})
    .filter(isNotNull);
const modelNameSchema = vine.compile(vine.object({ model: vine.enum(modelsEnum) }));
export const validateModelName = (data) => {
    return modelNameSchema.validate(data);
};
export const getValidatedModelConfig = async (params) => {
    const { model } = await validateModelName(params);
    return getModelConfig(model);
};
//# sourceMappingURL=validate_model_name.js.map