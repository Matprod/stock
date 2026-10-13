import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import Biomarker from '#models_pg/biomarker'

export default class BiomarkerType extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare displayName: string | null

  @column()
  declare unit: string

  @manyToMany(() => Club, {
    pivotTable: 'biomarker_type_clubs',
  })
  declare clubs: ManyToMany<typeof Club>

  @hasMany(() => Biomarker)
  declare biomarkers: HasMany<typeof Biomarker>
}
