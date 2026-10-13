import AthleteService from '#services/athlete_service';
import { EventService } from '#services/event_service';
import { fetchActivitySeriesDecodedByActivityIds } from '#utils/series';
import { DateTime } from 'luxon';
export default class MobileCalendarService {
    athleteService;
    eventService;
    constructor() {
        this.athleteService = new AthleteService();
        this.eventService = new EventService();
    }
    async getEvents(athleteId, startDate, endDate) {
        const athlete = await this.athleteService.getAthleteById(athleteId);
        if (!athlete?.clubId) {
            throw new Error('Athlete not found');
        }
        const start = DateTime.fromJSDate(startDate).startOf('day');
        const end = DateTime.fromJSDate(endDate).endOf('day');
        const [events, eventTypesByCategory] = await Promise.all([
            this.eventService.getEventsByAthleteAndDateRange(athleteId, athlete.clubId, start, end),
            this.eventService.getEventTypesByCategory(athlete.appLanguageOrDefault, athlete.clubId),
        ]);
        return events.map((event) => this.formatEventSummary(event, eventTypesByCategory));
    }
    async getEvent(athleteId, eventId) {
        const athlete = await this.athleteService.getAthleteById(athleteId);
        if (!athlete?.clubId) {
            throw new Error('Athlete not found');
        }
        const event = await this.eventService.getEventForAthlete(eventId, athleteId);
        if (!event) {
            return null;
        }
        const eventTypesByCategory = await this.eventService.getEventTypesByCategory(athlete.appLanguageOrDefault, athlete.clubId);
        return this.formatEventDetail(event, eventTypesByCategory);
    }
    async enrichSportActivityDetail(activity) {
        if (!activity)
            return null;
        const seriesByActivityId = await fetchActivitySeriesDecodedByActivityIds([activity.id]);
        return {
            ...activity.serialize(),
            series: seriesByActivityId.get(activity.id) ?? [],
        };
    }
    formatEventSummary(event, eventTypesByCategory) {
        const json = event.toJSON();
        const eventType = json.eventType
            ? {
                ...json.eventType,
                name: Object.values(eventTypesByCategory)
                    .flat()
                    .find((type) => type.id === json.eventType.id)?.name ?? json.eventType.name,
            }
            : null;
        const activity = event.sportActivities[0];
        const sportActivity = activity
            ? {
                id: activity.id,
                rpe: activity.rpe,
                muscularDifficulty: activity.muscularDifficulty,
                cardioRespiratory: activity.cardioRespiratory,
                pleasureLevel: activity.pleasureLevel,
                fatigueLevel: activity.fatigueLevel,
                fitnessLevel: activity.fitnessLevel,
                activeCalories: activity.activeCalories,
                sessionComment: activity.sessionComment,
            }
            : null;
        return {
            id: json.id,
            title: json.title,
            startTime: json.startTime,
            endTime: json.endTime,
            location: json.location,
            eventType,
            sportActivity,
        };
    }
    async formatEventDetail(event, eventTypesByCategory) {
        const { sportActivities: _sportActivities, athletes: _athletes, ...json } = event.toJSON();
        const eventType = json.eventType
            ? {
                ...json.eventType,
                name: Object.values(eventTypesByCategory)
                    .flat()
                    .find((type) => type.id === json.eventType.id)?.name ?? json.eventType.name,
            }
            : null;
        return {
            ...json,
            eventType,
            sportActivity: await this.enrichSportActivityDetail(event.sportActivities[0]),
        };
    }
}
//# sourceMappingURL=calendar_service.js.map