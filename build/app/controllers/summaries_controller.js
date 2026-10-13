import logger from '@adonisjs/core/services/logger';
import SummaryService from '#services/summary_service';
import { generateActivitySummarySchema, generateNutritionSummarySchema, generateHealthSummarySchema, generateSleepSummarySchema, getActivitySummaryParamsSchema, getActivitySummaryQuerySchema, getNutritionSummaryParamsSchema, getNutritionSummaryQuerySchema, getHealthSummaryParamsSchema, getHealthSummaryQuerySchema, getSleepSummaryParamsSchema, getSleepSummaryQuerySchema, } from '#schemas/summaries';
export default class SummariesController {
    summaryService;
    constructor() {
        this.summaryService = new SummaryService();
    }
    async generateActivitySummary({ request, response }) {
        try {
            const { entityId, date, athleteId, is_delete } = await request.validateUsing(generateActivitySummarySchema);
            const summary = await this.summaryService.generateActivitySummary({
                entityId,
                date,
                athleteId,
                is_delete,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: generateActivitySummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Activity not found' ||
                    error.message === 'Day not found for the given date and athlete' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: generateActivitySummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async generateNutritionSummary({ request, response }) {
        try {
            const { date, athleteId } = await request.validateUsing(generateNutritionSummarySchema);
            const summary = await this.summaryService.generateNutritionSummary({
                date,
                athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: generateNutritionSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: generateNutritionSummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async generateHealthSummary({ request, response }) {
        try {
            const { date, athleteId, is_delete } = await request.validateUsing(generateHealthSummarySchema);
            const summary = await this.summaryService.generateHealthSummary({
                date,
                athleteId,
                is_delete,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: generateHealthSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('mandatory health fields')) {
                return response.badRequest({ error: error.message });
            }
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async generateSleepSummary({ request, response }) {
        try {
            const { date, athleteId } = await request.validateUsing(generateSleepSummarySchema);
            const summary = await this.summaryService.generateSleepSummary({
                date,
                athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: generateSleepSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('sleep data')) {
                return response.badRequest({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: generateSleepSummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getActivitySummary({ params, request, response }) {
        try {
            const validatedParams = await getActivitySummaryParamsSchema.validate(params);
            const validatedQuery = await getActivitySummaryQuerySchema.validate(request.qs());
            const summary = await this.summaryService.getActivitySummary({
                entityId: validatedParams.entityId,
                date: validatedParams.date,
                athleteId: validatedQuery.athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: getActivitySummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Activity not found' ||
                    error.message === 'Day not found for the given date and athlete' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('Complete activity data')) {
                return response.badRequest({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: getActivitySummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getNutritionSummary({ params, request, response }) {
        try {
            const validatedParams = await getNutritionSummaryParamsSchema.validate(params);
            const validatedQuery = await getNutritionSummaryQuerySchema.validate(request.qs());
            const summary = await this.summaryService.getNutritionSummary({
                date: validatedParams.date,
                athleteId: validatedQuery.athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: getNutritionSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date and athlete' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('Complete all meal types')) {
                return response.badRequest({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: getNutritionSummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getHealthSummary({ params, request, response }) {
        try {
            const validatedParams = await getHealthSummaryParamsSchema.validate(params);
            const validatedQuery = await getHealthSummaryQuerySchema.validate(request.qs());
            const summary = await this.summaryService.getHealthSummary({
                date: validatedParams.date,
                athleteId: validatedQuery.athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: getHealthSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('mandatory health fields')) {
                return response.badRequest({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: getHealthSummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getSleepSummary({ params, request, response }) {
        try {
            const validatedParams = await getSleepSummaryParamsSchema.validate(params);
            const validatedQuery = await getSleepSummaryQuerySchema.validate(request.qs());
            const summary = await this.summaryService.getSleepSummary({
                date: validatedParams.date,
                athleteId: validatedQuery.athleteId,
            });
            return response.ok({
                success: true,
                summary: summary,
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('validation')) {
                logger.warn({ error }, 'SummariesController: getSleepSummary validation failed');
                return response.badRequest({ error: 'Invalid request parameters', message: error.message });
            }
            if (error instanceof Error &&
                (error.message === 'Day not found for the given date and athlete' ||
                    error.message === 'Athlete not found')) {
                return response.notFound({ error: error.message });
            }
            if (error instanceof Error && error.message.includes('sleep data')) {
                return response.badRequest({ error: error.message });
            }
            logger.error({ error }, 'SummariesController: getSleepSummary failed');
            return response.internalServerError({
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
//# sourceMappingURL=summaries_controller.js.map