import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import DiscomfortLocation from '#models/discomfort_location'
import SportActivity from '#models/sport_activity'

export default class SportActivityPain extends BaseModel {
  public static table = 'sportactivity_painsportactivity'
  
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare rating: number

  @column()
  declare locationId: number | null

  @column()
  declare sportActivityId: number | null

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare dateUpdated: DateTime

  @belongsTo(() => DiscomfortLocation, {
    foreignKey: 'locationId'
  })
  declare location: BelongsTo<typeof DiscomfortLocation>

  @belongsTo(() => SportActivity, {
    foreignKey: 'sportActivityId'
  })
  declare sportActivity: BelongsTo<typeof SportActivity>
}