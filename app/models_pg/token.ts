import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import { DateTime } from 'luxon'

export default class Token extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare accessToken: string

  @column()
  declare accessExpirationDate: DateTime

  @column()
  declare refreshToken: string

  @column()
  declare refreshExpirationDate: DateTime

  @column()
  declare athleteId: string

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
