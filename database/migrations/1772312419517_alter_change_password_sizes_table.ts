import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AlterAthletePasswordColumnLength extends BaseSchema {
  protected tableName = 'base_athlete'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('password', 255).alter()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('password', 128).alter()
    })
  }
}
