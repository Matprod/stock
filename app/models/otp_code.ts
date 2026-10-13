import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class OtpCode extends BaseModel {
  public static table = 'base_register_otp_code'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column.dateTime({ columnName: 'expiry_date' })
  declare expiryDate: DateTime

  @column()
  declare idx: string
}
