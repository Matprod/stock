import { createModelViewConfig } from '#adomin/create_model_view_config';
import { USER_ROLE } from '#constants/user.constants';
import InjuryType from '#models_pg/injury_type';
export const INJURY_TYPE_VIEW = createModelViewConfig(() => InjuryType, {
    label: 'Types de blessures',
    icon: 'bone',
    crudlRights: {
        update: async (ctx) => {
            return {
                hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
                errorMessage: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
                    ? undefined
                    : "Vous n'avez pas les droits pour modifier une position",
            };
        },
        delete: async (ctx) => {
            return {
                hasAccess: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN,
                errorMessage: ctx.auth.user?.role === USER_ROLE.SUPER_ADMIN
                    ? undefined
                    : "Vous n'avez pas les droits pour supprimer une position",
            };
        },
    },
    columns: {
        name: {
            type: 'string',
            label: 'Name',
        },
        section: {
            type: 'belongsToRelation',
            label: 'Catégorie',
            modelName: 'InjurySection',
            labelFields: ['name'],
            fkName: 'categoryId',
        },
    },
});
//# sourceMappingURL=injury_type_view.js.map