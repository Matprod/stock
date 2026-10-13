import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Aliment from '#models/aliment'
import SportActivity from '#models/sport_activity'
import Nutrition from '#models/nutrition'

export default class FoodIntake extends BaseModel {
  public static table = 'sportactivity_foodintake'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare quantity: number

  @column()
  declare portion: number | null

  @column()
  declare foodId: number | null

  @belongsTo(() => Aliment, {
    foreignKey: 'foodId',
  })
  declare food: BelongsTo<typeof Aliment>

  @column()
  declare nutritionId: number | null

  @belongsTo(() => Nutrition, {
    foreignKey: 'nutritionId',
  })
  declare nutrition: BelongsTo<typeof Nutrition>

  @column()
  declare sportActivityId: number

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime
}
