import jwt from 'jsonwebtoken'
import { DateTime } from 'luxon'
import env from '#start/env'
import Athlete from '#models_pg/athlete'
import Token from '#models_pg/token'

const ALGORITHM = 'HS256'
const ACCESS_TOKEN_EXPIRATION_DAYS = 10
const REFRESH_TOKEN_EXPIRATION_DAYS = 30

export interface AthleteAccessPayload {
  email: string
  exp: number
  is_superuser: boolean
  athleteid: string
}

export interface AthleteRefreshPayload {
  email: string
  exp: number
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenError'
  }
}

export default class AthleteTokenService {
  static async generateTokens(
    athlete: Athlete
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessExpiration = DateTime.utc().plus({ days: ACCESS_TOKEN_EXPIRATION_DAYS })
    const refreshExpiration = DateTime.utc().plus({ days: REFRESH_TOKEN_EXPIRATION_DAYS })

    const accessPayload: AthleteAccessPayload = {
      email: athlete.email,
      exp: Math.floor(accessExpiration.toSeconds()),
      is_superuser: false,
      athleteid: athlete.id,
    }

    const refreshPayload: AthleteRefreshPayload = {
      email: athlete.email,
      exp: Math.floor(refreshExpiration.toSeconds()),
    }

    const accessSecret = env.get('JWT_ACCESS_SECRET')
    const refreshSecret = env.get('JWT_REFRESH_SECRET')

    const accessToken = jwt.sign(accessPayload, accessSecret, { algorithm: ALGORITHM })
    const refreshToken = jwt.sign(refreshPayload, refreshSecret, { algorithm: ALGORITHM })

    await Token.create({
      athleteId: athlete.id,
      accessToken,
      accessExpirationDate: accessExpiration,
      refreshToken,
      refreshExpirationDate: refreshExpiration,
    })

    return { accessToken, refreshToken }
  }

  static async refreshTokens(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = env.get('JWT_REFRESH_SECRET')
    let decoded: AthleteRefreshPayload
    try {
      decoded = jwt.verify(refreshToken, secret, {
        algorithms: [ALGORITHM],
        complete: false,
      }) as AthleteRefreshPayload
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new TokenError('Refresh token has expired.')
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Invalid refresh token.')
      }
      throw new TokenError('Invalid refresh token.')
    }

    const athlete = await Athlete.findBy('email', decoded.email)
    if (!athlete) {
      throw new TokenError('Athlete does not exist.')
    }

    const storedToken = await Token.query()
      .where('athleteId', athlete.id)
      .orderBy('id', 'desc')
      .first()

    if (!storedToken || storedToken.refreshToken !== refreshToken) {
      throw new TokenError('Invalid refresh token.')
    }

    const accessExpiration = DateTime.utc().plus({ days: ACCESS_TOKEN_EXPIRATION_DAYS })
    const refreshExpiration = DateTime.utc().plus({ days: REFRESH_TOKEN_EXPIRATION_DAYS })

    const accessPayload: AthleteAccessPayload = {
      email: athlete.email,
      exp: Math.floor(accessExpiration.toSeconds()),
      is_superuser: false,
      athleteid: athlete.id,
    }

    const newRefreshPayload: AthleteRefreshPayload = {
      email: athlete.email,
      exp: Math.floor(refreshExpiration.toSeconds()),
    }

    const accessSecret = env.get('JWT_ACCESS_SECRET')
    const refreshSecret = env.get('JWT_REFRESH_SECRET')

    const newAccessToken = jwt.sign(accessPayload, accessSecret, { algorithm: ALGORITHM })
    const newRefreshToken = jwt.sign(newRefreshPayload, refreshSecret, { algorithm: ALGORITHM })

    storedToken.merge({
      accessToken: newAccessToken,
      accessExpirationDate: accessExpiration,
      refreshToken: newRefreshToken,
      refreshExpirationDate: refreshExpiration,
    })
    await storedToken.save()

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  }

  static async verifyAccessToken(token: string | undefined): Promise<AthleteAccessPayload> {
    if (!token) {
      throw new TokenError('No token provided')
    }

    const stored = await Token.query()
      .where('accessToken', token)
      .where('accessExpirationDate', '>', DateTime.utc().toSQL())
      .first()

    if (!stored) {
      throw new TokenError('Token is invalid')
    }

    try {
      const secret = env.get('JWT_ACCESS_SECRET')
      const decoded = jwt.verify(token, secret, {
        algorithms: [ALGORITHM],
        complete: false,
      }) as AthleteAccessPayload

      if (typeof decoded.exp !== 'number') {
        throw new TokenError('Token is invalid')
      }

      return decoded
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new TokenError('Login token has expired. Please login again.')
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new TokenError('Token is invalid')
      }
      throw err instanceof Error ? new TokenError(err.message) : new TokenError('Token is invalid')
    }
  }

  static async revokeAccessToken(token: string): Promise<void> {
    const payload = await this.verifyAccessToken(token)
    const stored = await Token.query()
      .where('accessToken', token)
      .where('athleteId', payload.athleteid)
      .orderBy('id', 'desc')
      .first()
    if (stored) {
      await stored.delete()
    }
  }
}
