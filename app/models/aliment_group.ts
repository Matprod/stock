import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AlimentGroup extends BaseModel {
  public static table = 'nutrition_alimentgroup'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare alimGrpCode: number

  @column()
  declare alimGrpNomEng: string | null

  @column()
  declare alimGrpNomFr: string | null
}