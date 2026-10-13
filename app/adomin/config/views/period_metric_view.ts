import { createModelViewConfig } from '#adomin/create_model_view_config'
import { METRIC_AGGREGATION_METHOD, METRIC_DATA_TYPE } from '#constants/metrics.constants'
import PeriodMetric from '#models_pg/period_metric'
import { createRoleVisibilityCheck } from '../utils.js'

export const PERIOD_METRICS_VIEW = createModelViewConfig(() => PeriodMetric, {
  label: 'Period Metrics',
  icon: 'clock',
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
    aggregationMethod: {
      type: 'enum',
      options: Object.entries(METRIC_AGGREGATION_METHOD).map(([key, value]) => ({
        label: key,
        value,
      })),
      label: "Méthode d'agrégation",
      defaultValue: METRIC_AGGREGATION_METHOD.SUM,
    },
    dataType: {
      type: 'enum',
      options: Object.entries(METRIC_DATA_TYPE).map(([key, value]) => ({ label: key, value })),
      label: 'Type de données',
      defaultValue: METRIC_DATA_TYPE.INTEGER,
    },
  },
})
