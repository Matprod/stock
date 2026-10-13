import Athlete from '#models_pg/athlete';
import hash from '@adonisjs/core/services/hash';
import AthleteService from '#services/athlete_service';
import { verifyDjangoPassword } from '../../utils/verifiy_django_password.js';
export default class AthleteProfileService {
    athleteService;
    constructor() {
        this.athleteService = new AthleteService();
    }
    async getProfile(athleteId) {
        const athlete = await this.athleteService.getAthleteById(athleteId);
        if (!athlete) {
            return null;
        }
        await athlete.load('playerPosition');
        const positionName = await this.athleteService.getAthletePositionName(athleteId, athlete.appLanguageOrDefault);
        if (athlete.playerPosition && positionName) {
            athlete.playerPosition.name = positionName;
        }
        await athlete.load('injuries');
        await athlete.load('athleteProviders');
        return {
            athlete,
            isChatbotEnabled: athlete.clubId !== '7',
            app: {
                version: '1.0.0',
            },
        };
    }
    async updateProfile(athleteId, payload) {
        if (Object.keys(payload).length === 0) {
            return;
        }
        await Athlete.query().where('id', athleteId).update(payload);
    }
    async changePassword(athleteId, currentPassword, newPassword) {
        const athlete = await Athlete.findOrFail(athleteId);
        if (!(await this.verifyPassword(athlete, currentPassword))) {
            return { message: 'Invalid password', status: 401 };
        }
        if (currentPassword === newPassword) {
            return { message: 'New password must be different from current password', status: 400 };
        }
        athlete.password = await hash.make(newPassword);
        await athlete.save();
        return null;
    }
    async changeEmail(athleteId, email, password) {
        const athlete = await Athlete.findOrFail(athleteId);
        const normalizedEmail = email.trim().toLowerCase();
        if (!(await this.verifyPassword(athlete, password))) {
            return { message: 'Invalid password', status: 401 };
        }
        if (athlete.email.toLowerCase() === normalizedEmail) {
            return { message: 'New email must be different from current email', status: 400 };
        }
        const emailTaken = await Athlete.query()
            .select('id')
            .where('email', normalizedEmail)
            .whereNot('id', athleteId)
            .first();
        if (emailTaken) {
            return { message: 'Email is already in use', status: 409 };
        }
        athlete.email = normalizedEmail;
        await athlete.save();
        return null;
    }
    async verifyPassword(athlete, password) {
        const storedPassword = athlete.password ?? '';
        if (storedPassword.startsWith('pbkdf2_sha256')) {
            const isVerified = verifyDjangoPassword(password, storedPassword);
            if (isVerified) {
                athlete.password = await hash.make(password);
                await athlete.save();
            }
            return isVerified;
        }
        return hash.verify(storedPassword, password);
    }
}
//# sourceMappingURL=athlete_profile_service.js.map