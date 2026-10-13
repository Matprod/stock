import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Sport from '#models/sport'

export default class PlayerPosition extends BaseModel {
  public static table = 'player_positions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare sportId: number

  @belongsTo(() => Sport)
  declare sport: BelongsTo<typeof Sport>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
} 