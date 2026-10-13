import { createModelViewConfig } from '#adomin/create_model_view_config'
import { USER_ROLE } from '#constants/user.constants'
import Club from '#models_pg/club'
import PlayerPosition from '#models_pg/player_position'

export const PLAYER_POSITION_VIEW = createModelViewConfig(() => PlayerPosition, {
  label: 'Positions',
  icon: 'user-pin',
  queryBuilderCallback: (q, ctx) => {
    if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN && ctx.auth.user?.clubId) {
      q.whereHas('sport', (sportQuery) => {
        sportQuery.whereHas('clubs', (clubQuery) => {
          clubQuery.where('id', ctx.auth.user!.clubId)
        })
      })
    }
  },
  afterValidatePayloadTransformCallback: async (payload, ctx) => {
    if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN) {
      const club = await Club.find(ctx.auth.user!.clubId)
      if (club) {
        payload.sport = club?.sportId
      }
    }
    return payload
  },
  crudlRights: {
    update: async (ctx) => {
      return {
        hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
        errorMessage:
          ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
            ? undefined
            : "Vous n'avez pas les droits pour modifier une position",
      }
    },
    delete: async (ctx) => {
      return {
        hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
        errorMessage:
          ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
            ? undefined
            : "Vous n'avez pas les droits pour supprimer une position",
      }
    },
    create: async (ctx) => {
      return {
        hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
        errorMessage:
          ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
            ? undefined
            : "Vous n'avez pas les droits pour créer une position",
      }
    },
  },
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
      isVisible: async (ctx) => {
        return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
      },
      optional: true,
    },
  },
})
