import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

import type { ExternalAuthProvider } from '#services/auth_mode_service'
export type { ExternalAuthProvider } from '#services/auth_mode_service'

export default class UserAuthIdentity extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare provider: ExternalAuthProvider

  @column()
  declare providerUserId: string

  @column()
  declare providerEmail: string | null

  @column()
  declare providerEmailVerified: boolean

  @column.dateTime()
  declare lastLoginAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
