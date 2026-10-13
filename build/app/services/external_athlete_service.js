import Athlete from '#models_pg/athlete';
const serializeAthlete = (athlete) => {
    return {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        birthDate: athlete.birthDate.toFormat('yyyy-MM-dd'),
        startDate: athlete.startDate.toFormat('yyyy-MM-dd'),
        endDate: athlete.endDate?.toISODate() ?? null,
        jerseyNumber: athlete.jerseyNumber,
        heightCm: athlete.heightCm,
        weightKg: athlete.weightKg,
        gender: athlete.gender,
        position: athlete.playerPosition.name,
    };
};
export default class ExternalAthleteService {
    async listByClub(clubId) {
        const athletes = await Athlete.query()
            .where('clubId', clubId)
            .select([
            'id',
            'firstName',
            'lastName',
            'birthDate',
            'startDate',
            'endDate',
            'jerseyNumber',
            'heightCm',
            'weightKg',
            'gender',
            'playerPositionId',
        ])
            .preload('playerPosition')
            .orderBy('lastName', 'asc')
            .orderBy('firstName', 'asc');
        return athletes.map(serializeAthlete);
    }
}
//# sourceMappingURL=external_athlete_service.js.map