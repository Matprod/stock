import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { FileType } from '#constants/file.constants'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'

export default class File extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare type: FileType

  @column()
  declare key: string

  @column()
  declare fileName: string

  @column()
  declare athleteId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Athlete)
  declare athlete: BelongsTo<typeof Athlete>
}
