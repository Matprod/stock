import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'

export default class ClubApiKey extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare clubId: string

  @column()
  declare name: string

  @column()
  declare keyPrefix: string

  @column({ serializeAs: null })
  declare keyHash: string

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime()
  declare revokedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
