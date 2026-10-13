import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { AthleteProviderType } from '#constants/athlete_provider.constants'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'

export default class AthleteProvider extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare provider: AthleteProviderType

  @column()
  declare providerAthleteId: string | null

  @column()
  declare athleteId: string

  @column({ serializeAs: null })
  declare accessToken: string | null

  @column({ serializeAs: null })
  declare accessTokenSecret: string | null

  @column({ serializeAs: null })
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
