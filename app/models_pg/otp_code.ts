import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { OtpPurpose } from '#constants/otp.constants'
import { normalizeEmail } from '#utils/email'

export default class OtpCode extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare code: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column()
  declare index: string

  @column({
    prepare: (value: string | null) => (value ? normalizeEmail(value) : value),
    consume: (value: string | null) => (value ? normalizeEmail(value) : value),
  })
  declare email: string | null

  @column()
  declare purpose: OtpPurpose | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
