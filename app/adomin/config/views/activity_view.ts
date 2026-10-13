import { createModelViewConfig } from '#adomin/create_model_view_config'
import Activity from '#models_pg/activity'

export const ACTIVITY_VIEW = createModelViewConfig(() => Activity, {
  label: 'Activities',
  icon: 'dumbbell',
  isHidden: true,
  queryBuilderCallback: (q) => {
    q.preload('activityDisplayVariables', (query) => {
      query.preload('displayVariable')
    })
  },
  columns: {
    name: {
      type: 'string',
      label: 'Name',
    },
    activityDisplayVariables: {
      type: 'hasManyRelation',
      label: 'Variables à afficher',
      modelName: 'ActivityDisplayVariable',
      labelFields: ['displayVariable.name', 'unit'],
      labelFieldsSeparator: ' -> ',
      editable: false,
      creatable: false,
    },
  },
})
