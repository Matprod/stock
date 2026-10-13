import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Zone from '#models_pg/zone'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class PainDiscomfortLocation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string | null

  @column()
  declare zoneId: string | null

  @belongsTo(() => Zone)
  declare zone: BelongsTo<typeof Zone>
}
