import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'

export default class TypeOfSymptom extends BaseModel {
  public static table = 'base_typeofsymptom'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string | null

  @column()
  declare definitionFr: string | null

  @column()
  declare nameEn: string | null

  @column()
  declare definitionEn: string | null

  @column()
  declare addedById: number | null

  @belongsTo(() => Athlete, {
    foreignKey: 'added_by_id',
  })
  declare addedBy: BelongsTo<typeof Athlete>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
} 