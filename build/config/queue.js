import { defineConfig } from '@nemoventures/adonis-jobs';
import { RedisCheck, RedisMemoryUsageCheck } from '@adonisjs/redis';
const queueConfig = defineConfig({
    connection: { connectionName: 'main' },
    useSharedConnection: true,
    healthCheck: {
        enabled: true,
        endpoint: '/internal/healthz',
        checks: ({ connection }) => [
            new RedisCheck(connection),
            new RedisMemoryUsageCheck(connection).warnWhenExceeds('100MB').failWhenExceeds('200MB'),
        ],
    },
    defaultQueue: 'default',
    queues: {
        default: {
            defaultWorkerOptions: {
                concurrency: 5,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        firstBeat: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
                limiter: {
                    duration: 60 * 1000,
                    max: 60,
                },
            },
        },
        garmin: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        wahoo: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        whoop: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        basketball: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
                limiter: {
                    duration: 60 * 1000,
                    max: 10,
                },
            },
        },
        sunderland: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        catapult: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        statsports: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
        match_providers: {
            defaultWorkerOptions: {
                concurrency: 1,
                removeOnComplete: { age: 24 * 3600 },
            },
        },
    },
});
export default queueConfig;
//# sourceMappingURL=queue.js.map