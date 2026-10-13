import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddExternalPlayerIdToAthletesTable extends BaseSchema {
  protected tableName = 'base_athlete'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('my_coach_player_id').nullable()
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('my_coach_player_id')
    })
  }
} 