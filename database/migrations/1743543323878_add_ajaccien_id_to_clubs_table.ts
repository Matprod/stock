import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddExternalClubIdToClubsTable extends BaseSchema {
  protected tableName = 'clubs'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('my_coach_club_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('my_coach_club_id')
    })
  }
} 