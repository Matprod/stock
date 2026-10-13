import { createModelViewConfig } from '#adomin/create_model_view_config';
import { createRoleVisibilityCheck } from '../utils.js';
import Aliment from '#models_pg/aliment';
export const NUTRITION_ALIMENT_VIEW = createModelViewConfig(() => Aliment, {
    label: 'Aliments',
    icon: 'apple',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        alimCode: {
            type: 'number',
            label: 'Code aliment',
            optional: true,
        },
        name: {
            type: 'string',
            label: 'Name',
            nullable: true,
            size: 200,
        },
    },
});
//# sourceMappingURL=nutrition_aliment_view.js.map