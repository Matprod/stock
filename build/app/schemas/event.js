import vine from '@vinejs/vine';
import { addNoteObjectSchema } from '#schemas/note';
export const createEventSchema = vine.compile(vine.object({
    eventTypeId: vine.string(),
    startTime: vine.date({ formats: ['iso8601'] }),
    endTime: vine.date({ formats: ['iso8601'] }),
    title: vine.string().trim().minLength(1),
    location: vine.string().trim().optional(),
    athletes: vine.array(vine.string()).minLength(1),
    notes: vine.array(addNoteObjectSchema),
}));
export const updateEventSchema = vine.compile(vine.object({
    startTime: vine.date({ formats: ['iso8601'] }).optional(),
    endTime: vine.date({ formats: ['iso8601'] }).optional(),
    title: vine.string().trim().minLength(1).optional(),
    location: vine.string().trim().optional(),
    athletes: vine.array(vine.string()).minLength(1).optional(),
}));
export const upsertEventParams = vine.compile(vine.object({
    id: vine.string().optional(),
}));
export const getEventsQuerySchema = vine.compile(vine.object({
    start: vine.date({ formats: ['iso8601'] }),
    end: vine.date({ formats: ['iso8601'] }),
}));
export const getEventParams = vine.compile(vine.object({
    id: vine.string(),
}));
//# sourceMappingURL=event.js.map