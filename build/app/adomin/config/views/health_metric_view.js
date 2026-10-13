import { createModelViewConfig } from '#adomin/create_model_view_config';
import { METRIC_DATA_TYPE } from '#constants/metrics.constants';
import HealthMetric from '#models_pg/health_metric';
import { createRoleVisibilityCheck } from '../utils.js';
export const HEALTH_METRICS_VIEW = createModelViewConfig(() => HealthMetric, {
    label: 'Health Metrics',
    icon: 'heart',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        name: {
            type: 'string',
            label: 'Nom',
        },
        displayName: {
            type: 'string',
            label: 'Nom affiché',
            optional: true,
        },
        description: {
            type: 'string',
            label: 'Description',
            optional: true,
        },
        unit: {
            type: 'string',
            label: 'Unité',
            optional: true,
        },
        dataType: {
            type: 'enum',
            options: Object.entries(METRIC_DATA_TYPE).map(([key, value]) => ({ label: key, value })),
            label: 'Type de données',
            defaultValue: METRIC_DATA_TYPE.INTEGER,
        },
    },
});
//# sourceMappingURL=health_metric_view.js.map