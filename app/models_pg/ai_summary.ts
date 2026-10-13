import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { EntityType } from '#contracts/summary'

export default class AiSummary extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare summary: string

  @column()
  declare entityType: EntityType

  @column()
  declare entityId: string | null

  //RELATIONS
  @column()
  declare dayId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
