import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import EventType from '#models_pg/event_type'
import { EVENT_CATEGORY, EVENT_ICON } from '#constants/event.constants'
import { COLORS } from '#constants/color.constants'
import { TRAVEL_TYPE_LABELS } from '#contracts/travel'

export const EVENT_TYPE_VIEW = createModelViewConfig(() => EventType, {
  label: "Type d'événement",
  icon: 'event',
  visibilityCheck: createRoleVisibilityCheck([]),
  afterCreateCallback: async (entity) => {
    if (entity.eventCategory !== EVENT_CATEGORY.TRAVEL) {
      entity.travelType = null
      await entity.save()
    }
  },
  columns: {
    name: {
      type: 'string',
      label: 'Nom',
    },
    color: {
      type: 'enum',
      label: 'Couleur',
      options: Object.entries(COLORS).map(([key, value]) => ({ label: key, value })),
    },
    icon: {
      type: 'enum',
      label: 'Icône',
      options: Object.entries(EVENT_ICON).map(([key, value]) => ({ label: key, value })),
    },
    eventCategory: {
      type: 'enum',
      label: 'Catégorie',
      options: Object.entries(EVENT_CATEGORY).map(([key, value]) => ({ label: key, value })),
    },
    activity: {
      type: 'belongsToRelation',
      label: 'Activité',
      modelName: 'Activity',
      labelFields: ['name'],
      fkName: 'activityId',
      optional: true,
    },
    travelType: {
      type: 'enum',
      label: 'Type de voyage',
      options: Object.entries(TRAVEL_TYPE_LABELS).map(([key, value]) => ({
        label: value,
        value: key,
      })),
      optional: true,
    },
    clubs: {
      type: 'manyToManyRelation',
      label: 'Clubs',
      modelName: 'Club',
      labelFields: ['name'],
      optional: true,
    },
  },
})
