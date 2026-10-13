import vine from '@vinejs/vine';
export const updateAthleteProfileSchema = vine.compile(vine.object({
    firstName: vine.string().trim().minLength(1).optional(),
    lastName: vine.string().trim().minLength(1).optional(),
    watchType: vine.string().trim().minLength(1).nullable().optional(),
    dataSource: vine.enum(['strava', 'wahoo']).nullable().optional(),
    gender: vine.enum(['Male', 'Female']).optional(),
    birthDate: vine.date({ formats: ['iso8601'] }).optional(),
    height: vine.number().min(1).optional(),
    weight: vine.number().min(1).optional(),
    appLanguage: vine.enum(['en', 'fr']).optional(),
    fcmDeviceToken: vine.string().trim().minLength(1).optional(),
}));
const newPasswordRule = vine
    .string()
    .trim()
    .minLength(8)
    .regex(/\d/)
    .regex(/[^A-Za-z0-9]/);
export const changeEmailSchema = vine.compile(vine.object({
    email: vine.string().trim().email(),
    password: vine.string().trim().minLength(1),
}));
export const changePasswordSchema = vine.compile(vine.object({
    currentPassword: vine.string().trim().minLength(1),
    newPassword: newPasswordRule,
}));
//# sourceMappingURL=athlete_profile.js.map