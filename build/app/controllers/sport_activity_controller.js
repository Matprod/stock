import { SportActivityService } from '#services/sport_activity_service';
import { GarminService } from '#services/garmin_service';
import { DateTime } from 'luxon';
import SportActivity from '#models_pg/sport_activity';
import Activity from '#models_pg/activity';
import { SERIE_TYPE } from '#constants/serie.constants';
import { SubjectiveScaleService } from '#services/subjective_scale_service';
import { SUBJECTIVE_DISPLAY_CONTEXT } from '#contracts/subjective_variable';
import { getLanguageFromRequest } from '#utils/language';
import { getActivityTypeDisplayVariablesParamsSchema, getHeartRatePointsParamsSchema, updateSubjectiveFieldsParamsSchema, updateSubjectiveFieldsSchema, } from '#schemas/sport_activity_schema';
import { attachDisplayVariableLabels } from '#utils/get_activity_variable';
export default class SportActivityController {
    sportActivityService;
    garminService;
    subjectiveScaleService;
    constructor() {
        this.sportActivityService = new SportActivityService();
        this.garminService = new GarminService();
        this.subjectiveScaleService = new SubjectiveScaleService();
    }
    async updateSubjectiveFields({ params, request, response, auth }) {
        const { id } = await updateSubjectiveFieldsParamsSchema.validate(params);
        const payload = await updateSubjectiveFieldsSchema.validate(request.body());
        const clubId = auth.user?.clubId;
        if (!clubId) {
            return response.notFound({ error: 'Club not found' });
        }
        const language = getLanguageFromRequest(request);
        const activityScales = await this.subjectiveScaleService.getScales(clubId, language, {
            context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY,
        });
        const scaleByFieldName = new Map(activityScales.map((scale) => [scale.fieldName, scale]));
        for (const entry of payload) {
            const scale = scaleByFieldName.get(entry.id);
            if (!scale) {
                return response.badRequest({ error: `Unknown subjective field: ${entry.id}` });
            }
            if (entry.value != null &&
                (entry.value < scale.min || entry.value > scale.max)) {
                return response.badRequest({
                    error: `Value for ${entry.id} must be between ${scale.min} and ${scale.max}`,
                });
            }
        }
        const result = await this.sportActivityService.updateSubjectiveFields(id, payload, activityScales);
        return response.json({
            message: 'Subjective field updated',
            result: result,
        });
    }
    async getSubjectiveFieldsConfig({ response, auth, request }) {
        const clubId = auth.user?.clubId;
        if (!clubId) {
            return response.notFound({ error: 'Club not found' });
        }
        const language = getLanguageFromRequest(request);
        const scales = await this.subjectiveScaleService.getScales(clubId, language, {
            context: SUBJECTIVE_DISPLAY_CONTEXT.ACTIVITY,
        });
        return response.json(scales);
    }
    async getEventActivities({ params, response }) {
        const eventId = params.eventId;
        const activities = await SportActivity.query().where('eventId', eventId).preload('day').exec();
        const mappedActivities = activities.map((act) => ({
            athleteId: act.day.athleteId,
            sportActivityId: act.id,
            data: {
                rpe: act.rpe,
                muscularDifficulty: act.muscularDifficulty,
                cardioRespiratory: act.cardioRespiratory,
                pleasureLevel: act.pleasureLevel,
                fatigueLevel: act.fatigueLevel,
            },
            stats: {
                duration: act.durationMinutes,
                calories: act.activeCalories || 0,
                hrMax: act.fcMax || 0,
                hrAvg: act.averagedBpm || 0,
                distance: act.distance ? Number((act.distance / 1000).toFixed(2)) : 0,
            },
        }));
        return response.json(mappedActivities);
    }
    async getFitData({ params, response }) {
        try {
            const sportActivityId = params.id;
            if (!sportActivityId) {
                return response.badRequest({ error: 'Invalid sport activity ID' });
            }
            const fitData = await this.sportActivityService.getFitDataFromSeries(sportActivityId);
            return response.json({
                fit_data: fitData,
            });
        }
        catch (error) {
            console.error('Error getting fit data:', error);
            return response.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to get fit data',
            });
        }
    }
    async getHeartRatePoints({ params, response, auth }) {
        try {
            const { id: sportActivityId } = await getHeartRatePointsParamsSchema.validate(params);
            const clubId = auth.user.clubId;
            const hasAccess = await SportActivity.query()
                .where('id', sportActivityId)
                .whereHas('day', (dayQuery) => {
                dayQuery.whereHas('athlete', (athleteQuery) => {
                    athleteQuery.where('clubId', clubId);
                });
            })
                .first();
            if (!hasAccess) {
                return response.notFound({ error: 'Sport activity not found' });
            }
            const heartRatePoints = await this.sportActivityService.getTimestampedSeriesPoints(sportActivityId, SERIE_TYPE.HEART_RATE, 'hr');
            return response.json({
                sportActivityId,
                heartRatePoints: heartRatePoints.map((point) => ({ ts: point.ts, hr: point.value })),
            });
        }
        catch (error) {
            console.error('Error getting heart rate points:', error);
            return response.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to get heart rate points',
            });
        }
    }
    async backfillActivities({ request, response }) {
        const garminUserId = request.body().garminUserId;
        if (!garminUserId) {
            return response.badRequest({ error: 'Invalid garmin user ID' });
        }
        await this.garminService.backfillActivities(garminUserId, DateTime.now().minus({ months: 2 }).toSeconds(), DateTime.now().toSeconds());
        return response.json({ message: 'Activities backfilled' });
    }
    async calculateTrainingLoad({ request, response }) {
        const { sportActivityId } = request.body();
        const trainingLoad = await this.sportActivityService.calculateTrainingLoad(sportActivityId, true);
        return response.json({ trainingLoad });
    }
    async getUsedActivities({ response, auth }) {
        const clubId = auth.user.clubId;
        const activities = await Activity.query()
            .whereHas('exercices', (query) => {
            query.where('clubId', clubId);
        })
            .select('id', 'name')
            .exec();
        return response.json(activities);
    }
    async getActivityTypeDisplayVariables({ params, response, auth, request }) {
        const { activityTypeId } = await getActivityTypeDisplayVariablesParamsSchema.validate(params);
        const displayVariables = await this.sportActivityService.getActivityTypeDisplayVariables(activityTypeId, auth.user?.clubId);
        await attachDisplayVariableLabels(displayVariables, getLanguageFromRequest(request));
        return response.json(displayVariables.map((variable) => variable.serialize()));
    }
}
//# sourceMappingURL=sport_activity_controller.js.map