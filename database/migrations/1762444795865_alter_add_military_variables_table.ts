import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_sportactivity'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Weight metrics (kg)
      table.float('carried_weight').nullable()
      table.float('weapon_weight').nullable()

      // Burst and heart metrics
      table.integer('burst_count').nullable()
      table.integer('heart_exertion').nullable()

      // Landing impact (m/s²)
      table.float('ground_impact').nullable()

      // Descent metrics
      table.time('descent_duration').nullable()
      table.float('average_descent_speed').nullable() // m/s

      // Freefall metrics
      table.time('freefall_duration').nullable()
      table.float('max_freefall_speed').nullable() // m/s

      // Canopy duration (the time the parachute is open)
      table.time('canopy_duration').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('carried_weight')
      table.dropColumn('weapon_weight')
      table.dropColumn('burst_count')
      table.dropColumn('heart_exertion')
      table.dropColumn('ground_impact')
      table.dropColumn('descent_duration')
      table.dropColumn('average_descent_speed')
      table.dropColumn('freefall_duration')
      table.dropColumn('max_freefall_speed')
      table.dropColumn('canopy_duration')
    })
  }
}
