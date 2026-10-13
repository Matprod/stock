import Athlete from '#models_pg/athlete'
import hash from '@adonisjs/core/services/hash'
import { updateAthleteProfileSchema } from '#schemas/mobile/athlete_profile'
import AthleteService from '#services/athlete_service'
import { verifyDjangoPassword } from '../../utils/verifiy_django_password.js'
import { Infer } from '@vinejs/vine/types'

type ServiceError = { message: string; status: number }

export default class AthleteProfileService {
  private athleteService: AthleteService

  constructor() {
    this.athleteService = new AthleteService()
  }

  public async getProfile(athleteId: string) {
    const athlete = await this.athleteService.getAthleteById(athleteId)
    if (!athlete) {
      return null
    }

    await athlete.load('playerPosition')

    const positionName = await this.athleteService.getAthletePositionName(
      athleteId,
      athlete.appLanguageOrDefault
    )
    if (athlete.playerPosition && positionName) {
      athlete.playerPosition.name = positionName
    }

    await athlete.load('injuries')
    await athlete.load('athleteProviders')

    return {
      athlete,
      //TODO refacto:
      isChatbotEnabled: athlete.clubId !== '7',
      app: {
        version: '1.0.0',
      },
    }
  }

  public async updateProfile(athleteId: string, payload: Infer<typeof updateAthleteProfileSchema>) {
    if (Object.keys(payload).length === 0) {
      return
    }
    await Athlete.query().where('id', athleteId).update(payload)
  }

  public async changePassword(
    athleteId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ServiceError | null> {
    const athlete = await Athlete.findOrFail(athleteId)

    if (!(await this.verifyPassword(athlete, currentPassword))) {
      return { message: 'Invalid password', status: 401 }
    }

    if (currentPassword === newPassword) {
      return { message: 'New password must be different from current password', status: 400 }
    }

    athlete.password = await hash.make(newPassword)
    await athlete.save()
    return null
  }

  public async changeEmail(
    athleteId: string,
    email: string,
    password: string
  ): Promise<ServiceError | null> {
    const athlete = await Athlete.findOrFail(athleteId)
    const normalizedEmail = email.trim().toLowerCase()

    if (!(await this.verifyPassword(athlete, password))) {
      return { message: 'Invalid password', status: 401 }
    }

    if (athlete.email.toLowerCase() === normalizedEmail) {
      return { message: 'New email must be different from current email', status: 400 }
    }

    const emailTaken = await Athlete.query()
      .select('id')
      .where('email', normalizedEmail)
      .whereNot('id', athleteId)
      .first()

    if (emailTaken) {
      return { message: 'Email is already in use', status: 409 }
    }

    athlete.email = normalizedEmail
    await athlete.save()
    return null
  }

  private async verifyPassword(athlete: Athlete, password: string) {
    const storedPassword = athlete.password ?? ''

    if (storedPassword.startsWith('pbkdf2_sha256')) {
      const isVerified = verifyDjangoPassword(password, storedPassword)

      if (isVerified) {
        athlete.password = await hash.make(password)
        await athlete.save()
      }

      return isVerified
    }

    return hash.verify(storedPassword, password)
  }
}
