import { createModelViewConfig } from '#adomin/create_model_view_config'
import PriorityFeatureWeight from '#models_pg/priority_feature_weight'
import { createRoleVisibilityCheck } from '../utils.js'

export const FEATURE_WEIGHT_VIEW = createModelViewConfig(() => PriorityFeatureWeight, {
  label: 'Poids des features',
  icon: 'weight',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    insight: {
      type: 'belongsToRelation',
      label: 'Insight',
      modelName: 'Insight',
      labelFields: ['name'],
      preload: true,
    },
    club: {
      type: 'belongsToRelation',
      label: 'Club',
      modelName: 'Club',
      labelFields: ['name'],
      preload: true,
    },
    weight: {
      type: 'number',
      label: 'Poids',
    },
    type: {
      type: 'enum',
      label: 'Type',
      options: [
        { label: 'Performance', value: 'performance' },
        { label: 'Injury', value: 'injury' },
      ],
    },
  },
})
