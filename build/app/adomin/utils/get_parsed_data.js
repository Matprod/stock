import { getValidationSchemaFromConfig } from '#adomin/routes/get_validation_schema_from_lucid_model';
import { getGenericMessages } from '#adomin/validation/validation_messages';
export const getParsedData = async ({ ctx, validationMode, modelConfig }) => {
    const schema = await getValidationSchemaFromConfig(modelConfig, validationMode);
    const Model = modelConfig.model();
    const parsedData = await ctx.request.validate({ schema, messages: getGenericMessages(Model) });
    if (modelConfig.afterValidatePayloadTransformCallback) {
        return modelConfig.afterValidatePayloadTransformCallback(parsedData, ctx);
    }
    return parsedData;
};
//# sourceMappingURL=get_parsed_data.js.map