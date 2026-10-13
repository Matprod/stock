import SportActivityPain from '#models_pg/sport_activity_pain';
import SportActivity from '#models_pg/sport_activity';
export class PainService {
    async upsertPain({ sportActivityId, locationId, rating, clubId, athleteId, }) {
        const query = SportActivityPain.query()
            .where('sportActivityId', sportActivityId)
            .where('locationId', locationId);
        if (clubId || athleteId) {
            query.whereHas('sportActivity', (sportActivityQuery) => {
                sportActivityQuery.whereHas('day', (dayQuery) => {
                    dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                    dayQuery.if(clubId, (q) => q.whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId)));
                });
            });
        }
        const existingPain = await query.first();
        if (existingPain) {
            existingPain.rating = rating;
            return existingPain.save();
        }
        if (clubId || athleteId) {
            const sportActivity = await SportActivity.query()
                .where('id', sportActivityId)
                .whereHas('day', (dayQuery) => {
                dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                dayQuery.if(clubId, (q) => q.whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId)));
            })
                .first();
            if (!sportActivity) {
                throw new Error('Sport activity not accessible for this context');
            }
        }
        return SportActivityPain.create({
            rating,
            locationId,
            sportActivityId,
        });
    }
    async deletePain(painId, { clubId, athleteId }) {
        const query = SportActivityPain.query().where('id', painId);
        if (clubId || athleteId) {
            query.whereHas('sportActivity', (sportActivityQuery) => {
                sportActivityQuery.whereHas('day', (dayQuery) => {
                    dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                    dayQuery.if(clubId, (q) => q.whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId)));
                });
            });
        }
        return query.delete();
    }
    async getAllPains({ athleteId, clubId }) {
        return SportActivityPain.query()
            .whereHas('sportActivity', (sportActivityQuery) => {
            sportActivityQuery.whereHas('day', (dayQuery) => {
                dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                dayQuery.whereHas('athlete', (athleteQuery) => {
                    athleteQuery.where('clubId', clubId);
                });
            });
        })
            .preload('location', (locationQuery) => {
            locationQuery.preload('zone');
        })
            .preload('sportActivity', (sportActivityQuery) => {
            sportActivityQuery.preload('day');
        })
            .orderBy('updatedAt', 'desc');
    }
    async getAllPainsBySportActivityId({ sportActivityId, clubId, athleteId, }) {
        const query = SportActivityPain.query().where('sportActivityId', sportActivityId);
        if (clubId || athleteId) {
            query.whereHas('sportActivity', (sportActivityQuery) => {
                sportActivityQuery.whereHas('day', (dayQuery) => {
                    dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                    dayQuery.if(clubId, (q) => q.whereHas('athlete', (athleteQuery) => athleteQuery.where('clubId', clubId)));
                });
            });
        }
        return query
            .preload('location', (locationQuery) => {
            locationQuery.preload('zone');
        })
            .preload('sportActivity', (sportActivityQuery) => {
            sportActivityQuery.preload('day');
        })
            .orderBy('updatedAt', 'desc');
    }
}
//# sourceMappingURL=pain_service.js.map