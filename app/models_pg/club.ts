import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from '#models_pg/user'
import Athlete from '#models_pg/athlete'
import Sport from '#models_pg/sport'
import Season from '#models_pg/season'
import Insight from '#models_pg/insight'
import WorkoutSession from '#models_pg/workout_session'
import ReinforcementExercise from '#models_pg/reinforcement_exercise'
import Activity from '#models_pg/activity'
import EventType from '#models_pg/event_type'
import BiomarkerType from '#models_pg/biomarker_type'
import Prompt from '#models_pg/prompt'
import BasketballGame from '#models_pg/basketball_game'
import type { AppLanguage } from '#utils/localize'
import SubjectiveFieldConfig from '#models_pg/subjective_field_config'

export default class Club extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare sportId: string

  @column.date()
  declare startDate: DateTime | null

  @column.date()
  declare endDate: DateTime | null

  @column()
  declare language: AppLanguage

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

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

  @hasMany(() => ReinforcementExercise)
  declare exercices: HasMany<typeof ReinforcementExercise>

  @manyToMany(() => Activity, {
    pivotTable: 'blacklist_activities',
  })
  declare blackListActivities: ManyToMany<typeof Activity>

  @manyToMany(() => EventType, {
    pivotTable: 'event_type_clubs',
  })
  declare eventTypes: ManyToMany<typeof EventType>

  @manyToMany(() => BiomarkerType, {
    pivotTable: 'biomarker_type_clubs',
  })
  declare biomarkerTypes: ManyToMany<typeof BiomarkerType>

  @hasMany(() => Prompt)
  declare prompts: HasMany<typeof Prompt>

  @hasMany(() => BasketballGame)
  declare basketballGames: HasMany<typeof BasketballGame>

  @hasMany(() => SubjectiveFieldConfig)
  declare subjectiveFieldConfigs: HasMany<typeof SubjectiveFieldConfig>
}
