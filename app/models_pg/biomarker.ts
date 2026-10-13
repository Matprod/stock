import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import BiomarkerType from '#models_pg/biomarker_type'

export default class Biomarker extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare value: string

  @column.dateTime()
  declare measuredAt: DateTime

  @column()
  declare athleteId: string

  @column()
  declare biomarkerTypeId: string

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @belongsTo(() => BiomarkerType)
  declare biomarkerType: BelongsTo<typeof BiomarkerType>
}
