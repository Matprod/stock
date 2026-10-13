import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import Day from '#models/day'
import type { HasMany, BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import Injury from '#models/injury'
import Club from '#models/club'
import Discomfort from '#models/discomfort'
import AthleteSport from '#models/athlete_sport'
import AthleteEvent from '#models/athlete_event'
import PlayerPosition from '#models/player_position'
import Recipe from '#models/recipe'
import Aliment from '#models/aliment'
import PlayerNote from '#models/player_note'
import File from '#models/file'
import ExerciseLoad from '#models/exercise_load'
import AthleteProvider from '#models/athlete_provider'
import AthleteToken from '#models/athlete_token'
import Disease from '#models/disease'

export default class Athlete extends BaseModel {
  public static table = 'base_athlete'

  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare lastLogin: DateTime | null // TODO: remove this column ?

  @column()
  declare isSuperuser: boolean // TODO: remove this column ?

  @column()
  declare username: string

  @column()
  declare jerseyNumber: number | null

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column()
  declare email: string

  @column()
  declare isStaff: boolean // TODO: remove this column ?

  @column()
  declare isActive: boolean // TODO: remove this column ?

  @column.dateTime()
  declare dateJoined: DateTime

  @column.date()
  declare birthDate: DateTime | null

  @column.date()
  declare startDate: DateTime | null

  @column.date()
  declare endDate: DateTime | null

  @column()
  declare height: number | null

  @column()
  declare weight: number | null

  @column({ consume: (value) => (value ? parseFloat(value) : null) })
  declare fatPercentage: number | null

  @column()
  declare gender: 'Male' | 'Female' | null

  @column()
  declare regularTrainingStartDate: number | null

  @column()
  declare watchType: 'garmin' | 'polar' | 'coros' | 'suunto' | null

  @column()
  declare facebookUserId: string | null

  @column()
  declare googleUserId: string | null

  @column()
  declare appleUserId: string | null

  @column()
  declare provider: 'facebook' | 'google' | 'mauna' | 'apple' | 'password' | null

  @column()
  declare checkpoint: number | null

  @column()
  declare accountDeleted: boolean | null

  @column()
  declare fcMax: number | null

  @column()
  declare fcMin: number | null

  @column()
  declare dataSource: 'strava' | 'wahoo' | null

  @column()
  declare timezoneName: string | null

  @column()
  declare timezoneOffset: string | null

  @column()
  declare firebaseId: string | null // TODO: remove this column ?

  @column()
  declare fcmDeviceToken: string | null

  @column()
  declare appLanguage: 'en' | 'fr' | null

  @column()
  declare fcmDeviceId: number | null

  @column({
    serialize: (value) => (value ? `https://mauna-files.s3.amazonaws.com/${value}` : null),
  })
  declare profileImage: string | null

  @column()
  declare scoreTime: DateTime | null

  @column()
  declare hasChanged: boolean | null // TODO: remove this column ?

  @column()
  declare appleAccessToken: string | null

  @column()
  declare dataSources: string

  @column()
  declare watchTypes: string

  @column()
  declare clubId: number

  @column()
  declare myCoachPlayerId: string | null

  @column()
  declare playerPositionId: number | null

  @column()
  declare valdProfileId: string | null

  @column.dateTime()
  declare valdLastSyncedAt: DateTime | null

  @column()
  declare firstbeatId: string | null

  @column()
  declare catapultId: string | null

  @belongsTo(() => PlayerPosition)
  declare playerPosition: BelongsTo<typeof PlayerPosition>

  @computed()
  get name(): string {
    return `${this.firstName} ${this.lastName}`
  }

  @computed()
  get BMR(): number {
    if (!this.birthDate || !this.weight || !this.height || !this.gender) {
      return 0
    }
    const age = this.age
    const weight = this.weight || 0
    const height = this.height || 0

    if (this.gender === 'Male') {
      return 11.9 * weight + 5.9 * height - 8.1 * age + 220
    } else {
      return 11.9 * weight + 5.9 * height - 8.1 * age
    }
  }

  @computed()
  get age(): number {
    if (!this.birthDate) {
      return 0
    }
    return Math.floor(
      DateTime.now().diff(DateTime.fromJSDate(this.birthDate.toJSDate()), 'years').years
    )
  }

  @computed()
  get appLanguageOrDefault(): 'en' | 'fr' {
    return this.appLanguage || 'en'
  }

  // RELATIONS
  @hasMany(() => Day)
  declare days: HasMany<typeof Day>

  @hasMany(() => Injury)
  declare injuries: HasMany<typeof Injury>

  @hasMany(() => Discomfort)
  declare discomforts: HasMany<typeof Discomfort>

  @hasMany(() => AthleteSport)
  declare athleteSports: HasMany<typeof AthleteSport>

  @hasMany(() => ExerciseLoad)
  declare exerciseLoads: HasMany<typeof ExerciseLoad>

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @hasMany(() => Recipe)
  declare recipes: HasMany<typeof Recipe>

  @hasMany(() => Aliment)
  declare aliments: HasMany<typeof Aliment>

  @hasMany(() => PlayerNote, { foreignKey: 'athleteId' })
  declare notes: HasMany<typeof PlayerNote>

  @hasOne(() => File, { foreignKey: 'athleteId' })
  declare profilePicture: HasOne<typeof File>

  @hasMany(() => AthleteProvider)
  declare athleteProviders: HasMany<typeof AthleteProvider>

  @hasMany(() => AthleteToken, { foreignKey: 'athleteId' })
  declare athleteTokens: HasMany<typeof AthleteToken>

  @hasMany(() => AthleteEvent, {
    foreignKey: 'athleteId',
  })
  declare athleteEvents: HasMany<typeof AthleteEvent>

  @hasMany(() => Disease)
  declare diseases: HasMany<typeof Disease>
}
