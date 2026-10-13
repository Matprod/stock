import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Health from '#models/health'
import DiscomfortLocation from '#models/discomfort_location'

export default class HealthPain extends BaseModel {
  public static table = 'health_painhealth'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare rating: number

  @column()
  declare healthId: number | null

  @column()
  declare locationId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  @belongsTo(() => Health)
  declare health: BelongsTo<typeof Health>

  @belongsTo(() => DiscomfortLocation, {
    foreignKey: 'locationId'
  })
  declare location: BelongsTo<typeof DiscomfortLocation>
}