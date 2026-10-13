import logger from '@adonisjs/core/services/logger';
import ExternalApiKeyService from '#services/external_api_key_service';
export default class ExternalApiKeyMiddleware {
    apiKeyService;
    constructor(apiKeyService = new ExternalApiKeyService()) {
        this.apiKeyService = apiKeyService;
    }
    async handle(ctx, next) {
        const header = ctx.request.header('Authorization')?.trim() ?? '';
        const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
        const apiKey = token ? await this.apiKeyService.authenticate(token) : null;
        if (!apiKey) {
            return ctx.response.unauthorized({ message: 'Invalid API key' });
        }
        ctx.externalApiKey = apiKey;
        void this.apiKeyService.touchLastUsed(apiKey).catch((error) => {
            logger.warn({ error, apiKeyId: apiKey.id }, 'Failed to update API key lastUsedAt');
        });
        return next();
    }
}
//# sourceMappingURL=external_api_key_middleware.js.map