import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Health from '#models_pg/health_rating'
import PainDiscomfortLocation from '#models_pg/pain_discomfort_location'

export default class HealthPain extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare rating: number

  @column()
  declare healthId: string | null

  @column()
  declare locationId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Health, { foreignKey: 'healthId' })
  declare health: BelongsTo<typeof Health>

  @belongsTo(() => PainDiscomfortLocation, { foreignKey: 'locationId' })
  declare location: BelongsTo<typeof PainDiscomfortLocation>
}
