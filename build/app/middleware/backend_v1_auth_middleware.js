import env from '#start/env';
export default class BackendV1AuthMiddleware {
    async handle(ctx, next) {
        const token = ctx.request.header('Backend-V1-Token');
        const expectedToken = env.get('BACKEND_V1_TOKEN');
        if (token !== expectedToken) {
            return ctx.response.status(401).json({
                success: false,
                message: 'Invalid authentication token',
            });
        }
        return next();
    }
}
//# sourceMappingURL=backend_v1_auth_middleware.js.map