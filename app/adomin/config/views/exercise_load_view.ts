import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import ExerciseLoad from '#models_pg/exercise_load'

export const EXERCISE_LOAD_VIEW = createModelViewConfig(() => ExerciseLoad, {
  label: "Charges d'exercice",
  icon: 'weight',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    gearLoadKg: {
      type: 'number',
      label: "Poids de l'équipement (kg)",
      nullable: true,
      optional: true,
      size: 250,
    },
    weaponLoadKg: {
      type: 'number',
      label: "Poids de l'arme (kg)",
      nullable: true,
      optional: true,
      size: 200,
    },
    totalLoadKg: {
      type: 'number',
      label: 'Charge totale (kg)',
      computed: true,
      size: 150,
    },
    athlete: {
      type: 'belongsToRelation',
      label: 'Athlete',
      modelName: 'Athlete',
      labelFields: ['firstName', 'lastName'],
      labelFieldsSeparator: ' ',
    },
    activity: {
      type: 'belongsToRelation',
      label: 'Activity',
      modelName: 'Activity',
      labelFields: ['name'],
      fkName: 'activityId',
    },
  },
})
