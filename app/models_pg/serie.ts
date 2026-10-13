import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Period from '#models_pg/period'
import type { DataType, SerieType } from '#constants/serie.constants'

export default class Serie extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare type: SerieType

  @column()
  declare dataEncoded: string

  @column()
  declare dataType: DataType

  @column()
  declare periodId: string

  @belongsTo(() => Period)
  declare period: BelongsTo<typeof Period>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
