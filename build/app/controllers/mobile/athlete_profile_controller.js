import AthleteProfileService from '#services/mobile/athlete_profile_service';
import { changeEmailSchema, changePasswordSchema, updateAthleteProfileSchema, } from '#schemas/mobile/athlete_profile';
export default class AthleteProfileController {
    athleteProfileService;
    constructor() {
        this.athleteProfileService = new AthleteProfileService();
    }
    async getProfile({ response, athlete }) {
        const athleteProfile = await this.athleteProfileService.getProfile(athlete.athleteid);
        if (!athleteProfile) {
            return response.notFound({ message: 'Athlete not found' });
        }
        return response.json({
            ...athleteProfile,
            athlete: athleteProfile.athlete.serialize(),
        });
    }
    async updateProfile({ response, athlete, request }) {
        const payload = await updateAthleteProfileSchema.validate(request.body());
        await this.athleteProfileService.updateProfile(athlete.athleteid, payload);
        return response.json({ message: 'Profile updated successfully' });
    }
    async changeEmail({ response, athlete, request }) {
        const { email, password } = await changeEmailSchema.validate(request.body());
        const error = await this.athleteProfileService.changeEmail(athlete.athleteid, email, password);
        if (error) {
            return response.status(error.status).json({ message: error.message });
        }
        return response.json({ message: 'Email updated successfully' });
    }
    async changePassword({ response, athlete, request }) {
        const { currentPassword, newPassword } = await changePasswordSchema.validate(request.body());
        const error = await this.athleteProfileService.changePassword(athlete.athleteid, currentPassword, newPassword);
        if (error) {
            return response.status(error.status).json({ message: error.message });
        }
        return response.json({ message: 'Password updated successfully' });
    }
}
//# sourceMappingURL=athlete_profile_controller.js.map