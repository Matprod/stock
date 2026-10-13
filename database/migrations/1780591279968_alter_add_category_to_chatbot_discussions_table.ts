import { INSIGHT_CATEGORIES } from '#constants/insight.constants'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chatbot_discussions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('category', [...INSIGHT_CATEGORIES]).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('category')
    })
  }
}
