import env from '#start/env';
import { defineConfig } from '@adonisjs/redis';
const redisConfig = defineConfig({
    connection: 'main',
    connections: {
        main: {
            host: env.get('REDIS_HOST'),
            port: env.get('REDIS_PORT'),
            password: env.get('REDIS_PASSWORD', ''),
            db: 0,
            keyPrefix: '',
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                return times > 10 ? null : times * 50;
            },
        },
    },
});
export default redisConfig;
//# sourceMappingURL=redis.js.map