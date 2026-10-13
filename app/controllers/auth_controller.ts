import { HttpContext } from '@adonisjs/core/http'
import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import hash from '@adonisjs/core/services/hash'
import { DateTime } from 'luxon'

import { DEFAULT_MESSAGE_PROVIDER_CONFIG } from '#adomin/validation/default_validator'
import User from '#models_pg/user'
import Athlete from '#models_pg/athlete'
import OtpCode from '#models_pg/otp_code'
import { verifyDjangoPassword } from '../utils/verifiy_django_password.js'
import AthleteTokenService, { TokenError } from '#services/athlete_token_service'
import BrevoService from '#services/brevo_service'
import {
  PasswordResetError,
  PasswordResetService,
} from '#services/password_reset_service'
import {
  loginSchema,
  resetPasswordSchema,
  sendForgotPasswordOtpSchema,
  verifyForgotPasswordOtpSchema,
} from '#schemas/auth'
import { normalizeEmail } from '#utils/email'
import { randomInt, randomUUID } from 'node:crypto'

const refreshTokenSchema = vine.compile(
  vine.object({
    refreshToken: vine.string().trim(),
  })
)

const athleteExistsSchema = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .transform((value) => normalizeEmail(value)),
  })
)

const sendOtpSchema = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .transform((value) => normalizeEmail(value)),
  })
)

const verifyOtpSchema = vine.compile(
  vine.object({
    idx: vine.string().trim(),
    code: vine.string().trim(),
  })
)

const forgotPasswordSchema = vine.compile(
  vine.object({
    email: vine
      .string()
      .trim()
      .transform((value) => normalizeEmail(value)),
    newPassword: vine.string().trim(),
    idx: vine.string().trim(),
    code: vine.string().trim(),
  })
)

const messagesProvider = new SimpleMessagesProvider(DEFAULT_MESSAGE_PROVIDER_CONFIG, {
  password: 'mot de passe',
  newPassword: 'nouveau mot de passe',
})

export default class AuthController {
  private readonly passwordResetService = new PasswordResetService()

  public async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginSchema, { messagesProvider })

    const user = await User.verifyCredentials(email, password)
    const permissions = await user.related('permissions').query()
    const token = await User.accessTokens.create(user)

    return response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        clubId: user.clubId,
        defaultPage: user.defaultPage,
        permissions: permissions.map((p) => p.name),
      },
    })
  }

  public async user({ auth, response }: HttpContext) {
    const user = auth.user
    if (!user) {
      return response.unauthorized({ message: 'Non authentifié' })
    }

    const permissions = await user.related('permissions').query()

    return response.json({
      user: {
        id: user.id,
        email: user.email,
        clubId: user.clubId,
        defaultPage: user.defaultPage,
        permissions: permissions.map((p) => p.name),
      },
    })
  }

  public async logout({ auth }: HttpContext) {
    const user = auth.user
    if (!user) return { message: 'Au revoir !' }

    const currentToken = auth.user.currentAccessToken
    await User.accessTokens.delete(user, currentToken.identifier)

    return { message: 'Au revoir !' }
  }

  public async sendForgotPasswordOtp({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(sendForgotPasswordOtpSchema, {
      messagesProvider,
    })

    const result = await this.passwordResetService.sendUserOtp(email)
    return response.json(result)
  }

  public async verifyForgotPasswordOtp({ request, response }: HttpContext) {
    const { idx, code } = await request.validateUsing(verifyForgotPasswordOtpSchema, {
      messagesProvider,
    })

    try {
      await this.passwordResetService.verifyUserOtp(idx, code)
      return response.json({ success: true, message: 'OTP verified' })
    } catch (error) {
      return this.handlePasswordResetError(response, error)
    }
  }

  public async resetPassword({ request, response }: HttpContext) {
    const payload = await request.validateUsing(resetPasswordSchema, { messagesProvider })

    try {
      await this.passwordResetService.resetUserPassword(payload)
      return response.json({ message: 'Password has been reset.' })
    } catch (error) {
      return this.handlePasswordResetError(response, error)
    }
  }

  private handlePasswordResetError(response: HttpContext['response'], error: unknown) {
    if (!(error instanceof PasswordResetError)) {
      throw error
    }

    if (error.code === 'OTP_NOT_FOUND' || error.code === 'USER_NOT_FOUND') {
      return response.notFound({ message: error.message })
    }

    return response.badRequest({ message: error.message })
  }

  public async mobileLogin({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginSchema, { messagesProvider })

    const athlete = await Athlete.findBy('email', email)
    if (!athlete) {
      return response.notFound({ message: 'Athlete not found' })
    }

    const storedPassword = athlete.password ?? ''
    let isVerified: boolean

    if (storedPassword.startsWith('pbkdf2_sha256')) {
      isVerified = verifyDjangoPassword(password, storedPassword)
      if (isVerified) {
        athlete.password = await hash.make(password)
        await athlete.save()
      }
    } else {
      isVerified = await hash.verify(storedPassword, password)
    }

    if (!isVerified) {
      return response.unauthorized({ message: 'Invalid credentials' })
    }

    const { accessToken, refreshToken } = await AthleteTokenService.generateTokens(athlete)

    return response.json({
      accessToken,
      refreshToken,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      email: athlete.email,
    })
  }

  public async mobileRefreshToken({ request, response }: HttpContext) {
    const { refreshToken: incomingRefreshToken } = await request.validateUsing(refreshTokenSchema, {
      messagesProvider,
    })

    try {
      const { accessToken, refreshToken } =
        await AthleteTokenService.refreshTokens(incomingRefreshToken)
      return response.json({
        accessToken,
        refreshToken,
      })
    } catch (err) {
      if (err instanceof TokenError) {
        return response.unauthorized({ message: err.message })
      }
      throw err
    }
  }

  public async mobileLogout({ response, athleteToken }: HttpContext) {
    if (!athleteToken) {
      return response.unauthorized({ message: 'No token provided' })
    }

    try {
      await AthleteTokenService.revokeAccessToken(athleteToken)
      return response.json({ message: 'Logged out successfully' })
    } catch (err) {
      if (err instanceof TokenError) {
        return response.unauthorized({ message: err.message })
      }
      throw err
    }
  }

  public async mobileAthleteExists({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(athleteExistsSchema)

    const athlete = await Athlete.query().select('id').where('email', email).first()

    return response.json({ result: !!athlete })
  }

  public async mobileSendOtp({ request, response }: HttpContext) {
    const { email } = await request.validateUsing(sendOtpSchema)

    const otp = Array.from({ length: 4 }, () => String(randomInt(1, 10))).join('')
    const index = randomUUID()
    const expiresAt = DateTime.now().plus({ minutes: 1 })

    await OtpCode.create({
      index,
      code: otp,
      expiresAt,
    })

    const brevoService = new BrevoService()
    await brevoService.sendEmail(email, 'FORGOT_PASSWORD', {
      code: otp,
    })

    return response.json({ idx: index })
  }

  public async mobileVerifyOtp({ request, response }: HttpContext) {
    const { idx, code } = await request.validateUsing(verifyOtpSchema)

    const registerOtp = await OtpCode.query().where('index', idx).first()
    if (!registerOtp) {
      return response.notFound({ message: 'OTP code request not found' })
    }

    if (DateTime.now() > registerOtp.expiresAt) {
      return response.badRequest({ message: 'OTP code has expired' })
    }

    if (code === registerOtp.code) {
      return response.json({ success: 1, message: 'OTP verified' })
    }

    return response.badRequest({ message: 'Invalid OTP code' })
  }

  public async mobileForgotPassword({ request, response }: HttpContext) {
    const { email, newPassword, idx, code } = await request.validateUsing(forgotPasswordSchema)

    const registerOtp = await OtpCode.query().where('index', idx).first()
    if (!registerOtp) {
      return response.notFound({ message: 'OTP code request not found' })
    }

    if (DateTime.now() > registerOtp.expiresAt) {
      return response.badRequest({ message: 'OTP code has expired' })
    }

    if (code !== registerOtp.code) {
      return response.badRequest({ message: 'Invalid OTP code' })
    }

    const athlete = await Athlete.findBy('email', email)
    if (!athlete) {
      return response.notFound({ message: 'Athlete does not exist.' })
    }

    athlete.password = await hash.make(newPassword)
    await athlete.save()
    await registerOtp.delete()

    return response.json({ message: 'Password has been reset.' })
  }
}
