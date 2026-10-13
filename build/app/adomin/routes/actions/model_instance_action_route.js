import { getFlatViews } from '#adomin/get_flat_views';
import { isModelConfig } from '../models/get_model_config.js';
export const modelInstanceActionRoute = async (ctx) => {
    const { params, response } = ctx;
    const modelString = params.model;
    const modelConfig = getFlatViews()
        .filter(isModelConfig)
        .find(({ model }) => model().name === modelString);
    if (!modelConfig) {
        return response.notFound({ error: `Model '${modelString}' not found` });
    }
    const found = modelConfig.instanceActions?.find(({ name }) => name === params.action);
    if (!found || found.type !== 'backend-action') {
        return response.notFound({ error: `Action '${params.action}' not found` });
    }
    return await found.action(ctx);
};
//# sourceMappingURL=model_instance_action_route.js.map