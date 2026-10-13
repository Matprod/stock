import { GENDER } from '#constants/athlete.constants'
import {
  EXTERNAL_API_KEY_PREFIX,
  EXTERNAL_API_PREFIX,
  EXTERNAL_API_RATE_LIMIT,
  EXTERNAL_API_SCORE_MAX_RANGE_DAYS,
} from '#constants/external_api.constants'

export const EXTERNAL_OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Mauna API',
    version: '1.0.0',
    description: `Authenticate with \`Authorization: Bearer ${EXTERNAL_API_KEY_PREFIX}...\`. Limit: ${EXTERNAL_API_RATE_LIMIT.requests} requests / ${EXTERNAL_API_RATE_LIMIT.duration}.`,
  },
  servers: [{ url: EXTERNAL_API_PREFIX }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: `Club API key (\`${EXTERNAL_API_KEY_PREFIX}...\`)`,
      },
    },
    schemas: {
      Athlete: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          birthDate: { type: 'string', format: 'date' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date', nullable: true },
          jerseyNumber: { type: 'integer', nullable: true },
          heightCm: { type: 'integer', nullable: true },
          weightKg: { type: 'number', nullable: true },
          gender: { type: 'string', enum: Object.values(GENDER) },
          position: { type: 'string' },
        },
        required: [
          'id',
          'firstName',
          'lastName',
          'birthDate',
          'startDate',
          'endDate',
          'jerseyNumber',
          'heightCm',
          'weightKg',
          'gender',
          'position',
        ],
      },
      Score: {
        type: 'object',
        properties: {
          athleteId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date' },
          performanceScore: {
            type: 'integer',
            nullable: true,
            description: 'Daily performance score, 0–100. Higher is better.',
          },
          injuryRiskScore: {
            type: 'integer',
            nullable: true,
            description: 'Daily injury risk score, 0–100. Higher is more risk.',
          },
        },
        required: ['athleteId', 'date', 'performanceScore', 'injuryRiskScore'],
      },
      ScoreThresholds: {
        type: 'object',
        properties: {
          performance: {
            type: 'object',
            properties: {
              high: { type: 'number' },
              medium: { type: 'number' },
            },
            required: ['high', 'medium'],
          },
          injury: {
            type: 'object',
            properties: {
              high: { type: 'number' },
              medium: { type: 'number' },
            },
            required: ['high', 'medium'],
          },
        },
        required: ['performance', 'injury'],
      },
    },
  },
  paths: {
    '/athletes': {
      get: {
        operationId: 'listAthletes',
        summary: 'List athletes',
        description: 'Returns all athletes for the club bound to the API key.',
        tags: ['Athletes'],
        responses: {
          '200': {
            description: 'Athlete list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Athlete' },
                    },
                  },
                  required: ['data'],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
          },
          '429': {
            description: 'Rate limit exceeded',
          },
        },
      },
    },
    '/scores': {
      get: {
        operationId: 'listScores',
        summary: 'List daily scores',
        description: `Returns daily performance and injury-risk scores for the club. Only days between each athlete's startDate and endDate are included. Both scores are 0–100. \`thresholds\` are the club bands for coloring (performance: higher is better; injury: higher is more risk). Range is limited to ${EXTERNAL_API_SCORE_MAX_RANGE_DAYS} days.`,
        tags: ['Scores'],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
            description: 'Start date (inclusive), YYYY-MM-DD',
          },
          {
            name: 'to',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
            description: 'End date (inclusive), YYYY-MM-DD',
          },
          {
            name: 'athleteId',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Limit to a single athlete',
          },
        ],
        responses: {
          '200': {
            description: 'Daily scores',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Score' },
                    },
                    thresholds: { $ref: '#/components/schemas/ScoreThresholds' },
                  },
                  required: ['data', 'thresholds'],
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid API key',
          },
          '404': {
            description: 'Athlete not found in this club',
          },
          '422': {
            description: 'Invalid or too large date range',
          },
          '429': {
            description: 'Rate limit exceeded',
          },
        },
      },
    },
  },
} as const
