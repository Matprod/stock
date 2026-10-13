import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

const consumeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  return Number(value)
}

export default class LlmAliment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column({ consume: consumeNumber })
  declare energyKcal: number | null

  @column({ consume: consumeNumber })
  declare waterG: number | null

  @column({ consume: consumeNumber })
  declare proteinsG: number | null

  @column({ consume: consumeNumber })
  declare carbohydrateG: number | null

  @column({ consume: consumeNumber })
  declare fatG: number | null

  @column({ consume: consumeNumber })
  declare sugarsG: number | null

  @column({ consume: consumeNumber })
  declare fibresG: number | null

  @column({ consume: consumeNumber })
  declare starchG: number | null

  @column({ consume: consumeNumber })
  declare glutenG: number | null

  @column({ consume: consumeNumber })
  declare alcoholG: number | null

  @column({ columnName: 'fa_saturated_g', consume: consumeNumber })
  declare faSaturatedG: number | null

  @column({ columnName: 'fa_mono_g', consume: consumeNumber })
  declare faMonoG: number | null

  @column({ columnName: 'fa_poly_g', consume: consumeNumber })
  declare faPolyG: number | null

  @column({ columnName: 'fa_181_g', consume: consumeNumber })
  declare fa181G: number | null

  @column({ columnName: 'fa_182_g', consume: consumeNumber })
  declare fa182G: number | null

  @column({ consume: consumeNumber })
  declare cholesterolMg: number | null

  @column({ consume: consumeNumber })
  declare saltG: number | null

  @column({ consume: consumeNumber })
  declare calciumMg: number | null

  @column({ consume: consumeNumber })
  declare chlorideMg: number | null

  @column({ consume: consumeNumber })
  declare copperMg: number | null

  @column({ consume: consumeNumber })
  declare ironMg: number | null

  @column({ consume: consumeNumber })
  declare iodineMicrog: number | null

  @column({ consume: consumeNumber })
  declare magnesiumMg: number | null

  @column({ consume: consumeNumber })
  declare manganeseMg: number | null

  @column({ consume: consumeNumber })
  declare phosphorusMg: number | null

  @column({ consume: consumeNumber })
  declare potassiumMg: number | null

  @column({ consume: consumeNumber })
  declare seleniumMicrog: number | null

  @column({ consume: consumeNumber })
  declare sodiumMg: number | null

  @column({ consume: consumeNumber })
  declare zincMg: number | null

  @column({ columnName: 'vitamin_d_microg', consume: consumeNumber })
  declare vitaminDMicrog: number | null

  @column({ columnName: 'vitamin_e_mg', consume: consumeNumber })
  declare vitaminEMg: number | null

  @column({ columnName: 'vitamin_c_mg', consume: consumeNumber })
  declare vitaminCMg: number | null

  @column({ columnName: 'vitamin_b1_mg', consume: consumeNumber })
  declare vitaminB1Mg: number | null

  @column({ columnName: 'vitamin_b2_mg', consume: consumeNumber })
  declare vitaminB2Mg: number | null

  @column({ columnName: 'vitamin_b3_mg', consume: consumeNumber })
  declare vitaminB3Mg: number | null

  @column({ columnName: 'vitamin_b5_mg', consume: consumeNumber })
  declare vitaminB5Mg: number | null

  @column({ columnName: 'vitamin_b6_mg', consume: consumeNumber })
  declare vitaminB6Mg: number | null

  @column({ columnName: 'vitamin_b9_microg', consume: consumeNumber })
  declare vitaminB9Microg: number | null

  @column({ columnName: 'vitamin_b12_microg', consume: consumeNumber })
  declare vitaminB12Microg: number | null

  @column({ consume: consumeNumber })
  declare fructoseG: number | null

  @column({ consume: consumeNumber })
  declare glucoseG: number | null

  @column({ consume: consumeNumber })
  declare lactoseG: number | null

  @column({ consume: consumeNumber })
  declare maltoseG: number | null

  @column({ consume: consumeNumber })
  declare sucroseG: number | null

  @column({ consume: consumeNumber })
  declare portion: number | null

  @column()
  declare portionUnit: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
