import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import Disease from '#models_pg/disease'

export const DISEASE_VIEW = createModelViewConfig(() => Disease, {
  label: 'Maladies',
  icon: 'heart',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    startDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de la maladie',
    },
    endDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de fin de la maladie',
    },
    athlete: {
      type: 'belongsToRelation',
      label: 'Athlete',
      modelName: 'Athlete',
      labelFields: ['firstName', 'lastName'],
      preload: true,
    },
    name: {
      type: 'string',
      label: 'Nom de la maladie',
    },
  },
})
