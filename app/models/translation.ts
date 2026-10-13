import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { TranslationLanguage, TranslatableType } from '#constants/translation.constants'

export default class Translation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number
  
  @column()
  declare language: TranslationLanguage

  @column()
  declare translatableType: TranslatableType

  @column()
  declare translatableId: number

  @column()
  declare key: string

  @column()
  declare value: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}