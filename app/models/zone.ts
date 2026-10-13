import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Zone extends BaseModel {
  public static table = 'base_zone'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare side: string | null

  @column()
  declare name: string | null
} 