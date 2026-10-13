import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'

export default class AthleteToken extends BaseModel {
  public static table = 'base_token'

  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null, columnName: 'access_token' })
  declare accessToken: string

  @column.dateTime({ columnName: 'access_expiration_date' })
  declare accessExpirationDate: DateTime

  @column({ serializeAs: null, columnName: 'refresh_token' })
  declare refreshToken: string

  @column.dateTime({ columnName: 'refresh_expiration_date' })
  declare refreshExpirationDate: DateTime

  @column({ columnName: 'athlete_id' })
  declare athleteId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
