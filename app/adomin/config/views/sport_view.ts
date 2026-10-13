import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import Sport from '#models_pg/sport'

export const SPORT_VIEW = createModelViewConfig(() => Sport, {
  label: 'Sport',
  icon: 'trophy',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    name: {
      type: 'string',
      label: 'Nom',
    },
    clubs: {
      type: 'hasManyRelation',
      label: 'Clubs',
      modelName: 'Club',
      labelFields: ['name'],
      preload: true,
    },
  },
})
