import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vald_trials'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.bigInteger('athlete_day_id').notNullable().references('id').inTable('base_athleteday').onDelete('CASCADE')
      table.float('trial_jump_height').nullable()
      table.float('trial_rsi_modified').nullable()
      table.float('trial_peak_takeoff_power').nullable()
      table.float('trial_concentric_rfd').nullable()
      table.float('trial_peak_landing_force').nullable()
      table.float('trial_time_to_stabilisation').nullable()
      table.float('trial_rsi').nullable()
      table.float('trial_eccentric_braking_rfd').nullable()
      table.timestamps(true)
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
