import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreatePlayerPositionsTable extends BaseSchema {
  protected tableName = 'player_positions'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.bigint('sport_id').notNullable().references('id').inTable('base_sport')
      table.unique(['name', 'sport_id'])
      table.timestamps(true)
    })

    // Insert the enum values for Football (assuming sport_id 5 is Football)
    await this.defer(async (db) => {
      await db.table(this.tableName).insert([
        { name: 'GOALKEEPER', sport_id: 5 },
        { name: 'DEFENDER', sport_id: 5 },
        { name: 'MIDFIELDER', sport_id: 5 },
        { name: 'FORWARD', sport_id: 5 }
      ])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
} 