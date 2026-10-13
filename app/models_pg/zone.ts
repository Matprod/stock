import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Zone extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare side: 'front' | 'back'

  @column()
  declare name: string | null
}
