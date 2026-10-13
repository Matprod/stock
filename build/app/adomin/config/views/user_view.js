import { createModelViewConfig } from '#adomin/create_model_view_config';
import { USER_DEFAULT_PAGE, USER_ROLE } from '#constants/user.constants';
import User from '#models_pg/user';
import { createRoleVisibilityCheck } from '../utils.js';
export const USER_VIEW = createModelViewConfig(() => User, {
    label: 'Staff',
    icon: 'user',
    visibilityCheck: createRoleVisibilityCheck([USER_ROLE.CLUB_ADMIN]),
    afterValidatePayloadTransformCallback: async (payload, ctx) => {
        if (ctx.auth.user?.role !== USER_ROLE.SUPER_ADMIN) {
            payload.club = ctx.auth.user?.clubId;
        }
        return payload;
    },
    queryBuilderCallback(q, ctx) {
        const userClubId = ctx.auth.user?.clubId;
        const isSuperAdmin = ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
        if (userClubId && !isSuperAdmin) {
            q.where('club_id', userClubId);
        }
        if (!isSuperAdmin) {
            q.where('role', '!=', USER_ROLE.SUPER_ADMIN);
        }
    },
    columns: {
        email: {
            type: 'string',
            isEmail: true,
            label: 'Email',
        },
        password: {
            type: 'string',
            isPassword: true,
            label: 'Mot de passe',
        },
        role: {
            type: 'enum',
            options: [
                { label: 'Club Staff', value: USER_ROLE.CLUB_STAFF },
                { label: 'Club Admin', value: USER_ROLE.CLUB_ADMIN },
                { label: 'Super Admin', value: USER_ROLE.SUPER_ADMIN },
            ],
            defaultValue: USER_ROLE.CLUB_STAFF,
            label: 'Rôle',
            isVisible: async (ctx) => {
                return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
            },
            optional: true,
        },
        defaultPage: {
            type: 'enum',
            label: 'Page par défaut',
            options: [
                { label: 'Calendar', value: USER_DEFAULT_PAGE.CALENDAR },
                { label: 'Team List', value: USER_DEFAULT_PAGE.TEAM_LIST },
                { label: 'Dashboard', value: USER_DEFAULT_PAGE.DASHBOARD },
                { label: 'Notes', value: USER_DEFAULT_PAGE.NOTES },
                { label: 'Workout Sessions', value: USER_DEFAULT_PAGE.WORKOUT_SESSIONS },
                { label: 'Health', value: USER_DEFAULT_PAGE.HEALTH },
                { label: 'Style Guide', value: USER_DEFAULT_PAGE.STYLE_GUIDE },
                { label: 'Privacy Policy (giga utile tkt)', value: USER_DEFAULT_PAGE.PRIVACY },
            ],
        },
        club: {
            type: 'belongsToRelation',
            label: 'Club',
            modelName: 'Club',
            labelFields: ['name'],
            isVisible: async (ctx) => {
                return ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN;
            },
            optional: true,
        },
        permissions: {
            type: 'manyToManyRelation',
            label: 'Autorisations',
            modelName: 'Permission',
            labelFields: ['name'],
            preload: true,
            pivotTable: 'user_permissions',
        },
        createdAt: {
            type: 'date',
            subType: 'datetime',
            editable: false,
            creatable: false,
            label: 'Date de création',
        },
        updatedAt: {
            type: 'date',
            subType: 'datetime',
            editable: false,
            creatable: false,
            label: 'Date de mise à jour',
        },
    },
});
//# sourceMappingURL=user_view.js.map