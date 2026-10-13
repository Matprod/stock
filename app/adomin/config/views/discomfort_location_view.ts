import { createModelViewConfig } from '#adomin/create_model_view_config'
import DiscomfortLocation from '#models_pg/pain_discomfort_location'

export const DISCOMFORT_LOCATION_VIEW = createModelViewConfig(() => DiscomfortLocation, {
  label: 'Endroits de douleur',
  icon: 'bone',
  isHidden: true,
  columns: {
    name: {
      type: 'string',
      label: 'Nom',
    },
    zone: {
      type: 'belongsToRelation',
      label: 'Zone',
      modelName: 'Zone',
      labelFields: ['name'],
      fkName: 'zoneId',
    },
  },
})
