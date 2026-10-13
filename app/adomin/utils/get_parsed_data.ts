import { ModelConfig } from '#adomin/create_model_view_config'
import { getValidationSchemaFromConfig } from '#adomin/routes/get_validation_schema_from_lucid_model'
import { AdominValidationMode } from '#adomin/validation/adomin_validation_helpers'
import { getGenericMessages } from '#adomin/validation/validation_messages'
import { HttpContext } from '@adonisjs/core/http'

interface GetParsedDataPayload {
  validationMode: AdominValidationMode
  modelConfig: ModelConfig
  ctx: HttpContext
}

export const getParsedData = async ({ ctx, validationMode, modelConfig }: GetParsedDataPayload) => {
  const schema = await getValidationSchemaFromConfig(modelConfig, validationMode)
  const Model = modelConfig.model()
  const parsedData = await ctx.request.validate({ schema, messages: getGenericMessages(Model) })

  if (modelConfig.afterValidatePayloadTransformCallback) {
    return modelConfig.afterValidatePayloadTransformCallback(parsedData, ctx)
  }

  return parsedData
}
