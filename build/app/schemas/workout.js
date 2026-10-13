import vine from '@vinejs/vine';
import { addNoteObjectSchema } from './note.js';
export const createWorkoutSchema = vine.compile(vine.object({
    name: vine.string().minLength(1),
    exerciseIds: vine.array(vine.string()).minLength(1),
    durationSeconds: vine.number().optional(),
    id: vine.string().optional(),
}));
export const startWorkoutSchema = vine.compile(vine.object({
    workoutId: vine.string(),
    startTime: vine.string(),
    exercises: vine.array(vine.object({
        id: vine.string(),
        sets: vine.array(vine.object({
            reps: vine.number().optional(),
            durationSeconds: vine.number().optional(),
            weight: vine.number().optional(),
            order: vine.number(),
        })),
    })),
    notes: vine.array(addNoteObjectSchema).optional(),
    players: vine.array(vine.string()),
    durationSeconds: vine.number().optional(),
    createEvent: vine.boolean().optional(),
}));
export const deleteWorkoutSchema = vine.compile(vine.object({
    workoutId: vine.string(),
}));
export const toggleExerciseFavoriteParamsSchema = vine.compile(vine.object({
    exerciseId: vine.string(),
}));
export const toggleExerciseFavoriteBodySchema = vine.compile(vine.object({
    favorite: vine.boolean(),
}));
export const filterWorkoutsLibrarySchema = vine.compile(vine.object({
    searchQuery: vine.string().optional(),
    sportId: vine.string().optional(),
    exerciseId: vine.string().optional(),
}));
export const filterWorkoutsSchema = vine.compile(vine.object({
    cursor: vine.number().optional(),
    searchQuery: vine.string().optional(),
    sportId: vine.string().optional(),
    exerciseId: vine.string().optional(),
    playerId: vine.string().optional(),
    from: vine.string().optional(),
    to: vine.string().optional(),
}));
//# sourceMappingURL=workout.js.map