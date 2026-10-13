import { getDbType } from '#adomin/utils/get_db_type';
import db from '@adonisjs/lucid/services/db';
const getDayOfWeekSql = (column) => {
    const dbType = getDbType();
    switch (dbType) {
        case 'mysql':
            return `DAYOFWEEK(${column}) - 1`;
        case 'pg':
        case 'postgres':
            return `EXTRACT(DOW FROM ${column})`;
        case 'sqlite':
            return `strftime('%w', ${column})`;
        default:
            throw new Error(`Database ${dbType} not supported for day of week grouping, but it should not be hard to add it, see groupByHelpers`);
    }
};
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export async function groupByDayOfWeek(table, column, options = {}) {
    const dayOfWeekSql = getDayOfWeekSql(column);
    const query = db.from(table).select(db.raw(`${dayOfWeekSql} as day_of_week`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query
        .count('* as count')
        .groupBy('day_of_week')
        .orderBy('day_of_week', 'asc');
    const dayOfWeekMap = results.map((row) => {
        const dayOfWeek = +row.day_of_week;
        const dayName = DAY_LABELS[dayOfWeek];
        const res = [dayName, Number(row.count)];
        return res;
    });
    return dayOfWeekMap;
}
const getDateSql = (column) => {
    const dbType = getDbType();
    switch (dbType) {
        case 'mysql':
            return `DATE(${column})`;
        case 'pg':
        case 'postgres':
            return `DATE_TRUNC('day', ${column})`;
        case 'sqlite':
            return `DATE(${column})`;
        default:
            throw new Error(`Database ${dbType} not supported for date grouping, but it should not be hard to add it, see groupByHelpers`);
    }
};
export async function groupByDate(table, column, options = {}) {
    const dateSql = getDateSql(column);
    const query = db.from(table).select(db.raw(`${dateSql} as date`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query.count('* as count').groupBy('date').orderBy('date', 'asc');
    const dateMap = results.map((row) => {
        const res = [row.date, Number(row.count)];
        return res;
    });
    return dateMap;
}
const getHourSql = (column) => {
    const dbType = getDbType();
    switch (dbType) {
        case 'mysql':
            return `HOUR(CONVERT_TZ(${column}, 'UTC', 'Europe/Paris'))`;
        case 'pg':
        case 'postgres':
            return `EXTRACT(HOUR FROM ${column} AT TIME ZONE 'Europe/Paris')`;
        case 'sqlite':
            return `STRFTIME('%H', ${column})`;
        default:
            throw new Error('Unsupported database type for hour grouping, but it should not be hard to add it, see groupByHelpers');
    }
};
export async function groupByHour(table, column, options = {}) {
    const hourSql = getHourSql(column);
    const query = db.from(table).select(db.raw(`${hourSql} as hour`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query.count('* as count').groupBy('hour').orderBy('hour', 'asc');
    if (!options.allHours) {
        return results.map((row) => [row.hour.toString(), Number(row.count)]);
    }
    const countsByHour = new Map(results.map((row) => [Number(row.hour), Number(row.count)]));
    const allHours = [];
    for (let hour = 0; hour < 25; hour++) {
        const hourStr = hour.toString().padStart(2, '0');
        const value = countsByHour.get(hour % 24) || 0;
        allHours.push([hourStr, value]);
    }
    return allHours;
}
export const groupByYear = async (table, column, options = {}) => {
    const dbType = getDbType();
    const yearSql = dbType === 'pg' ? `EXTRACT(YEAR FROM ${column})` : `YEAR(${column})`;
    const query = db.from(table).select(db.raw(`${yearSql} as year`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query.count('* as count').groupBy('year').orderBy('year', 'asc');
    return results.map((row) => [row.year, Number(row.count)]);
};
const MONTH_LABELS = [
    'Jan',
    'Fév',
    'Mar',
    'Avr',
    'Mai',
    'Juin',
    'Juil',
    'Août',
    'Sep',
    'Oct',
    'Nov',
    'Déc',
];
export const groupByMonth = async (table, column, options = {}) => {
    const dbType = getDbType();
    const monthSql = dbType === 'pg' ? `EXTRACT(MONTH FROM ${column})` : `MONTH(${column})`;
    const query = db.from(table).select(db.raw(`${monthSql} as month`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query.count('* as count').groupBy('month').orderBy('month', 'asc');
    return results.map((row) => [MONTH_LABELS[row.month - 1], Number(row.count)]);
};
export const groupByMonthAndYear = async (table, column, options = {}) => {
    const dbType = getDbType();
    const monthSql = dbType === 'pg' ? `EXTRACT(MONTH FROM ${column})` : `MONTH(${column})`;
    const yearSql = dbType === 'pg' ? `EXTRACT(YEAR FROM ${column})` : `YEAR(${column})`;
    const query = db.from(table).select(db.raw(`${monthSql} as month`), db.raw(`${yearSql} as year`));
    if (options.queryBuilderCallback) {
        options.queryBuilderCallback(query);
    }
    const results = await query.count('* as count').groupBy('month', 'year').orderBy('month', 'asc');
    const yearsData = [];
    results.forEach((row) => {
        const found = yearsData.find((item) => item.name === row.year.toString());
        if (found) {
            found.data.push([MONTH_LABELS[row.month - 1], Number(row.count)]);
        }
        else {
            yearsData.push({
                name: row.year.toString(),
                data: [[MONTH_LABELS[row.month - 1], Number(row.count)]],
            });
        }
    });
    return yearsData;
};
//# sourceMappingURL=group_by_helpers.js.map