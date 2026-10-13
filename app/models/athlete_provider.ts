import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { AthleteProviderType } from '#constants/athlete_provider.constants'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from './athlete.js'

export default class AthleteProvider extends BaseModel {
  public static table = 'athlete_providers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare provider: AthleteProviderType

  @column()
  declare providerAthleteId: string | null

  @column()
  declare athleteId: number

  @column()
  declare accessToken: string | null

  @column()
  declare accessTokenSecret: string | null

  @column()
  declare refreshToken: string | null

  @column.dateTime()
  declare tokenExpiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
