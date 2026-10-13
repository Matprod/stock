import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Athlete from '#models/athlete'
import Sport from '#models/sport'
import Season from '#models/season'
import Insight from '#models/insight'
import WorkoutSession from '#models/workout_session'
import Exercice from '#models/exercice'
import Activity from '#models/activity'
import EventType from '#models/event_type'
import Prompt from './prompt.js'
import ClubProvider from '#models/club_provider'

export default class Club extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare sportId: number

  @column()
  declare myCoachClubId: string | null

  @column.date()
  declare startDate: DateTime | null

  @column.date()
  declare endDate: DateTime | null

  @column()
  declare clubLanguage: 'en' | 'fr' | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @computed()
  get clubLanguageOrDefault(): 'en' | 'fr' {
    return this.clubLanguage || 'en'
  }

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @hasMany(() => User)
  declare users: HasMany<typeof User>

  @hasMany(() => Athlete)
  declare athletes: HasMany<typeof Athlete>

  @hasMany(() => Season)
  declare seasons: HasMany<typeof Season>

  @belongsTo(() => Sport)
  declare sport: BelongsTo<typeof Sport>

  @manyToMany(() => Insight, {
    pivotTable: 'club_insights',
  })
  declare insights: ManyToMany<typeof Insight>

  @hasMany(() => WorkoutSession)
  declare workoutSessions: HasMany<typeof WorkoutSession>

  @hasMany(() => Exercice)
  declare exercices: HasMany<typeof Exercice>

  @manyToMany(() => Activity, {
    pivotTable: 'black_list_activities',
  })
  declare blackListActivities: ManyToMany<typeof Activity>

  @manyToMany(() => EventType, {
    pivotTable: 'event_type_clubs',
  })
  declare eventTypes: ManyToMany<typeof EventType>

  @hasMany(() => Prompt)
  declare prompts: HasMany<typeof Prompt>

  @hasMany(() => ClubProvider)
  declare clubProviders: HasMany<typeof ClubProvider>
}
