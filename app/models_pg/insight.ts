import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import FeatureImportance from '#models_pg/feature_importance'
import Club from '#models_pg/club'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { InsightTresholdType } from '#constants/insight.constants'

export default class Insight extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare variableName: string

  @column()
  declare name: string

  @column()
  declare description: string

  @column()
  declare tresholdLow: number | null

  @column()
  declare tresholdTooLow: number | null

  @column()
  declare tresholdHigh: number | null

  @column()
  declare tresholdTooHigh: number | null

  @column()
  declare tresholdType: InsightTresholdType

  @column()
  declare maximum: number | null

  @column()
  declare canTooHigh: boolean

  @column()
  declare canTooLow: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @hasMany(() => FeatureImportance)
  declare featureImportances: HasMany<typeof FeatureImportance>

  @manyToMany(() => Club, {
    pivotTable: 'club_insights',
  })
  declare clubs: ManyToMany<typeof Club>
}
