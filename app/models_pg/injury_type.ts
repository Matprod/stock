import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import InjurySection from '#models_pg/injury_section'
import Club from '#models_pg/club'

export default class InjuryType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  // RELATIONS

  @column()
  declare categoryId: string

  @belongsTo(() => InjurySection, {
    foreignKey: 'categoryId',
  })
  declare section: BelongsTo<typeof InjurySection>

  @column()
  declare clubId: string | null

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
