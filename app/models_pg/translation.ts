import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { TranslatableType, TranslationKey } from '#constants/translation.constants'
import type { AppLanguage } from '#utils/localize'

export default class Translation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare language: AppLanguage

  @column()
  declare translatableType: TranslatableType

  @column()
  declare translatableId: string

  @column()
  declare key: TranslationKey

  @column()
  declare value: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
