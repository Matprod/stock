import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Period from '#models/period'
import type { DataType, SerieType } from '#constants/serie.constants'

export default class Serie extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: SerieType

  @column()
  declare dataEncoded: string

  @column()
  declare samplesPerMinute: number

  @column()
  declare dataType: DataType

  @column()
  declare bits: 8 | 16 | 32 | 64

  @column()
  declare periodId: number

  @belongsTo(() => Period, {
    foreignKey: 'periodId',
    localKey: 'id',
  })
  declare period: BelongsTo<typeof Period>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
