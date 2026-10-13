import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models_pg/aliment'
import SportActivity from '#models_pg/sport_activity'

export default class ActivityFoodIntake extends BaseModel {
  static table = 'sport_activity_intakes'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column()
  declare alimentId: string | null

  @belongsTo(() => Aliment)
  declare aliment: BelongsTo<typeof Aliment>

  @column()
  declare sportActivityId: string

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
