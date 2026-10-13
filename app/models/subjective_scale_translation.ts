import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { TranslationLanguage, TranslatableType } from '#constants/translation.constants'

export default class SubjectiveScaleTranslation extends BaseModel {
  public static table = 'translations'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare language: TranslationLanguage

  @column()
  declare translatableType: TranslatableType

  @column()
  declare translatableId: string

  @column()
  declare key: string

  @column()
  declare value: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
