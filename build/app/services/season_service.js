import { DateTime } from 'luxon';
import Season from '#models_pg/season';
export default class SeasonService {
    async getSeasonFromRequest(request, clubId) {
        const body = request.body();
        const seasonId = body._seasonId || request.header('x-season-id');
        if (!seasonId) {
            return {
                seasonId: null,
                seasonStartDate: null,
                seasonEndDate: null,
            };
        }
        if (clubId) {
            const season = await Season.query()
                .where('id', seasonId)
                .where('clubId', clubId)
                .first();
            if (season) {
                return {
                    seasonId: season.id,
                    seasonStartDate: DateTime.fromJSDate(season.startDate),
                    seasonEndDate: DateTime.fromJSDate(season.endDate),
                };
            }
            return {
                seasonId: null,
                seasonStartDate: null,
                seasonEndDate: null,
            };
        }
        return {
            seasonId,
            seasonStartDate: null,
            seasonEndDate: null,
        };
    }
}
//# sourceMappingURL=season_service.js.map