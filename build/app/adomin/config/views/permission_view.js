import { createModelViewConfig } from '#adomin/create_model_view_config';
import Permission from '#models_pg/permission';
import { createRoleVisibilityCheck } from '../utils.js';
export const PERMISSION_VIEW = createModelViewConfig(() => Permission, {
    label: 'Permissions',
    icon: 'key',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        name: {
            type: 'string',
            label: 'Nom',
            editable: false,
        },
        description: {
            type: 'string',
            label: 'Description',
            multiline: true,
            optional: true,
        },
    },
});
//# sourceMappingURL=permission_view.js.map