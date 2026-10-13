import router from '@adonisjs/core/services/router';
import server from '@adonisjs/core/services/server';
server.errorHandler(() => import('#exceptions/handler'));
server.use([
    () => import('#middleware/container_bindings_middleware'),
    () => import('#middleware/force_json_response_middleware'),
    () => import('#middleware/language_middleware'),
    () => import('#middleware/season_middleware'),
    () => import('@adonisjs/cors/cors_middleware'),
]);
router.use([
    () => import('@adonisjs/core/bodyparser_middleware'),
    () => import('@adonisjs/auth/initialize_auth_middleware'),
]);
export const middleware = router.named({
    auth: () => import('#middleware/auth_middleware'),
    backendV1Auth: () => import('#middleware/backend_v1_auth_middleware'),
    permission: () => import('#middleware/permission_middleware'),
    mobile: () => import('#middleware/mobile_middleware'),
    externalApiKey: () => import('#middleware/external_api_key_middleware'),
});
//# sourceMappingURL=kernel.js.map