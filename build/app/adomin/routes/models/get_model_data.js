import { getModelConfig, getModelFieldStrs } from './get_model_config.js';
import { loadRelations } from './read/model_query_helpers.js';
export const getModelData = async (Model, primaryKeyValue, ctx) => {
    const { fields, primaryKey, queryBuilderCallback } = getModelConfig(Model.name);
    const fieldsStrs = getModelFieldStrs(fields);
    const query = Model.query()
        .select(...fieldsStrs)
        .where(primaryKey, primaryKeyValue);
    loadRelations(query, fields);
    if (queryBuilderCallback) {
        queryBuilderCallback(query, ctx);
    }
    const modelToReturn = await query.firstOrFail();
    return modelToReturn;
};
//# sourceMappingURL=get_model_data.js.map