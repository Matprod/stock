import { EVENT_CATEGORY } from '#constants/event.constants';
import vine from '@vinejs/vine';
export const addNoteObjectSchema = vine.object({
    athleteId: vine.string(),
    noteDate: vine.string(),
    content: vine.string(),
    category: vine.enum(Object.values(EVENT_CATEGORY)).optional(),
    eventId: vine.string().optional(),
});
export const addNoteSchema = vine.compile(addNoteObjectSchema);
export const getAllNotesQuerySchema = vine.compile(vine.object({
    cursor: vine.number().optional(),
    athleteId: vine.string().optional(),
    category: vine.enum(Object.values(EVENT_CATEGORY)).optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
}));
export const noteIdParamsSchema = vine.compile(vine.object({
    noteId: vine.string(),
}));
export const updateNoteSchema = vine.compile(vine.object({
    content: vine.string().optional(),
    category: vine.enum(Object.values(EVENT_CATEGORY)).optional(),
    noteDate: vine.string().optional(),
}));
//# sourceMappingURL=note.js.map