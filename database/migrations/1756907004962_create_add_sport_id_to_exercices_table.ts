import { EXERCISE_TYPE } from '#constants/workout.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sportactivity_reinforcementexercices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigint('activity_id').nullable().references('id').inTable('base_activity')
      table.enum('type', Object.values(EXERCISE_TYPE)).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['activity_id'])
      table.dropColumn('activity_id')
      table.dropColumn('type')
    })
  }
}
