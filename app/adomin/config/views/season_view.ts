import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import Season from '#models_pg/season'

export const SEASON_VIEW = createModelViewConfig(() => Season, {
  label: 'Saison',
  icon: 'calendar',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    name: {
      type: 'string',
      label: 'Nom',
    },
    startDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de début',
    },
    endDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de fin',
      optional: true,
    },
    club: {
      type: 'belongsToRelation',
      label: 'Club',
      modelName: 'Club',
      labelFields: ['name'],
    },
  },
})
