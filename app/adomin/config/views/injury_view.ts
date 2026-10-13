import { createModelViewConfig } from '#adomin/create_model_view_config'
import { USER_ROLE } from '#constants/user.constants'
import Injury from '#models_pg/injury'

export const INJURY_VIEW = createModelViewConfig(() => Injury, {
  label: 'Blessures',
  icon: 'bone',
  queryBuilderCallback: (q, ctx) => {
    if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN && ctx.auth.user?.clubId) {
      q.whereHas('athlete', (athleteQuery) => {
        athleteQuery.whereHas('club', (clubQuery) => {
          clubQuery.where('id', ctx.auth.user!.clubId)
        })
      })
    }
  },
  columns: {
    dateOfInjury: {
      type: 'date',
      subType: 'date',
      label: 'Date',
    },
    recoveryDate: {
      type: 'date',
      subType: 'date',
      label: 'Date de récupération',
      optional: true,
    },
    injuryType: {
      type: 'belongsToRelation',
      label: 'Type de blessure',
      modelName: 'InjuryType',
      labelFields: ['name', 'section.name'],
      labelFieldsSeparator: ' - ',
      fkName: 'typeOfInjuryId',
    },
    athlete: {
      type: 'belongsToRelation',
      label: 'Athlete',
      modelName: 'Athlete',
      labelFields: ['firstName', 'lastName'],
      labelFieldsSeparator: ' ',
    },
  },
})
