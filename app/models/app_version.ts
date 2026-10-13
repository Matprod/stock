import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AppVersion extends BaseModel {
  public static table = 'base_appversion'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare version: string
}
