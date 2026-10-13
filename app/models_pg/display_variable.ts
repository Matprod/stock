import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ActivityDisplayVariable from '#models_pg/activity_display_variable'
import type { DisplayVariableUnit } from '#constants/display_variable.constants'

export default class DisplayVariable extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare unit: DisplayVariableUnit | null

  @computed()
  public get label(): string {
    return String(this.$extras.label ?? this.name)
  }

  @hasMany(() => ActivityDisplayVariable)
  declare activityDisplayVariables: HasMany<typeof ActivityDisplayVariable>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
