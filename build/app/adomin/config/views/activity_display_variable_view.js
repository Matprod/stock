import { createModelViewConfig } from '#adomin/create_model_view_config';
import ActivityDisplayVariable from '#models_pg/activity_display_variable';
import { DISPLAY_VARIABLE_UNIT } from '#constants/display_variable.constants';
import { createRoleVisibilityCheck } from '../utils.js';
const UNIT_OPTIONS = Object.values(DISPLAY_VARIABLE_UNIT).map((value) => ({
    label: value,
    value,
}));
export const ACTIVITY_DISPLAY_VARIABLE_VIEW = createModelViewConfig(() => ActivityDisplayVariable, {
    label: 'Activity Display Variables',
    icon: 'adjustments-alt',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        activity: {
            type: 'belongsToRelation',
            label: 'Activity',
            modelName: 'Activity',
            labelFields: ['name'],
            preload: true,
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            optional: true,
            preload: true,
        },
        unit: {
            type: 'enum',
            label: 'Unité',
            options: UNIT_OPTIONS,
            optional: true,
        },
        displayVariable: {
            type: 'belongsToRelation',
            label: 'Display Variable',
            modelName: 'DisplayVariable',
            labelFields: ['name'],
            preload: true,
        },
    },
});
//# sourceMappingURL=activity_display_variable_view.js.map