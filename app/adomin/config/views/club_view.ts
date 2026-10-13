import { createModelViewConfig } from '#adomin/create_model_view_config'
import Club from '#models_pg/club'
import { CLUB_LANGUAGE_OPTIONS } from '#constants/club.constants'
import { createRoleVisibilityCheck } from '../utils.js'

export const CLUB_VIEW = createModelViewConfig(() => Club, {
  label: 'Club',
  icon: 'trophy',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    name: {
      type: 'string',
      label: 'Nom',
    },
    sport: {
      type: 'belongsToRelation',
      label: 'Sport',
      modelName: 'Sport',
      labelFields: ['name'],
      preload: true,
    },
    blackListActivities: {
      type: 'manyToManyRelation',
      label: 'Blacklist des activités',
      modelName: 'Activity',
      labelFields: ['name'],
      preload: true,
      pivotTable: 'blacklist_activities',
    },
    users: {
      type: 'hasManyRelation',
      label: 'Membres',
      modelName: 'User',
      labelFields: ['email'],
      preload: true,
    },
    insights: {
      type: 'manyToManyRelation',
      label: 'Insights',
      modelName: 'Insight',
      labelFields: ['variableName'],
      preload: true,
      pivotTable: 'club_insights',
    },
    startDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de début',
      optional: true,
    },
    endDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de fin',
      optional: true,
    },
    language: {
      type: 'enum',
      options: CLUB_LANGUAGE_OPTIONS,
      label: 'Langue du club',
      optional: true,
    },
  },
})
