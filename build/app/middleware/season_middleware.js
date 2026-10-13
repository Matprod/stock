export default class SeasonMiddleware {
    async handle({ request }, next) {
        const xSeasonId = request.header('x-season-id');
        if (xSeasonId) {
            request.updateBody({
                ...request.body(),
                _seasonId: xSeasonId,
            });
        }
        return next();
    }
}
//# sourceMappingURL=season_middleware.js.map