import { defineConfig } from '@nemoventures/adonis-jobs'
import { RedisCheck, RedisMemoryUsageCheck } from '@adonisjs/redis'

const queueConfig = defineConfig({
  /**
   * The default connection to use. The connection
   * should be defined in the "config/redis.ts" file.
   */
  connection: { connectionName: 'main' },

  /**
   * When enabled, all queues will use the same Redis connection instance.
   * This is the recommended setting for most applications.
   */
  useSharedConnection: true,

  /**
   * Health check configuration for your workers.
   */
  healthCheck: {
    enabled: true,
    endpoint: '/internal/healthz',
    checks: ({ connection }) => [
      new RedisCheck(connection),
      new RedisMemoryUsageCheck(connection).warnWhenExceeds('100MB').failWhenExceeds('200MB'),
    ],
  },

  /**
   * The name of the queue to use when no queue is explicitly specified
   * during job dispatching.
   */
  defaultQueue: 'default',

  /**
   * Configure your queues here. Each queue can have its own connection,
   * worker options, and job options
   */
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
    hamburg: {
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
})

export default queueConfig
