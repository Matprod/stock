import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Day from '#models/day'

export default class HealthExtra extends BaseModel {
  public static table = 'health_extra'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare numberOfCigarettes: number | null

  @column()
  declare pma: number | null

  @column()
  declare vma: number | null

  @column({ columnName: 'vo2_max' })
  declare vo2Max: number | null

  @column()
  declare weight: string | null

  @column.dateTime()
  declare dateAdded: DateTime | null

  @column()
  declare criticalPowerWatts: number | null

  @column()
  declare criticalSpeedKmPerH: number | null

  @column()
  declare fcMax: number | null

  @column()
  declare fcMin: number | null

  @column.dateTime()
  declare dateUpdated: DateTime

  // Relations
  @column()
  declare athleteDayId: number

  @belongsTo(() => Day, { foreignKey: 'athleteDayId' })
  declare day: BelongsTo<typeof Day>
}
