import { createModelViewConfig } from '#adomin/create_model_view_config'
import { USER_ROLE } from '#constants/user.constants'
import Biomarker from '#models_pg/biomarker'

export const BIOMARKER_VIEW = createModelViewConfig(() => Biomarker, {
  label: 'Biomarqueurs',
  icon: 'flask',
  queryBuilderCallback: (q, ctx) => {
    if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN && ctx.auth.user?.clubId) {
      q.whereHas('athlete', (athleteQuery) => {
        athleteQuery.where('club_id', ctx.auth.user!.clubId)
      })
    }
  },
  columns: {
    athlete: {
      type: 'belongsToRelation',
      label: 'Athlete',
      modelName: 'Athlete',
      labelFields: ['firstName', 'lastName'],
      labelFieldsSeparator: ' ',
      fkName: 'athleteId',
    },
    biomarkerType: {
      type: 'belongsToRelation',
      label: 'Biomarqueur',
      modelName: 'BiomarkerType',
      labelFields: ['name', 'unit'],
      labelFieldsSeparator: ' - ',
      fkName: 'biomarkerTypeId',
    },
    value: {
      type: 'string',
      label: 'Value',
    },
    measuredAt: {
      type: 'date',
      subType: 'datetime',
      label: 'Measured at',
    },
  },
})
