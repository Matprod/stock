import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Activity from '#models_pg/activity'
import Club from '#models_pg/club'
import Event from '#models_pg/event'
import type { EventCategory, EventIcon } from '#constants/event.constants'
import type { Color } from '#constants/color.constants'
import { TravelType } from '#contracts/travel'

export default class EventType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare color: Color

  @column()
  declare icon: EventIcon

  @column()
  declare eventCategory: EventCategory

  @column()
  declare activityId: string | null

  @column()
  declare travelType: TravelType | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Activity)
  declare activity: BelongsTo<typeof Activity>

  @hasMany(() => Event)
  declare events: HasMany<typeof Event>

  @manyToMany(() => Club, {
    pivotTable: 'event_type_clubs',
  })
  declare clubs: ManyToMany<typeof Club>
}
