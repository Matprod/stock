import { createModelViewConfig } from '#adomin/create_model_view_config'
import { METRIC_DATA_TYPE } from '#constants/metrics.constants'
import DayMetric from '#models_pg/day_metric'
import { createRoleVisibilityCheck } from '../utils.js'

export const DAY_METRICS_VIEW = createModelViewConfig(() => DayMetric, {
  label: 'Day Metrics',
  icon: 'calendar',
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
})
