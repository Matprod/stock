import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Club from './club.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Prompt extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare content: string

  @column()
  declare clubId: number | null

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
