import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddPlayerPositionToAthletes extends BaseSchema {
  protected tableName = 'base_athlete'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('player_position_id').unsigned().nullable()
      table.foreign('player_position_id').references('id').inTable('player_positions')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign('player_position_id')
      table.dropColumn('player_position_id')
    })
  }
} 