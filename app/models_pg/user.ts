import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Club from '#models_pg/club'
import type { UserDefaultPage, UserRole } from '#constants/user.constants'
import Permission from '#models_pg/permission'
import WorkoutExerciseFavorite from '#models_pg/workout_exercise_favorite'
import { normalizeEmail } from '#utils/email'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: string

  @column({
    prepare: (value: string) => normalizeEmail(value),
    consume: (value: string) => normalizeEmail(value),
  })
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare defaultPage: UserDefaultPage | null

  @column()
  declare role: UserRole

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static accessTokens = DbAccessTokensProvider.forModel(User)

  @column()
  declare clubId: string

  // Relations
  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>

  @manyToMany(() => Permission, {
    pivotTable: 'user_permissions',
  })
  declare permissions: ManyToMany<typeof Permission>

  @hasMany(() => WorkoutExerciseFavorite)
  declare workoutExerciseFavorites: HasMany<typeof WorkoutExerciseFavorite>
}
