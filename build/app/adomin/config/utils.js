import { USER_ROLE } from '#constants/user.constants';
export const createRoleVisibilityCheck = (allowedRoles, errorMessage) => {
    return async (ctx) => {
        const userRole = ctx.auth.user?.role;
        if (!userRole) {
            return {
                hasAccess: false,
                errorMessage: 'Utilisateur non connecté',
            };
        }
        if (userRole === USER_ROLE.SUPER_ADMIN) {
            return {
                hasAccess: true,
                errorMessage: undefined,
            };
        }
        const hasAccess = allowedRoles.includes(userRole);
        return {
            hasAccess,
            errorMessage: hasAccess
                ? undefined
                : (errorMessage ?? "Vous n'avez pas les droits pour accéder à cette vue"),
        };
    };
};
//# sourceMappingURL=utils.js.map