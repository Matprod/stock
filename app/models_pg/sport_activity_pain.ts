import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PainDiscomfortLocation from '#models_pg/pain_discomfort_location'
import SportActivity from '#models_pg/sport_activity'

export default class SportActivityPain extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare rating: number

  @column()
  declare locationId: string

  @column()
  declare sportActivityId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => PainDiscomfortLocation, {
    foreignKey: 'locationId',
  })
  declare location: BelongsTo<typeof PainDiscomfortLocation>

  @belongsTo(() => SportActivity)
  declare sportActivity: BelongsTo<typeof SportActivity>
}
