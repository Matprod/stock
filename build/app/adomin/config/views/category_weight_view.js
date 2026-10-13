import { createModelViewConfig } from '#adomin/create_model_view_config';
import PriorityCategoryWeight from '#models_pg/priority_category_weight';
import { createRoleVisibilityCheck } from '../utils.js';
export const CATEGORY_WEIGHT_VIEW = createModelViewConfig(() => PriorityCategoryWeight, {
    label: 'Poids des catégories',
    icon: 'weight',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        categoryType: {
            type: 'enum',
            label: 'Catégorie',
            options: [
                { label: 'Activity', value: 'activity' },
                { label: 'Sleep', value: 'sleep' },
                { label: 'Nutrition', value: 'nutrition' },
                { label: 'Health', value: 'health' },
            ],
        },
        type: {
            type: 'enum',
            label: 'Type',
            options: [
                { label: 'Performance', value: 'performance' },
                { label: 'Injury', value: 'injury' },
            ],
        },
        weight: {
            type: 'number',
            label: 'Poids',
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            preload: true,
        },
    },
});
//# sourceMappingURL=category_weight_view.js.map