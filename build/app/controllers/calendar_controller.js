import { EventService } from '#services/event_service';
import { getLanguageFromRequest } from '../utils/language.js';
import { upsertEventParams, getEventsQuerySchema, getEventParams, createEventSchema, updateEventSchema, } from '#schemas/event';
import { DateTime } from 'luxon';
export default class CalendarController {
    eventService;
    constructor() {
        this.eventService = new EventService();
    }
    async getEventTypes({ request, response, auth }) {
        const language = getLanguageFromRequest(request);
        const eventTypes = await this.eventService.getEventTypesByCategory(language, auth.user.clubId);
        return response.json(eventTypes);
    }
    async getEvent({ params, response }) {
        const { id } = await getEventParams.validate(params);
        const payload = await this.eventService.getEnrichedEventPayload(id);
        return response.json(payload);
    }
    async getEvents({ request, response, auth }) {
        try {
            const { start, end } = await getEventsQuerySchema.validate(request.qs());
            const startDate = DateTime.fromJSDate(start);
            const endDate = DateTime.fromJSDate(end);
            const events = await this.eventService.getEventsByDateRange(auth.user.clubId, startDate, endDate);
            const formattedEvents = events.map((event) => event.toJSON());
            if (formattedEvents.length === 0) {
                return response.json([]);
            }
            return response.json(formattedEvents);
        }
        catch (error) {
            return response.badRequest({ message: error.message });
        }
    }
    async upsertEvent({ request, response, auth, params }) {
        const { id } = await upsertEventParams.validate(params);
        if (id) {
            const payload = await updateEventSchema.validate(request.body());
            const updatedEvent = await this.eventService.updateEvent({
                id,
                ...payload,
                clubId: auth.user.clubId,
            });
            return response.json(updatedEvent);
        }
        else {
            const payload = await createEventSchema.validate(request.body());
            const newEvent = await this.eventService.createEvent({
                ...payload,
                clubId: auth.user.clubId,
            });
            return response.json(newEvent);
        }
    }
    async deleteEvent({ response, auth, params }) {
        try {
            const result = await this.eventService.deleteEvent(params.id, auth.user.clubId);
            return response.json(result);
        }
        catch (error) {
            return response.notFound({ message: error.message });
        }
    }
}
//# sourceMappingURL=calendar_controller.js.map