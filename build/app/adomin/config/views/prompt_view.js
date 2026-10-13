import { createModelViewConfig } from '#adomin/create_model_view_config';
import { createRoleVisibilityCheck } from '../utils.js';
import Prompt from '#models_pg/prompt';
export const PROMPT_VIEW = createModelViewConfig(() => Prompt, {
    label: 'Prompt',
    icon: 'robot',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        title: {
            type: 'string',
            label: 'Titre',
            editable: false,
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            optional: true,
            preload: true,
        },
        content: {
            type: 'string',
            multiline: true,
            label: 'Prompt',
            size: 800,
        },
    },
});
//# sourceMappingURL=prompt_view.js.map