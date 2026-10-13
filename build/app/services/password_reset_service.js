import { randomInt, randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { OTP_PURPOSE } from '#constants/otp.constants';
import OtpCode from '#models_pg/otp_code';
import User from '#models_pg/user';
import BrevoService from '#services/brevo_service';
const OTP_TTL_MINUTES = 10;
export class PasswordResetService {
    brevoService = new BrevoService();
    async sendUserOtp(email) {
        const user = await User.findBy('email', email);
        if (!user) {
            return { idx: randomUUID() };
        }
        await OtpCode.query()
            .where('email', email)
            .where('purpose', OTP_PURPOSE.USER_FORGOT_PASSWORD)
            .delete();
        const code = this.generateOtpCode();
        const idx = randomUUID();
        await OtpCode.create({
            index: idx,
            code,
            email,
            purpose: OTP_PURPOSE.USER_FORGOT_PASSWORD,
            expiresAt: DateTime.now().plus({ minutes: OTP_TTL_MINUTES }),
        });
        await this.brevoService.sendEmail(email, 'FORGOT_PASSWORD', { code });
        return { idx };
    }
    async verifyUserOtp(idx, code) {
        await this.getValidUserOtp(idx, code);
    }
    async resetUserPassword(input) {
        const otp = await this.getValidUserOtp(input.idx, input.code, input.email);
        const user = await User.findBy('email', input.email);
        if (!user) {
            throw new PasswordResetError('USER_NOT_FOUND', 'User not found');
        }
        user.password = input.newPassword;
        await user.save();
        const tokens = await User.accessTokens.all(user);
        await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)));
        await otp.delete();
    }
    generateOtpCode() {
        return Array.from({ length: 4 }, () => String(randomInt(0, 10))).join('');
    }
    async getValidUserOtp(idx, code, email) {
        const otp = await OtpCode.query()
            .where('index', idx)
            .where('purpose', OTP_PURPOSE.USER_FORGOT_PASSWORD)
            .first();
        if (!otp) {
            throw new PasswordResetError('OTP_NOT_FOUND', 'OTP code request not found');
        }
        if (DateTime.now() > otp.expiresAt) {
            throw new PasswordResetError('OTP_EXPIRED', 'OTP code has expired');
        }
        if (otp.code !== code) {
            throw new PasswordResetError('OTP_INVALID', 'Invalid OTP code');
        }
        if (email && otp.email !== email) {
            throw new PasswordResetError('OTP_INVALID', 'Invalid OTP code');
        }
        return otp;
    }
}
export class PasswordResetError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PasswordResetError';
    }
}
//# sourceMappingURL=password_reset_service.js.map