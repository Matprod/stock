import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import AlimentGroup from '#models/aliment_group'

export default class AlimentSubgroup extends BaseModel {
  public static table = 'nutrition_alimentsubgroup'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare alimSsgrpCode: number

  @column()
  declare alimSsgrpNomEng: string | null

  @column()
  declare alimSsgrpNomFr: string | null

  // Relations
  @column()
  declare groupId: number | null

  @belongsTo(() => AlimentGroup)
  declare group: BelongsTo<typeof AlimentGroup>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}