import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { AppPlatform, AppVersionStatus } from '#contracts/mobile/app_version'

const trimNullable = (value: string | null) => value?.trim() ?? null
const trimRequired = (value: string) => value.trim()

export default class AppVersion extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column({ prepare: trimRequired, consume: trimRequired })
  declare version: string

  @column()
  declare platform: AppPlatform

  @column()
  declare status: AppVersionStatus

  @column({ prepare: trimNullable, consume: trimNullable })
  declare updateMessage: string | null
}
