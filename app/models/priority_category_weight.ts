import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models/club'

export default class PriorityCategoryWeight extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number | null

  @column()
  declare categoryType: 'activity' | 'sleep' | 'nutrition' | 'health'

  @column()
  declare type: 'performance' | 'injury'

  @column()
  declare weight: number

  @belongsTo(() => Club, {
    foreignKey: 'clubId',
  })
  declare club: BelongsTo<typeof Club> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}

