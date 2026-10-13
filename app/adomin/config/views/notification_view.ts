import { createModelViewConfig } from '#adomin/create_model_view_config'
import Notification from '#models_pg/notification'
import { createRoleVisibilityCheck } from '../utils.js'

export const NOTIFICATION_VIEW = createModelViewConfig(() => Notification, {
  label: 'Notification',
  icon: 'bell-ringing-2',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    title: {
      type: 'string',
      label: 'Titre',
    },
    time: {
      type: 'string',
      label: 'Heure',
    },
    day: {
      type: 'enum',
      label: 'Jour',
      options: [
        { label: 'Aucune option', value: '' },
        { label: 'Lundi', value: 'MONDAY' },
        { label: 'Mardi', value: 'TUESDAY' },
        { label: 'Mercredi', value: 'WEDNESDAY' },
        { label: 'Jeudi', value: 'THURSDAY' },
        { label: 'Vendredi', value: 'FRIDAY' },
        { label: 'Samedi', value: 'SATURDAY' },
        { label: 'Dimanche', value: 'SUNDAY' },
      ],
      defaultValue: '',
      optional: true,
    },
    date: {
      type: 'date',
      subType: 'date',
      label: 'Date',
      optional: true,
    },
    athletes: {
      type: 'manyToManyRelation',
      label: 'Athletes',
      modelName: 'Athlete',
      labelFields: ['firstName', 'lastName'],
      preload: true,
      pivotTable: 'notification_athletes',
      optional: true,
    },
    club: {
      type: 'belongsToRelation',
      label: 'Club',
      modelName: 'Club',
      labelFields: ['name'],
      preload: true,
      optional: true,
    },
    messages: {
      type: 'manyToManyRelation',
      label: 'Messages',
      modelName: 'NotificationMessage',
      labelFields: ['title'],
      preload: true,
      pivotTable: 'notification_message_links',
      optional: true,
    },
  },
})
