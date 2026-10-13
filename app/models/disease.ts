import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { AthleteProviderSource } from '#constants/athlete_provider.constants'
import Athlete from '#models/athlete'

export default class Disease extends BaseModel {
  public static table = 'diseases'

  @column({ isPrimary: true })
  declare id: number

  @column.date()
  declare dateOfDisease: DateTime | null

  @column.date()
  declare recoveryDate: DateTime | null

  @column()
  declare note: string | null

  @column()
  declare source: AthleteProviderSource

  @column()
  declare name: string

  @column()
  declare athleteId: number

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
