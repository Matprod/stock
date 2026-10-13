import { randomInt, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { OTP_PURPOSE } from '#constants/otp.constants'
import OtpCode from '#models_pg/otp_code'
import User from '#models_pg/user'
import BrevoService from '#services/brevo_service'

const OTP_TTL_MINUTES = 10

export class PasswordResetService {
  private readonly brevoService = new BrevoService()

  public async sendUserOtp(email: string): Promise<{ idx: string }> {
    const user = await User.findBy('email', email)

    if (!user) {
      return { idx: randomUUID() }
    }

    await OtpCode.query()
      .where('email', email)
      .where('purpose', OTP_PURPOSE.USER_FORGOT_PASSWORD)
      .delete()

    const code = this.generateOtpCode()
    const idx = randomUUID()

    await OtpCode.create({
      index: idx,
      code,
      email,
      purpose: OTP_PURPOSE.USER_FORGOT_PASSWORD,
      expiresAt: DateTime.now().plus({ minutes: OTP_TTL_MINUTES }),
    })

    await this.brevoService.sendEmail(email, 'FORGOT_PASSWORD', { code })

    return { idx }
  }

  public async verifyUserOtp(idx: string, code: string): Promise<void> {
    await this.getValidUserOtp(idx, code)
  }

  public async resetUserPassword(input: {
    email: string
    newPassword: string
    idx: string
    code: string
  }): Promise<void> {
    const otp = await this.getValidUserOtp(input.idx, input.code, input.email)

    const user = await User.findBy('email', input.email)
    if (!user) {
      throw new PasswordResetError('USER_NOT_FOUND', 'User not found')
    }

    user.password = input.newPassword
    await user.save()

    const tokens = await User.accessTokens.all(user)
    await Promise.all(tokens.map((token) => User.accessTokens.delete(user, token.identifier)))

    await otp.delete()
  }

  private generateOtpCode(): string {
    return Array.from({ length: 4 }, () => String(randomInt(0, 10))).join('')
  }

  private async getValidUserOtp(idx: string, code: string, email?: string): Promise<OtpCode> {
    const otp = await OtpCode.query()
      .where('index', idx)
      .where('purpose', OTP_PURPOSE.USER_FORGOT_PASSWORD)
      .first()

    if (!otp) {
      throw new PasswordResetError('OTP_NOT_FOUND', 'OTP code request not found')
    }

    if (DateTime.now() > otp.expiresAt) {
      throw new PasswordResetError('OTP_EXPIRED', 'OTP code has expired')
    }

    if (otp.code !== code) {
      throw new PasswordResetError('OTP_INVALID', 'Invalid OTP code')
    }

    if (email && otp.email !== email) {
      throw new PasswordResetError('OTP_INVALID', 'Invalid OTP code')
    }

    return otp
  }
}

export class PasswordResetError extends Error {
  constructor(
    public readonly code: 'OTP_NOT_FOUND' | 'OTP_EXPIRED' | 'OTP_INVALID' | 'USER_NOT_FOUND',
    message: string
  ) {
    super(message)
    this.name = 'PasswordResetError'
  }
}
