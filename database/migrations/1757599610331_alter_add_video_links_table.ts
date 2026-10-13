import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_reinforcementexercices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('video_link').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('video_link')
    })
  }
}
