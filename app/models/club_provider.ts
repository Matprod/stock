import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ClubProviderType } from '#constants/club_provider.constants'
import Club from '#models/club'
import { clubProviderSecretColumnOptions } from '#utils/club_provider_encryption'

export default class ClubProvider extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clubId: number

  @column()
  declare provider: ClubProviderType

  @column()
  declare providerTeamId: string | null

  @column(clubProviderSecretColumnOptions)
  declare accessToken: string | null

  @column(clubProviderSecretColumnOptions)
  declare accessTokenSecret: string | null

  @column(clubProviderSecretColumnOptions)
  declare refreshToken: string | null

  @column.dateTime()
  declare tokenExpiresAt: DateTime | null

  @column.dateTime()
  declare lastSyncedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Club)
  declare club: BelongsTo<typeof Club>
}
