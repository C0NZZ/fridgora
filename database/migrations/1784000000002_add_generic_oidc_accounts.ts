import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      ALTER TABLE user_auth_identities
        DROP CONSTRAINT user_auth_identities_provider_check,
        ADD CONSTRAINT user_auth_identities_provider_check
          CHECK (provider IN ('microsoft', 'discord', 'oidc'))
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE user_auth_identities
        DROP CONSTRAINT user_auth_identities_provider_check,
        ADD CONSTRAINT user_auth_identities_provider_check
          CHECK (provider IN ('microsoft', 'discord'))
    `)
  }
}
