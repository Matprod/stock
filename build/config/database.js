import env from '#start/env';
import { defineConfig } from '@adonisjs/lucid';
const dbConfig = defineConfig({
    connection: env.get('DB_CONNECTION', 'mysql'),
    connections: {
        mysql: {
            client: 'mysql2',
            connection: {
                host: env.get('DB_HOST'),
                port: env.get('DB_PORT'),
                user: env.get('DB_USER'),
                password: env.get('DB_PASSWORD'),
                database: env.get('DB_DATABASE'),
                charset: 'utf8mb4',
            },
            pool: {
                min: 2,
                max: 10,
                acquireTimeoutMillis: 30000,
                idleTimeoutMillis: 60000,
            },
            migrations: {
                naturalSort: true,
                paths: ['database/migrations'],
            },
        },
        pg: {
            client: 'pg',
            connection: {
                host: env.get('DB_PG_HOST'),
                port: env.get('DB_PG_PORT'),
                user: env.get('DB_PG_USER'),
                password: env.get('DB_PG_PASSWORD'),
                database: env.get('DB_PG_DATABASE'),
                ...(env.get('DB_PG_HOST')?.includes('.rds.amazonaws.com')
                    ? { ssl: { rejectUnauthorized: false } }
                    : {}),
            },
            pool: {
                min: 2,
                max: 10,
                acquireTimeoutMillis: 30000,
                idleTimeoutMillis: 60000,
            },
            migrations: {
                naturalSort: true,
                paths: ['database/migrations_pg'],
            },
        },
    },
});
export default dbConfig;
//# sourceMappingURL=database.js.map