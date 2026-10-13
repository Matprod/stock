import { createModelViewConfig } from '#adomin/create_model_view_config'
import { CLUB_PROVIDER_TYPES } from '#constants/club_provider.constants'
import ClubProvider from '#models_pg/club_provider'
import { capitalize } from '../../../utils/string.js'
import { createRoleVisibilityCheck } from '../utils.js'

const PROVIDER_OPTIONS = Object.entries(CLUB_PROVIDER_TYPES).map(([key, value]) => ({
  label: capitalize(key),
  value,
}))

export const CLUB_PROVIDER_VIEW = createModelViewConfig(() => ClubProvider, {
  label: 'Club Provider',
  icon: 'link',
  visibilityCheck: createRoleVisibilityCheck([]),
  columns: {
    provider: {
      type: 'enum',
      label: 'Provider',
      options: PROVIDER_OPTIONS,
    },
    club: {
      type: 'belongsToRelation',
      label: 'Club',
      modelName: 'Club',
      labelFields: ['name'],
      preload: true,
    },
    providerTeamId: {
      type: 'string',
      label: 'ID Provider (team / club)',
      optional: true,
    },
    accessToken: {
      type: 'string',
      label: 'Access token / username / client id',
      optional: true,
      isPassword: true,
    },
    accessTokenSecret: {
      type: 'string',
      label: 'Secret / password',
      optional: true,
      isPassword: true,
    },
    refreshToken: {
      type: 'string',
      label: 'Refresh token',
      optional: true,
      isPassword: true,
    },
    tokenExpiresAt: {
      type: 'date',
      subType: 'datetime',
      label: 'Token expires at',
      optional: true,
    },
    lastSyncedAt: {
      type: 'date',
      subType: 'datetime',
      label: 'Last synced at',
      optional: true,
    },
  },
})
