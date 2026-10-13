import { BaseModel, column, belongsTo, hasMany, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Athlete from '#models/athlete'
import AlimentSubgroup from '#models/aliment_subgroup'
import NutritionFavorite from '#models/nutrition_favorite'

export default class Aliment extends BaseModel {
  public static table = 'nutrition_aliment'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'alim_code' })
  declare alimCode: number | null

  @computed()
  get nameEn(): string | null {
    return this.alimNomEng
  }

  @computed()
  get nameFr(): string | null {
    return this.alimNomFr
  }

  @column({ columnName: 'alim_nom_fr' })
  declare alimNomFr: string | null

  @column({ columnName: 'alim_nom_eng' })
  declare alimNomEng: string | null

  @column({ columnName: 'portion' })
  declare portion: number | null

  @column({ columnName: 'portion_unit' })
  declare portionUnit: string | null

  @column({ columnName: 'reference_database' })
  declare referenceDatabase: string | null

  @column({ columnName: 'modificated' })
  declare modificated: string | null

  // Basic nutrients
  @column({ columnName: 'energy_kcal' })
  declare energyKcal: number | null

  @column({ columnName: 'water_g' })
  declare waterG: number | null

  @column({ columnName: 'proteins_g' })
  declare proteinsG: number | null

  @column({ columnName: 'carbohydrate_g' })
  declare carbohydrateG: number | null

  @column({ columnName: 'fat_g' })
  declare fatG: number | null

  @column({ columnName: 'gluten_g' })
  declare glutenG: number | null

  // Sugars
  @column({ columnName: 'sugars_g' })
  declare sugarsG: number | null

  @column({ columnName: 'fructose_g' })
  declare fructoseG: number | null

  @column({ columnName: 'galactose_g' })
  declare galactoseG: number | null

  @column({ columnName: 'glucose_g' })
  declare glucoseG: number | null

  @column({ columnName: 'lactose_g' })
  declare lactoseG: number | null

  @column({ columnName: 'maltose_g' })
  declare maltoseG: number | null

  @column({ columnName: 'sucrose_g' })
  declare sucroseG: number | null

  @column({ columnName: 'starch_g' })
  declare starchG: number | null

  @column({ columnName: 'fibres_g' })
  declare fibresG: number | null

  @column({ columnName: 'alcohol_g' })
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
  @column({ columnName: 'cholesterol_mg' })
  declare cholesterolMg: number | null

  @column({ columnName: 'salt_g' })
  declare saltG: number | null

  @column({ columnName: 'calcium_mg' })
  declare calciumMg: number | null

  @column({ columnName: 'chloride_mg' })
  declare chlorideMg: number | null

  @column({ columnName: 'copper_mg' })
  declare copperMg: number | null

  @column({ columnName: 'iron_mg' })
  declare ironMg: number | null

  @column({ columnName: 'iodine_microg' })
  declare iodineMicrog: number | null

  @column({ columnName: 'magnesium_mg' })
  declare magnesiumMg: number | null

  @column({ columnName: 'manganese_mg' })
  declare manganeseMg: number | null

  @column({ columnName: 'phosphorus_mg' })
  declare phosphorusMg: number | null

  @column({ columnName: 'potassium_mg' })
  declare potassiumMg: number | null

  @column({ columnName: 'selenium_microg' })
  declare seleniumMicrog: number | null

  @column({ columnName: 'sodium_mg' })
  declare sodiumMg: number | null

  @column({ columnName: 'zinc_mg' })
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

  @column({ columnName: 'vitamin_b12_microg' })
  declare vitaminB12Microg: number | null

  // Additional fields
  @column({ columnName: 'barcode' })
  declare barcode: string | null

  @column({ columnName: 'position' })
  declare position: number | null

  @column({ columnName: 'popularity_score' })
  declare popularityScore: number | null

  // Relations
  @column({ columnName: 'subgroup_id' })
  declare subgroupId: number | null

  @belongsTo(() => AlimentSubgroup)
  declare subgroup: BelongsTo<typeof AlimentSubgroup>

  @column({ columnName: 'added_by_id' })
  declare addedById: number | null

  @belongsTo(() => Athlete)
  declare addedBy: BelongsTo<typeof Athlete>

  @hasMany(() => NutritionFavorite, { foreignKey: 'foodId' })
  declare nutritionFavorites: HasMany<typeof NutritionFavorite>
}
