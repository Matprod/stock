import { createModelViewConfig } from '#adomin/create_model_view_config'
import { USER_ROLE } from '#constants/user.constants'
import BiomarkerType from '#models_pg/biomarker_type'

export const BIOMARKER_TYPE_VIEW = createModelViewConfig(() => BiomarkerType, {
  label: 'Types de biomarqueurs',
  icon: 'flask',
  crudlRights: {
    update: async (ctx) => ({
      hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
      errorMessage:
        ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
          ? undefined
          : "Vous n'avez pas les droits pour modifier un type de biomarqueur",
    }),
    delete: async (ctx) => ({
      hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
      errorMessage:
        ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
          ? undefined
          : "Vous n'avez pas les droits pour supprimer un type de biomarqueur",
    }),
  },
  columns: {
    name: {
      type: 'string',
      label: 'Name',
    },
    displayName: {
      type: 'string',
      label: 'Nom affiché',
      optional: true,
    },
    unit: {
      type: 'string',
      label: 'Unit',
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
