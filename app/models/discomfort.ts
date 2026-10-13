import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import DiscomfortLocation from '#models/discomfort_location'

export default class Discomfort extends BaseModel {
  public static table = 'base_registerdiscomfort'

  @column({ isPrimary: true })
  declare id: number

  @column.date()
  declare dateOfDiscomfort: DateTime | null

  @column()
  declare levelOfPainToday: number | null

  @column()
  declare during: 'activity' | 'always' | null

  @column.date()
  declare recoveryDate: DateTime | null

  // RELATIONS

  @column()
  declare locationId: number

  @belongsTo(() => DiscomfortLocation, {foreignKey: 'locationId'})
  declare location: BelongsTo<typeof DiscomfortLocation>

  @column()
  declare athleteId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}