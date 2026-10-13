import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected fromTableName = 'club_thresholds'
  protected toTableName = 'club_settings'

  async up() {
    this.schema.renameTable(this.fromTableName, this.toTableName)
  }

  async down() {
    this.schema.renameTable(this.toTableName, this.fromTableName)
  }
}