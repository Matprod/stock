import HealthPain from '#models_pg/health_pain';
export class HealthPainService {
    async getAllPains({ athleteId, clubId }) {
        return HealthPain.query()
            .whereHas('health', (healthQuery) => {
            healthQuery.whereHas('day', (dayQuery) => {
                dayQuery.if(athleteId, (q) => q.where('athleteId', athleteId));
                dayQuery.whereHas('athlete', (athleteQuery) => {
                    athleteQuery.where('clubId', clubId);
                });
            });
        })
            .preload('location', (locationQuery) => {
            locationQuery.preload('zone');
        })
            .preload('health', (healthQuery) => {
            healthQuery.preload('day');
        })
            .orderBy('updatedAt', 'desc');
    }
}
//# sourceMappingURL=health_pain_service.js.map