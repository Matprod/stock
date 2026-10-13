import { BaseSchema } from '@adonisjs/lucid/schema'
import { SUBJECTIVE_VARIABLE_DOMAINS } from '#contracts/subjective_variable'

export default class extends BaseSchema {
  protected tableName = 'subjective_variables'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().notNullable().defaultTo(this.raw('uuidv7()'))
      table.string('field_name').notNullable()
      table.enum('domain', SUBJECTIVE_VARIABLE_DOMAINS, {
        useNative: true,
        enumName: 'subjective_variable_domain_enum',
      }).notNullable()
      table.timestamps(true, true)

      table.unique(['domain', 'field_name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
    this.schema.raw('DROP TYPE IF EXISTS subjective_variable_domain_enum')
  }
}
