import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Nutrition from '#models/nutrition'
import NutritionFavorite from '#models/nutrition_favorite'

const decimalColumn = (columnName: string) => ({
  columnName,
  consume: (value: string | number | null) =>
    value === null || value === undefined ? null : parseFloat(String(value)),
})

export default class ChatGPTNutrition extends BaseModel {
  public static table = 'nutrition_chatgptnutrition'

  @column({ isPrimary: true })
  declare id: number

  @computed()
  get nameEn(): string | null {
    return this.name
  }

  @column()
  declare name: string

  @column()
  declare nameFr: string | null

  @column.dateTime()
  declare dateAdded: DateTime

  @column.dateTime()
  declare dateUpdated: DateTime

  @column(decimalColumn('energy_kcal'))
  declare energyKcal: number | null

  @column(decimalColumn('water_g'))
  declare waterG: number | null

  @column(decimalColumn('proteins_g'))
  declare proteinsG: number | null

  @column(decimalColumn('carbohydrate_g'))
  declare carbohydrateG: number | null

  @column(decimalColumn('fat_g'))
  declare fatG: number | null

  @column(decimalColumn('sugars_g'))
  declare sugarsG: number | null

  @column(decimalColumn('fibres_g'))
  declare fibresG: number | null

  @column(decimalColumn('starch_g'))
  declare starchG: number | null

  @column(decimalColumn('gluten_g'))
  declare glutenG: number | null

  @column(decimalColumn('alcohol_g'))
  declare alcoholG: number | null

  // Fatty acids
  @column(decimalColumn('fa_saturated_g'))
  declare faSaturatedG: number | null

  @column(decimalColumn('fa_mono_g'))
  declare faMonoG: number | null

  @column(decimalColumn('fa_poly_g'))
  declare faPolyG: number | null

  @column(decimalColumn('fa_181_g'))
  declare fa181G: number | null

  @column(decimalColumn('fa_182_g'))
  declare fa182G: number | null

  @column(decimalColumn('cholesterol_mg'))
  declare cholesterolMg: number | null

  @column(decimalColumn('salt_g'))
  declare saltG: number | null

  @column(decimalColumn('calcium_mg'))
  declare calciumMg: number | null

  @column(decimalColumn('chloride_mg'))
  declare chlorideMg: number | null

  @column(decimalColumn('copper_mg'))
  declare copperMg: number | null

  @column(decimalColumn('iron_mg'))
  declare ironMg: number | null

  @column(decimalColumn('iodine_microg'))
  declare iodineMicrog: number | null

  @column(decimalColumn('magnesium_mg'))
  declare magnesiumMg: number | null

  @column(decimalColumn('manganese_mg'))
  declare manganeseMg: number | null

  @column(decimalColumn('phosphorus_mg'))
  declare phosphorusMg: number | null

  @column(decimalColumn('potassium_mg'))
  declare potassiumMg: number | null

  @column(decimalColumn('selenium_microg'))
  declare seleniumMicrog: number | null

  @column(decimalColumn('sodium_mg'))
  declare sodiumMg: number | null

  @column(decimalColumn('zinc_mg'))
  declare zincMg: number | null

  @column(decimalColumn('vitamin_d_microg'))
  declare vitaminDMicrog: number | null

  @column(decimalColumn('vitamin_e_mg'))
  declare vitaminEMg: number | null

  @column(decimalColumn('vitamin_c_mg'))
  declare vitaminCMg: number | null

  @column(decimalColumn('vitamin_b1_mg'))
  declare vitaminB1Mg: number | null

  @column(decimalColumn('vitamin_b2_mg'))
  declare vitaminB2Mg: number | null

  @column(decimalColumn('vitamin_b3_mg'))
  declare vitaminB3Mg: number | null

  @column(decimalColumn('vitamin_b5_mg'))
  declare vitaminB5Mg: number | null

  @column(decimalColumn('vitamin_b6_mg'))
  declare vitaminB6Mg: number | null

  @column(decimalColumn('vitamin_b9_microg'))
  declare vitaminB9Microg: number | null

  @column(decimalColumn('vitamin_b12_microg'))
  declare vitaminB12Microg: number | null

  @column(decimalColumn('fructose_g'))
  declare fructoseG: number | null

  @column(decimalColumn('glucose_g'))
  declare glucoseG: number | null

  @column(decimalColumn('lactose_g'))
  declare lactoseG: number | null

  @column(decimalColumn('maltose_g'))
  declare maltoseG: number | null

  @column(decimalColumn('sucrose_g'))
  declare sucroseG: number | null

  @column(decimalColumn('portion'))
  declare portion: number | null

  @column({ columnName: 'portion_unit' })
  declare portionUnit: string

  @hasMany(() => Nutrition, {
    foreignKey: 'chatgptMealId',
  })
  declare nutritionEntries: HasMany<typeof Nutrition>

  @hasMany(() => NutritionFavorite, { foreignKey: 'chatgptFoodId' })
  declare nutritionFavorites: HasMany<typeof NutritionFavorite>
}
