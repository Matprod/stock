import { createModelViewConfig } from '#adomin/create_model_view_config';
import DisplayVariable from '#models_pg/display_variable';
import { createRoleVisibilityCheck } from '../utils.js';
export const DISPLAY_VARIABLE_VIEW = createModelViewConfig(() => DisplayVariable, {
    label: 'Display Variables',
    icon: 'adjustments-alt',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        name: {
            type: 'string',
            label: 'Name',
        },
    },
});
//# sourceMappingURL=display_variable_view.js.map