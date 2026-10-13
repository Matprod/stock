import { getIsPostgres } from '#adomin/utils/get_db_type';
import string from '@adonisjs/core/helpers/string';
export const whereClause = (builder, { column, columnType, exact, type, value }) => {
    if (value === null) {
        const method = type === 'or' ? 'orWhereNull' : 'andWhereNull';
        builder[method](column);
        return;
    }
    const isPostgres = getIsPostgres();
    if (isPostgres) {
        return whereClausePg(builder, { type, column, value, exact, columnType });
    }
    if (exact) {
        const method = type === 'or' ? 'orWhere' : 'andWhere';
        builder[method](column, value);
    }
    const method = type === 'or' ? 'orWhere' : 'andWhere';
    builder[method](column, 'LIKE', `%${value}%`);
};
const whereClausePg = (builder, { column, exact, type, value }) => {
    if (exact) {
        const method = type === 'or' ? 'orWhereRaw' : 'andWhereRaw';
        builder[method](`CAST("${string.snakeCase(column)}" as text) = ?`, [value]);
        return;
    }
    const method = type === 'or' ? 'orWhereRaw' : 'andWhereRaw';
    builder[method](`CAST("${string.snakeCase(column)}" as text) ILIKE ?`, [`%${value}%`]);
};
//# sourceMappingURL=where_clause.js.map