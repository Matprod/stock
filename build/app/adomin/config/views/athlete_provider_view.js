import { createModelViewConfig } from '#adomin/create_model_view_config';
import { ATHLETE_PROVIDER_TYPES } from '#constants/athlete_provider.constants';
import AthleteProvider from '#models_pg/athlete_provider';
import { capitalize } from '../../../utils/string.js';
import { createRoleVisibilityCheck } from '../utils.js';
const PROVIDER_OPTIONS = Object.entries(ATHLETE_PROVIDER_TYPES).map(([key, value]) => ({
    label: capitalize(key),
    value,
}));
export const ATHLETE_PROVIDER_VIEW = createModelViewConfig(() => AthleteProvider, {
    label: 'Athlete Provider',
    icon: 'link',
    visibilityCheck: createRoleVisibilityCheck([]),
    columns: {
        provider: {
            type: 'enum',
            label: 'Provider',
            options: PROVIDER_OPTIONS,
        },
        providerAthleteId: {
            type: 'string',
            label: 'ID Provider',
            optional: true,
        },
        athlete: {
            type: 'belongsToRelation',
            label: 'Athlète',
            modelName: 'Athlete',
            labelFields: ['firstName', 'lastName'],
            preload: true,
        },
        accessToken: {
            type: 'string',
            label: 'Access token',
            optional: true,
            isPassword: true,
        },
        accessTokenSecret: {
            type: 'string',
            label: 'Access token secret',
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
    },
});
//# sourceMappingURL=athlete_provider_view.js.map