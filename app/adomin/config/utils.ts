import type { AdominRightsCheckFunction } from '#adomin/routes/adomin_routes_overrides_and_rights'
import { USER_ROLE, type UserRole } from '#constants/user.constants'

export const createRoleVisibilityCheck = (
  allowedRoles: UserRole[],
  errorMessage?: string
): AdominRightsCheckFunction => {
  return async (ctx) => {
    const userRole = ctx.auth.user?.role

    if (!userRole) {
      return {
        hasAccess: false,
        errorMessage: 'Utilisateur non connecté',
      }
    }

    if (userRole === USER_ROLE.SUPER_ADMIN) {
      return {
        hasAccess: true,
        errorMessage: undefined,
      }
    }

    const hasAccess = allowedRoles.includes(userRole)

    return {
      hasAccess,
      errorMessage: hasAccess
        ? undefined
        : (errorMessage ?? "Vous n'avez pas les droits pour accéder à cette vue"),
    }
  }
}
