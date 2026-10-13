import { BaseSchema } from '@adonisjs/lucid/schema';
import { FILE_TYPE } from '#constants/file.constants';
export default class extends BaseSchema {
    tableName = 'files';
    async up() {
        this.schema.createTable(this.tableName, (table) => {
            table.increments('id');
            table.enum('type', Object.values(FILE_TYPE)).defaultTo(FILE_TYPE.IMAGE);
            table.string('key');
            table.string('file_name');
            table.timestamp('created_at');
            table.timestamp('updated_at');
        });
    }
    async down() {
        this.schema.dropTable(this.tableName);
    }
}
//# sourceMappingURL=1747919812992_create_files_table.js.map