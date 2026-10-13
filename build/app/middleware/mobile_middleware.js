import AthleteTokenService, { TokenError } from '#services/athlete_token_service';
import { AppVersionService } from '#services/app_version_service';
import { getLanguageFromRequest } from '#utils/language';
export default class MobileMiddleware {
    appVersionService;
    constructor(appVersionService = new AppVersionService()) {
        this.appVersionService = appVersionService;
    }
    async handle(ctx, next) {
        const appVersion = ctx.request.header('x-app-version')?.trim();
        const platform = ctx.request.header('x-app-platform')?.trim();
        if (appVersion && platform) {
            const updateRequired = await this.appVersionService.getUpdateRequired(appVersion, platform, getLanguageFromRequest(ctx.request));
            if (updateRequired) {
                return ctx.response.status(426).json(updateRequired);
            }
        }
        const token = ctx.request.header('Authorization')?.trim() ?? null;
        if (!token) {
            return ctx.response.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }
        try {
            const payload = await AthleteTokenService.verifyAccessToken(token);
            ctx.athlete = payload;
            ctx.athleteToken = token;
            return next();
        }
        catch (err) {
            const message = err instanceof TokenError ? err.message : 'Token is invalid';
            return ctx.response.status(401).json({
                success: false,
                message,
            });
        }
    }
}
//# sourceMappingURL=mobile_middleware.js.map