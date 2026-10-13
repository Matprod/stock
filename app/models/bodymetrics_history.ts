import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Athlete from '#models/athlete'
import Day from '#models/day'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class BodymetricsHistory extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare weight: number | null

  @column()
  declare fatPercentage: number | null

  // Relations
  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>

  @column()
  declare athleteId: number

  @column()
  declare dayId: number

  @belongsTo(() => Day)
  declare day: BelongsTo<typeof Day>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}