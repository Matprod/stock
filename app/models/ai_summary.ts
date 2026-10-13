import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AiSummary extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare entityId: number | null

  @column()
  declare entityType: 'activity' | 'nutrition' | 'sleep' | 'health'

  @column()
  declare athleteDayId: number

  @column()
  declare summaryMessage: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
