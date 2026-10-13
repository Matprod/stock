import { createModelViewConfig } from '#adomin/create_model_view_config'
import { createRoleVisibilityCheck } from '../utils.js'
import AppVersion from '#models_pg/app_version'

export const APP_VERSION_VIEW = createModelViewConfig(() => AppVersion, {
  label: 'App versions',
  icon: 'device-mobile',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    version: {
      type: 'string',
      label: 'Version',
    },
    platform: {
      type: 'enum',
      label: 'Plateforme',
      options: [
        { label: 'iOS', value: 'ios' },
        { label: 'Android', value: 'android' },
      ],
    },
    status: {
      type: 'enum',
      label: 'Statut',
      options: [
        { label: 'Development', value: 'development' },
        { label: 'Published', value: 'published' },
        { label: 'Suggest update', value: 'suggest_update' },
        { label: 'Required', value: 'required' },
      ],
    },
    updateMessage: {
      type: 'string',
      label: 'Message (fallback)',
      multiline: true,
      optional: true,
      size: 500,
    },
  },
})
