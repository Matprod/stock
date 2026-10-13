export default class PermissionMiddleware {
    async handle({ auth, response }, next, requiredPermission) {
        const user = auth.user;
        const userPermissions = await user.related('permissions').query();
        const hasPermission = Array.isArray(requiredPermission)
            ? userPermissions.some((p) => requiredPermission.includes(p.name))
            : userPermissions.some((p) => p.name === requiredPermission);
        if (!hasPermission) {
            return response.forbidden({ message: 'Unauthorized' });
        }
        return next();
    }
}
//# sourceMappingURL=permission_middleware.js.map