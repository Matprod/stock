import { createModelViewConfig } from '#adomin/create_model_view_config';
import { METRIC_DATA_TYPE } from '#constants/metrics.constants';
import SleepMetric from '#models_pg/sleep_metric';
import { createRoleVisibilityCheck } from '../utils.js';
export const SLEEP_METRICS_VIEW = createModelViewConfig(() => SleepMetric, {
    label: 'Sleep Metrics',
    icon: 'bed',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        name: {
            type: 'string',
            label: 'Nom',
        },
        description: {
            type: 'string',
            multiline: true,
            size: 500,
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
//# sourceMappingURL=sleep_metric_view.js.map