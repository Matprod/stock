import { createModelViewConfig } from '#adomin/create_model_view_config';
import LlmAliment from '#models_pg/llm_aliment';
import { createRoleVisibilityCheck } from '../utils.js';
export const LLM_ALIMENT_VIEW = createModelViewConfig(() => LlmAliment, {
    label: 'Aliments LLM',
    icon: 'carrot',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        name: {
            type: 'string',
            label: 'Name',
            size: 200,
        },
    },
});
//# sourceMappingURL=nutrition_llm_aliment_view.js.map