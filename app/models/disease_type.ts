import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Club from '#models/club'
import Disease from '#models/disease'
import { DateTime } from 'luxon'

export default class DiseaseType extends BaseModel {
  public static table = 'disease_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare clubId: number | null

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @hasMany(() => Disease, {
    foreignKey: 'typeOfDiseaseId',
  })
  declare diseases: HasMany<typeof Disease>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
