import limiter from '@adonisjs/limiter/services/main';
import { EXTERNAL_API_RATE_LIMIT } from '#constants/external_api.constants';
export const externalThrottle = limiter.define('external', (ctx) => {
    const keyId = ctx.externalApiKey?.id;
    if (!keyId) {
        return limiter.noLimit();
    }
    return limiter
        .allowRequests(EXTERNAL_API_RATE_LIMIT.requests)
        .every(EXTERNAL_API_RATE_LIMIT.duration)
        .usingKey(`external_${keyId}`)
        .limitExceeded((error) => {
        error.setMessage('Too many requests');
    });
});
//# sourceMappingURL=limiter.js.map