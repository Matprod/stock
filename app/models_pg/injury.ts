import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { AthleteProviderSource } from '#constants/athlete_provider.constants'
import Athlete from '#models_pg/athlete'
import InjuryType from '#models_pg/injury_type'

export default class Injury extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column.date()
  declare dateOfInjury: DateTime | null

  @column.date()
  declare recoveryDate: DateTime | null

  // RELATIONS

  @column()
  declare context: 'match' | 'training' | 'other' | null

  @column()
  declare contactType: 'no_contact' | 'contact' | 'semi_contact' | null

  @column()
  declare note: string | null

  @column()
  declare typeOfInjuryId: string | null

  @belongsTo(() => InjuryType, {
    foreignKey: 'typeOfInjuryId',
  })
  declare injuryType: BelongsTo<typeof InjuryType>

  @column()
  declare mechanism: string | null

  @column()
  declare tissue: string | null

  @column()
  declare angle: string | null

  @column({ consume: (value) => value?.replace(/\s+/gu, ' ').trim() })
  declare pathology: string | null

  @column()
  declare athleteId: string

  @column()
  declare source: AthleteProviderSource

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
