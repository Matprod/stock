import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Athlete from '#models_pg/athlete'
import NutritionFavoriteFood from '#models_pg/favorite_aliments'

export default class Aliment extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare alimCode: number | null

  @column()
  declare name: string | null

  @column()
  declare portion: number | null

  @column()
  declare portionUnit: string | null

  @column()
  declare referenceDatabase: string | null

  @column()
  declare modificated: string | null

  // Basic nutrients
  @column()
  declare energyKcal: number | null

  @column()
  declare waterG: number | null

  @column()
  declare proteinsG: number | null

  @column()
  declare carbohydrateG: number | null

  @column()
  declare fatG: number | null

  @column()
  declare glutenG: number | null

  // Sugars
  @column()
  declare sugarsG: number | null

  @column()
  declare fructoseG: number | null

  @column()
  declare galactoseG: number | null

  @column()
  declare glucoseG: number | null

  @column()
  declare lactoseG: number | null

  @column()
  declare maltoseG: number | null

  @column()
  declare sucroseG: number | null

  @column()
  declare starchG: number | null

  @column()
  declare fibresG: number | null

  @column()
  declare alcoholG: number | null

  // Fatty acids
  @column({ columnName: 'FA_saturated_g' })
  declare faSaturatedG: number | null

  @column({ columnName: 'FA_mono_g' })
  declare faMonoG: number | null

  @column({ columnName: 'FA_poly_g' })
  declare faPolyG: number | null

  @column({ columnName: 'FA_181_g' })
  declare fa181G: number | null

  @column({ columnName: 'FA_182_g' })
  declare fa182G: number | null

  // Minerals
  @column()
  declare cholesterolMg: number | null

  @column()
  declare saltG: number | null

  @column()
  declare calciumMg: number | null

  @column()
  declare chlorideMg: number | null

  @column()
  declare copperMg: number | null

  @column()
  declare ironMg: number | null

  @column()
  declare iodineMicrog: number | null

  @column()
  declare magnesiumMg: number | null

  @column()
  declare manganeseMg: number | null

  @column()
  declare phosphorusMg: number | null

  @column()
  declare potassiumMg: number | null

  @column()
  declare seleniumMicrog: number | null

  @column()
  declare sodiumMg: number | null

  @column()
  declare zincMg: number | null

  // Vitamins
  @column({ columnName: 'vitamin_D_microg' })
  declare vitaminDMicrog: number | null

  @column({ columnName: 'vitamin_E_mg' })
  declare vitaminEMg: number | null

  @column({ columnName: 'vitamin_C_mg' })
  declare vitaminCMg: number | null

  @column({ columnName: 'vitamin_B1_mg' })
  declare vitaminB1Mg: number | null

  @column({ columnName: 'vitamin_B2_mg' })
  declare vitaminB2Mg: number | null

  @column({ columnName: 'vitamin_B3_mg' })
  declare vitaminB3Mg: number | null

  @column({ columnName: 'vitamin_B5_mg' })
  declare vitaminB5Mg: number | null

  @column({ columnName: 'vitamin_B6_mg' })
  declare vitaminB6Mg: number | null

  @column({ columnName: 'vitamin_B9_microg' })
  declare vitaminB9Microg: number | null

  @column({ columnName: 'vitamin_B12_microg' })
  declare vitaminB12Microg: number | null

  // Additional fields
  @column()
  declare barcode: string | null

  @column()
  declare position: number | null

  @column()
  declare popularityScore: number | null

  // Relations
  @column({ columnName: 'athlete_id' })
  declare addedById: string | null

  @belongsTo(() => Athlete, { foreignKey: 'addedById' })
  declare addedBy: BelongsTo<typeof Athlete>

  @hasMany(() => NutritionFavoriteFood, { foreignKey: 'alimentId' })
  declare nutritionFavorites: HasMany<typeof NutritionFavoriteFood>
}
