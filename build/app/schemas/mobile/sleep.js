import { timeString } from '#schemas/utils/time';
import vine from '@vinejs/vine';
export const getSleepSchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addSleepQuerySchema = vine.compile(vine.object({
    dateOfDay: vine.date({ formats: ['iso8601'] }),
}));
export const addSleepSchema = vine.compile(vine.object({
    bedtime: timeString().nullable(),
    wakeUp: timeString().nullable(),
    ratings: vine.record(vine.number().nullable()).optional(),
    napAM: timeString().nullable(),
    napPM: timeString().nullable(),
}));
//# sourceMappingURL=sleep.js.map