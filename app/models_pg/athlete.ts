import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import Day from '#models_pg/day'
import type { HasMany, BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Injury from '#models_pg/injury'
import Club from '#models_pg/club'
import Discomfort from '#models_pg/pain_discomfort_location'
import AthleteEvent from '#models_pg/athlete_event'
import PlayerPosition from '#models_pg/player_position'
import Recipe from '#models_pg/recipe'
import Aliment from '#models_pg/aliment'
import PlayerNote from '#models_pg/player_note'
import File from '#models_pg/file'
import ExerciseLoad from '#models_pg/exercise_load'
import AthleteProvider from '#models_pg/athlete_provider'
import Disease from '#models_pg/disease'
import Token from '#models_pg/token'
import type { AppLanguage } from '#utils/localize'
import { GENDER, type Gender } from '#constants/athlete.constants'
import { normalizeEmail } from '#utils/email'

export default class Athlete extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column({
    prepare: (value: string) => normalizeEmail(value),
    consume: (value: string) => normalizeEmail(value),
  })
  declare email: string

  @column.date()
  declare birthDate: DateTime

  @column.date()
  declare startDate: DateTime

  @column.date()
  declare endDate: DateTime | null

  @column()
  declare jerseyNumber: number | null

  @column()
  declare heightCm: number | null

  @column()
  declare weightKg: number | null

  @column({ consume: (value) => (value ? parseFloat(value) : null) })
  declare fatPercentage: number | null

  @column()
  declare gender: Gender

  @column()
  declare fcMax: number | null

  @column()
  declare fcMin: number | null

  @column()
  declare fcmDeviceToken: string | null

  @column()
  declare appLanguage: AppLanguage

  @column()
  declare clubId: string

  @column()
  declare playerPositionId: string

  @belongsTo(() => PlayerPosition)
  declare playerPosition: BelongsTo<typeof PlayerPosition>

  @computed()
  get name(): string {
    return `${this.firstName} ${this.lastName}`
  }

  @computed()
  get BMR(): number {
    if (!this.birthDate || !this.weightKg || !this.heightCm || !this.gender) {
      return 0
    }
    const age = this.age
    const weight = this.weightKg || 0
    const height = this.heightCm || 0

    const sexFactor = this.gender === GENDER.MALE ? 1 : -1
    return 11.936 * weight + 5.877 * height - 8.129 * age + 191.027 + 29.279 * sexFactor
  }

  @computed()
  get age(): number {
    if (!this.birthDate) {
      return 0
    }
    return Math.floor(DateTime.now().diff(this.birthDate, 'years').years)
  }

  @computed()
  get effectiveFcMax(): number {
    if (this.fcMax && this.fcMax !== 0) {
      return this.fcMax
    }
    return this.age > 0 ? 220 - this.age : 200
  }

  @computed()
  get appLanguageOrDefault(): AppLanguage {
    return this.appLanguage
  }

  // RELATIONS
  @hasMany(() => Day)
  declare days: HasMany<typeof Day>

  @hasMany(() => Injury)
  declare injuries: HasMany<typeof Injury>

  @hasMany(() => Discomfort)
  declare discomforts: HasMany<typeof Discomfort>

  @hasMany(() => ExerciseLoad)
  declare exerciseLoads: HasMany<typeof ExerciseLoad>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @hasMany(() => Recipe)
  declare recipes: HasMany<typeof Recipe>

  @hasMany(() => Aliment)
  declare aliments: HasMany<typeof Aliment>

  @hasMany(() => PlayerNote)
  declare notes: HasMany<typeof PlayerNote>

  @hasOne(() => File)
  declare profilePicture: HasOne<typeof File>

  @hasMany(() => AthleteProvider)
  declare athleteProviders: HasMany<typeof AthleteProvider>

  @hasMany(() => Token)
  declare athleteTokens: HasMany<typeof Token>

  @hasMany(() => AthleteEvent)
  declare athleteEvents: HasMany<typeof AthleteEvent>

  @hasMany(() => Disease)
  declare diseases: HasMany<typeof Disease>
}
